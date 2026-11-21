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

function clusterEntries(items: readonly { entry: CatalogEntry; source: AnimeSource; original: CatalogEntry }[]) {
  const clusters: (typeof items[number])[][] = [];


  // Group by normalized name first.
  const byName = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = entryNames(item.entry).sort().join('|');
    const bucket = byName.get(key) ?? [];
    bucket.push(index);
    byName.set(key, bucket);
  });

  for (const bucket of byName.values()) {
    if (bucket.length === 1) {
      clusters.push([items[bucket[0]]]);
      continue;
    }

    // Match items from different providers only, one-to-one.
    const matched = new Set<number>();
    const pairs: [number, number][] = [];
    for (let i = 0; i < bucket.length; i += 1) {
      if (matched.has(bucket[i])) continue;
      for (let j = i + 1; j < bucket.length; j += 1) {
        if (matched.has(bucket[j])) continue;
        const a = items[bucket[i]];
        const b = items[bucket[j]];
        if (a.source.key === b.source.key) continue;
        if (!sameAnime(a.entry, b.entry)) continue;
        // Avoid merging if either already matched to another item of the same provider.
        pairs.push([bucket[i], bucket[j]]);
        matched.add(bucket[i]);
        matched.add(bucket[j]);
        break;
      }
    }

    // Build clusters from matched pairs, then add unmatched items as singletons.
    const clusterMap = new Map<number, number[]>();
    for (const [a, b] of pairs) {
      const root = a;
      const group = clusterMap.get(root) ?? [a];
      if (!group.includes(b)) group.push(b);
      clusterMap.set(root, group);
    }
    for (const index of bucket) {
      if (matched.has(index)) continue;
      clusters.push([items[index]]);
    }
    for (const group of clusterMap.values()) {
      clusters.push(group.map((index) => items[index]));
    }
  }

  return clusters;
}

function distinctKnownYears(entries: readonly CatalogEntry[]): number[] {
  return [...new Set(entries.map((entry) => entry.year).filter((year): year is number => typeof year === 'number'))];
}

function canMergeCluster(entries: readonly CatalogEntry[]): boolean {
  return distinctKnownYears(entries).length <= 1;
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

      const clusters = clusterEntries(allItems);
      const items: CatalogEntry[] = [];
      for (const cluster of clusters) {
        const base = cluster[0].entry;
        if (cluster.length === 1) {
          items.push(base);
          continue;
        }

        const clusterEntriesList = cluster.map((item) => item.entry);
        if (!canMergeCluster(clusterEntriesList)) {
          for (const item of cluster) items.push(item.entry);
          continue;
        }

        const voices = cluster.map((item) => makeVoiceOption(item.source, item.original));
        const uniqueVoices = voices.filter((voice, index, list) => list.findIndex((item) => item.sourceKey === voice.sourceKey) === index);
        if (uniqueVoices.length <= 1) {
          for (const item of cluster) items.push(item.entry);
          continue;
        }

        const groupAlias = `group:${cluster.map((item) => `${item.source.key}~${item.original.alias}`).join('|')}`;
        items.push(withVoices({ ...base, alias: groupAlias }, uniqueVoices));
      }

      const totalPages = Math.max(1, ...successes.map(({ result }) => result.totalPages));
      return { items, page, totalPages, incomplete: successes.length < selectedSources.length } satisfies CatalogResult;
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
      const successes = settled.filter((result): result is PromiseFulfilledResult<{ source: AnimeSource; entries: readonly ScheduleEntry[] }> => result.status === 'fulfilled');
      if (successes.length === 0 && sourcesWithSchedule.length > 0) {
        const firstFailure = settled.find((result) => result.status === 'rejected');
        throw firstFailure?.status === 'rejected' ? firstFailure.reason : new Error('Combined schedule: all sources failed');
      }
      return successes.flatMap((result) => result.value.entries.map((entry) => prefixScheduleEntry(result.value.source.key, entry)));
    },

    async getTitle(alias, signal) {
      // Group alias: fetch all variants listed in it.
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
          alias: first.alias,
          voices,
        };
      }

      // Single source alias.
      const resolved = resolveSource(availableSources, alias);
      let baseTitle: AnimeTitle | null = null;
      let baseSource: AnimeSource | undefined;
      let baseAlias = alias;

      if (resolved) {
        baseTitle = await resolved.source.getTitle(resolved.alias, signal);
        baseSource = resolved.source;
        baseAlias = prefixed(resolved.source.key, resolved.alias);
      } else {
        for (const source of availableSources) {
          try {
            baseTitle = await source.getTitle(alias, signal);
            if (baseTitle) {
              baseSource = source;
              baseAlias = prefixed(source.key, baseTitle.alias);
              break;
            }
          } catch {
            // Try next source.
          }
        }
      }

      if (!baseTitle || !baseSource) return null;

      // Search other sources for voice options without blocking the whole catalog (title page only).
      const voices = [makeVoiceOption(baseSource, baseTitle)];
      await Promise.allSettled(
        availableSources
          .filter((source) => source.key !== baseSource.key)
          .map(async (source) => {
            try {
              const result = await source.getCatalog(baseTitle!.name, 1, signal);
              const match = result.items.find((candidate) => sameAnime(candidate, baseTitle!));
              if (match) {
                const voice = makeVoiceOption(source, match);
                if (!voices.some((existing) => existing.sourceKey === voice.sourceKey)) voices.push(voice);
              }
            } catch {
              // Ignore.
            }
          }),
      );

      return {
        ...baseTitle,
        alias: baseAlias,
        voices: voices.length > 1 ? voices : undefined,
      };
    },

    async getRelated(title, signal) {
      // Resolve underlying source/alias/id for group titles.
      let source: AnimeSource | undefined;
      let originalAlias = title.alias;
      void originalAlias;
      let baseTitle = title;

      if (title.alias.startsWith('group:')) {
        const firstPart = title.alias.slice('group:'.length).split('|')[0];
        const [sourceKey, original] = firstPart.split('~');
        source = availableSources.find((item) => item.key === sourceKey);
        if (source && original) {
          originalAlias = original;
          baseTitle = { ...title, alias: original };
        }
      } else {
        const resolved = resolveSource(availableSources, title.alias);
        if (resolved) {
          source = resolved.source;
          originalAlias = resolved.alias;
          baseTitle = { ...title, alias: resolved.alias };
        }
      }

      if (!source) source = availableSources.find((item) => item.getRelated);
      if (!source?.getRelated) return { similar: [], franchises: [] };

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