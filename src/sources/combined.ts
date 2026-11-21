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
  const option: VoiceOption = {
    source: source.name,
    sourceKey: source.key,
    alias: prefixed(source.key, entry.alias),
    name: entry.name,
    label: source.name,
    studio: source.name,
    voice: source.name,
  };
  return option;
}

function withVoices(entry: CatalogEntry, voices: readonly VoiceOption[]): CatalogEntry {
  return {
    ...entry,
    variants: voices,
    voices,
    dubs: voices,
    studios: voices,
  };
}

export function createCombinedSource(sources: readonly AnimeSource[]): AnimeSource {
  const availableSources = [...sources];

  return {
    key: 'combined',
    name: 'Общий каталог',

    async getCatalog(query, page, signal, filters) {
      const results = await Promise.all(
        availableSources.map((source) => source.getCatalog(query, page, signal, filters)),
      );

      const allItems = results.flatMap((result, index) =>
        result.items.map((entry) => ({
          entry: prefixEntry(availableSources[index].key, entry),
          source: availableSources[index],
          original: entry,
        })),
      );

      // Group duplicates into clusters.
      const parent = allItems.map((_, index) => index);
      function find(value: number): number {
        while (parent[value] !== value) {
          parent[value] = parent[parent[value]];
          value = parent[value];
        }
        return value;
      }
      function union(a: number, b: number) {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) parent[rootA] = rootB;
      }

      for (let i = 0; i < allItems.length; i += 1) {
        for (let j = i + 1; j < allItems.length; j += 1) {
          if (sameAnime(allItems[i].entry, allItems[j].entry)) union(i, j);
        }
      }

      const clusters = new Map<number, typeof allItems>();
      allItems.forEach((item, index) => {
        const root = find(index);
        const cluster = clusters.get(root) ?? [];
        cluster.push(item);
        clusters.set(root, cluster);
      });

      const items: CatalogEntry[] = [];
      for (const cluster of clusters.values()) {
        if (cluster.length === 1) {
          items.push(cluster[0].entry);
          continue;
        }

        const voices = cluster.map((item) => makeVoiceOption(item.source, item.original));
        const groupAlias = `group:${cluster.map((item) => `${item.source.key}~${item.original.alias}`).join('|')}`;
        const base = cluster[0].entry;
        items.push(withVoices({ ...base, alias: groupAlias }, voices));
      }

      return {
        items,
        page,
        totalPages: Math.max(1, ...results.map((result) => result.totalPages)),
      } satisfies CatalogResult;
    },

    async getCatalogFilters(signal) {
      const sourcesWithFilters = availableSources.filter((source) => source.getCatalogFilters);
      const results = await Promise.all(sourcesWithFilters.map((source) => source.getCatalogFilters!(signal)));
      const genres = new Map<number, string>();
      const years = new Set<number>();

      for (const result of results) {
        for (const genre of result.genres) genres.set(genre.id, genre.name);
        for (const year of result.years) years.add(year);
      }

      return {
        genres: [...genres].map(([id, name]) => ({ id, name })),
        years: [...years].sort((a, b) => b - a),
      };
    },

    async getSchedule(signal) {
      const sourcesWithSchedule = availableSources.filter((source) => source.getSchedule);
      const results = await Promise.all(
        sourcesWithSchedule.map(async (source) => ({
          source,
          entries: await source.getSchedule!(signal),
        })),
      );

      return results.flatMap(({ source, entries }) =>
        entries.map((entry) => prefixScheduleEntry(source.key, entry)),
      );
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

        const titles = await Promise.all(
          variants.map(async ({ source, alias: variantAlias, originalAlias }) => {
            const title = await source.getTitle(originalAlias, signal);
            return title ? { source, title, alias: variantAlias } : null;
          }),
        );
        const availableTitles = titles.filter((item): item is { source: AnimeSource; title: AnimeTitle; alias: string } => Boolean(item));
        if (availableTitles.length === 0) return null;

        const voices = availableTitles.map(({ source, title, alias: variantAlias }) => ({
          source: source.name,
          sourceKey: source.key,
          alias: variantAlias,
          name: title.name,
          label: source.name,
          studio: source.name,
          voice: source.name,
        }));

        const first = availableTitles[0];
        return {
          ...first.title,
          alias,
          variants: voices,
          voices,
          dubs: voices,
          studios: voices,
        };
      }

      const resolved = resolveSource(availableSources, alias);
      if (resolved) {
        const title = await resolved.source.getTitle(resolved.alias, signal);
        if (!title) return null;
        return { ...title, alias: prefixed(resolved.source.key, title.alias) };
      }

      for (const source of availableSources) {
        const title = await source.getTitle(alias, signal);
        if (title) return { ...title, alias: prefixed(source.key, title.alias) };
      }
      return null;
    },

    async getRelated(title, signal) {
      const resolved = resolveSource(availableSources, title.alias);
      const source = resolved?.source ?? availableSources.find((item) => item.getRelated);
      if (!source?.getRelated) return { similar: [], franchises: [] };

      const originalTitle: AnimeTitle = {
        ...title,
        alias: resolved?.alias ?? title.alias,
      };
      const info = await source.getRelated(originalTitle, signal);

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

export const createUnifiedSource = createCombinedSource;
export const createCatalogSource = createCombinedSource;
export const createMergedSource = createCombinedSource;
export const createAggregateSource = createCombinedSource;
export const combineSources = createCombinedSource;