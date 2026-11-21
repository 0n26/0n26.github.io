import type { AnimeSource, AnimeTitle, CatalogEntry, CatalogResult, RelatedInfo, ScheduleEntry, VoiceOption } from './source';

function prefixed(sourceKey: string, alias: string): string {
  return `${sourceKey}:${alias}`;
}

function splitAlias(alias: string): { sourceKey?: string; alias: string } {
  const separator = alias.indexOf(':');
  if (separator <= 0) return { alias };
  return { sourceKey: alias.slice(0, separator), alias: alias.slice(separator + 1) };
}

function resolveSource(sources: readonly AnimeSource[], alias: string): { source: AnimeSource; alias: string } | undefined {
  const { sourceKey, alias: original } = splitAlias(alias);
  if (sourceKey) {
    const source = sources.find((item) => item.key === sourceKey);
    if (source) return { source, alias: original };
  }
  return undefined;
}

function prefixEntry(sourceKey: string, entry: CatalogEntry): CatalogEntry {
  return { ...entry, alias: prefixed(sourceKey, entry.alias) };
}

function prefixScheduleEntry(sourceKey: string, entry: ScheduleEntry): ScheduleEntry {
  return { ...entry, alias: prefixed(sourceKey, entry.alias) };
}

function normalizeName(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function entryNames(entry: CatalogEntry): string[] {
  return [entry.name, entry.alternateName].map(normalizeName).filter(Boolean);
}

function sameAnime(a: CatalogEntry, b: CatalogEntry): boolean {
  const aNames = entryNames(a);
  const bNames = entryNames(b);
  if (aNames.length === 0 || bNames.length === 0) return false;
  if (!aNames.some((name) => bNames.includes(name))) return false;
  if (a.year && b.year && a.year !== b.year) return false;
  return true;
}

function makeVoiceOption(source: AnimeSource, entry: CatalogEntry): VoiceOption {
  return {
    source: source.name,
    sourceKey: source.key,
    alias: prefixed(source.key, entry.alias),
    name: entry.name,
  };
}

function withVoices(entry: CatalogEntry, voices: readonly VoiceOption[]): CatalogEntry {
  return { ...entry, voices };
}

function distinctKnownYears(entries: readonly CatalogEntry[]): number[] {
  return [...new Set(entries.map((entry) => entry.year).filter((year): year is number => typeof year === 'number'))];
}

function canMergeCluster(entries: readonly CatalogEntry[]): boolean {
  return distinctKnownYears(entries).length <= 1;
}

function clusterEntries(entries: readonly { entry: CatalogEntry; source: AnimeSource; original: CatalogEntry }[]) {
  // First group by exact normalized name.
  const byName = new Map<string, typeof entries[number][]>();
  for (const item of entries) {
    const names = entryNames(item.entry);
    const key = names.sort().join('|');
    const bucket = byName.get(key) ?? [];
    bucket.push(item);
    byName.set(key, bucket);
  }

  const clusters: (typeof entries[number])[][] = [];
  for (const bucket of byName.values()) {
    if (bucket.length === 1) {
      clusters.push([bucket[0]]);
      continue;
    }

    // Partition by known year when years conflict; otherwise merge all.
    const knownYears = distinctKnownYears(bucket.map((item) => item.entry));
    if (knownYears.length <= 1) {
      clusters.push([...bucket]);
      continue;
    }

    const byYear = new Map<number | 'unknown', typeof bucket>();
    for (const item of bucket) {
      const year = item.entry.year ?? 'unknown';
      const group = byYear.get(year) ?? [];
      group.push(item);
      byYear.set(year, group);
    }
    for (const group of byYear.values()) clusters.push(group);
  }
  return clusters;
}

export function createCombinedSource(sources: readonly AnimeSource[]): AnimeSource {
  const availableSources = [...sources];

  return {
    key: 'combined',
    name: 'Общий каталог',

    async getCatalog(query, page, signal, filters) {
      const hasFilters = Boolean(filters?.genre || filters?.year);
      const selectedSources = hasFilters
        ? availableSources.filter((source) => source.getCatalogFilters)
        : availableSources;

      if (selectedSources.length === 0) {
        return { items: [], page, totalPages: 1 };
      }

      const settled = await Promise.allSettled(
        selectedSources.map((source) => source.getCatalog(query, page, signal, filters)),
      );
      const successes = settled
        .map((result, index) => (result.status === 'fulfilled' ? { source: selectedSources[index], result: result.value } : null))
        .filter((item): item is { source: AnimeSource; result: CatalogResult } => Boolean(item));

      if (successes.length === 0) {
        const firstFailure = settled.find((result) => result.status === 'rejected');
        throw firstFailure?.status === 'rejected' ? firstFailure.reason : new Error('Combined catalog: all sources failed');
      }

      const allItems = successes.flatMap(({ source, result }) =>
        result.items.map((entry) => ({
          entry: prefixEntry(source.key, entry),
          source,
          original: entry,
        })),
      );

      // Cross-source variant lookup so duplicates on different provider pages still merge.
      const variantCache = new Map<string, VoiceOption[]>();
      async function variantsFor(item: { entry: CatalogEntry; source: AnimeSource; original: CatalogEntry }): Promise<VoiceOption[]> {
        const voices = [makeVoiceOption(item.source, item.original)];
        for (const other of selectedSources) {
          if (other.key === item.source.key) continue;
          const searchName = item.original.name;
          const cacheKey = `${other.key}|${normalizeName(searchName)}`;
          let found: VoiceOption[] | undefined = variantCache.get(cacheKey);
          if (!found) {
            found = [];
            try {
              const searchResult = await other.getCatalog(searchName, 1, signal);
              const match = searchResult.items.find((candidate) => sameAnime(candidate, item.original));
              if (match) found.push(makeVoiceOption(other, match));
            } catch {
              // Ignore a failed secondary lookup; primary page still renders.
            }
            variantCache.set(cacheKey, found);
          }
          for (const voice of found) {
            if (!voices.some((existing) => existing.sourceKey === voice.sourceKey)) voices.push(voice);
          }
        }
        return voices;
      }

      const itemsWithVariants = await Promise.all(
        allItems.map(async (item) => ({ item, voices: await variantsFor(item) })),
      );

      const clusters = clusterEntries(itemsWithVariants.map(({ item }) => item));
      const items: CatalogEntry[] = [];
      for (const cluster of clusters) {
        const clusterVoices = new Map<string, VoiceOption>();
        for (const item of cluster) {
          const voices = itemsWithVariants.find((entry) => entry.item === item)?.voices ?? [makeVoiceOption(item.source, item.original)];
          for (const voice of voices) clusterVoices.set(voice.sourceKey, voice);
        }
        const voices = [...clusterVoices.values()];
        const base = cluster[0].entry;
        if (cluster.length === 1 && voices.length === 1) {
          items.push(base);
        } else {
          const groupAlias = `group:${cluster.map((item) => `${item.source.key}~${item.original.alias}`).join('|')}`;
          // Only merge when the whole group has compatible known years.
          const clusterEntriesList = cluster.map((item) => item.entry);
          if (!canMergeCluster(clusterEntriesList)) {
            for (const item of cluster) items.push(item.entry);
            continue;
          }
          items.push(withVoices({ ...base, alias: groupAlias }, voices));
        }
      }

      const totalPages = Math.max(1, ...successes.map(({ result }) => result.totalPages));
      return { items, page, totalPages } satisfies CatalogResult;
    },

    async getCatalogFilters(signal) {
      const sourcesWithFilters = availableSources.filter((source) => source.getCatalogFilters);
      const settled = await Promise.allSettled(sourcesWithFilters.map((source) => source.getCatalogFilters!(signal)));
      const genres = new Map<number, string>();
      const years = new Set<number>();
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const genre of result.value.genres) genres.set(genre.id, genre.name);
        for (const year of result.value.years) years.add(year);
      }
      return {
        genres: [...genres].map(([id, name]) => ({ id, name })),
        years: [...years].sort((a, b) => b - a),
      };
    },

    async getSchedule(signal) {
      const sourcesWithSchedule = availableSources.filter((source) => source.getSchedule);
      const settled = await Promise.allSettled(
        sourcesWithSchedule.map(async (source) => ({ source, entries: await source.getSchedule!(signal) })),
      );
      return settled.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        return result.value.entries.map((entry) => prefixScheduleEntry(result.value.source.key, entry));
      });
    },

    async getTitle(alias, signal) {
      if (alias.startsWith('group:')) {
        const variants = alias
          .slice('group:'.length)
          .split('|')
          .map((part) => {
            const separator = part.indexOf('~');
            if (separator <= 0) return undefined;
            const sourceKey = part.slice(0, separator);
            const originalAlias = part.slice(separator + 1);
            const source = availableSources.find((item) => item.key === sourceKey);
            if (!source) return undefined;
            return { source, alias: prefixed(sourceKey, originalAlias), originalAlias };
          })
          .filter((item): item is { source: AnimeSource; alias: string; originalAlias: string } => Boolean(item));

        if (variants.length === 0) return null;

        const titles = await Promise.allSettled(
          variants.map(async ({ source, alias: variantAlias, originalAlias }) => {
            const title = await source.getTitle(originalAlias, signal);
            return title ? { source, title, alias: variantAlias } : null;
          }),
        );
        const availableTitles = titles
          .filter((result): result is PromiseFulfilledResult<{ source: AnimeSource; title: AnimeTitle; alias: string } | null> => result.status === 'fulfilled')
          .map((result) => result.value)
          .filter((item): item is { source: AnimeSource; title: AnimeTitle; alias: string } => Boolean(item));

        if (availableTitles.length === 0) {
          const firstFailure = titles.find((result) => result.status === 'rejected');
          if (firstFailure?.status === 'rejected') throw firstFailure.reason;
          return null;
        }

        const voices = availableTitles.map(({ source, title, alias: variantAlias }) => ({
          source: source.name,
          sourceKey: source.key,
          alias: variantAlias,
          name: title.name,
        }));

        const first = availableTitles[0];
        return {
          ...first.title,
          alias,
          voices,
        };
      }

      const resolved = resolveSource(availableSources, alias);
      if (resolved) {
        const title = await resolved.source.getTitle(resolved.alias, signal);
        if (!title) return null;
        return { ...title, alias: prefixed(resolved.source.key, title.alias) };
      }

      for (const source of availableSources) {
        try {
          const title = await source.getTitle(alias, signal);
          if (title) return { ...title, alias: prefixed(source.key, title.alias) };
        } catch {
          // Try the next source.
        }
      }
      return null;
    },

    async getRelated(title, signal) {
      const resolved = resolveSource(availableSources, title.alias);
      let source: AnimeSource | undefined;
      let originalAlias = title.alias;
      let originalTitle = title;

      if (title.alias.startsWith('group:')) {
        const firstVariant = title.alias
          .slice('group:'.length)
          .split('|')[0]
          ?.split('~');
        if (firstVariant && firstVariant.length === 2) {
          const sourceKey = firstVariant[0];
          const alias = firstVariant[1];
          source = availableSources.find((item) => item.key === sourceKey);
          if (source) {
            originalAlias = alias;
            // Use the original title data if available in voices, but keep id.
            originalTitle = { ...title, alias };
          }
        }
      } else if (resolved) {
        source = resolved.source;
        originalAlias = resolved.alias;
        originalTitle = { ...title, alias: resolved.alias };
      }

      if (!source) source = availableSources.find((item) => item.getRelated);
      if (!source?.getRelated) return { similar: [], franchises: [] };

      const baseTitle = originalTitle.alias === title.alias && !title.alias.startsWith('group:')
        ? title
        : { ...title, alias: originalAlias };

      const info = await source.getRelated(baseTitle, signal);

      return {
        similar: info.similar.map((entry) => prefixEntry(source.key, entry)),
        franchises: info.franchises.map((franchise) => ({
          ...franchise,
          releases: franchise.releases.map((release) =>
            prefixEntry(source.key, release) as CatalogEntry & { order: number },
          ),
        })),
      } satisfies RelatedInfo;
    },
  };
}

