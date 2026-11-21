import type { loadCatalogIndex } from './catalogIndex';
import type { AnimeSource, CatalogEntry, RelatedInfo, ScheduleEntry } from './source';

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

function prefixEntry<T extends CatalogEntry>(sourceKey: string, entry: T): T {
  return { ...entry, alias: prefixed(sourceKey, entry.alias) };
}

const pageSize = 48;

function indexedTitleAlias(alias: string) {
  if (!alias.startsWith('group:')) return alias;
  const primary = alias.slice('group:'.length).split('|', 1)[0];
  return primary.replace('~', ':');
}

export function createCombinedSource(sources: readonly AnimeSource[], loadIndex: typeof loadCatalogIndex): AnimeSource {
  const availableSources = [...sources];

  return {
    key: 'combined',
    name: 'Общий каталог',

    async getCatalog(query, page, signal, filters) {
      signal.throwIfAborted();
      const hasFilters = Boolean(filters?.genre || filters?.year);
      const selectedSources = hasFilters
        ? availableSources.filter((source) => source.getCatalogFilters)
        : availableSources;

      if (!hasFilters) {
        const index = await loadIndex();
        signal.throwIfAborted();
        if (index) {
          const search = query.toLowerCase();
          const releases = search ? index.releases.filter((variants) => variants.some(({ name, alternateName, searchName }) =>
            name.toLowerCase().includes(search) || alternateName?.toLowerCase().includes(search)
            || searchName?.toLowerCase().includes(search),
          )) : index.releases;
          return {
            items: releases.slice((page - 1) * pageSize, page * pageSize).map(([release]) => release),
            page,
            totalPages: Math.max(1, Math.ceil(releases.length / pageSize)),
          };
        }
      }

      if (selectedSources.length === 0) return { items: [], page, totalPages: 1 };
      const settled = await Promise.allSettled(selectedSources.map(async (source) => ({
        source, result: await source.getCatalog(query, page, signal, filters),
      })));
      signal.throwIfAborted();
      const successes = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      if (successes.length === 0) {
        throw settled.find((result) => result.status === 'rejected')?.reason;
      }
      return {
        items: successes.flatMap(({ source, result }) => page === result.page && page <= result.totalPages
          ? result.items.map((entry) => prefixEntry(source.key, entry)) : []),
        page,
        totalPages: Math.max(1, ...successes.map(({ result }) => result.totalPages)),
        incomplete: successes.length < selectedSources.length || successes.some(({ result }) => result.incomplete),
      };
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
      return successes.flatMap((result) => result.value.entries.map((entry) => prefixEntry(result.value.source.key, entry)));
    },

    async getTitle(alias, signal) {
      const resolved = resolveSource(availableSources, indexedTitleAlias(alias));
      if (!resolved) return null;
      const title = await resolved.source.getTitle(resolved.alias, signal);
      return title && prefixEntry(resolved.source.key, title);
    },

    async getVoices(alias, signal) {
      signal.throwIfAborted();
      const index = await loadIndex();
      signal.throwIfAborted();
      const base = indexedTitleAlias(alias);
      const release = index?.byAlias.get(base);
      const voices = release?.flatMap((entry, position) => {
        const resolved = resolveSource(availableSources, entry.alias);
        if (!resolved) return [];
        const source = release.length === 3 && position < 2 ? `${resolved.source.name} · Часть ${position + 1}` : resolved.source.name;
        return [{ alias: entry.alias, source, ...(entry.episodeRange && { episodeRange: entry.episodeRange }) }];
      }) ?? [];
      const basePosition = voices.findIndex((voice) => voice.alias === base);
      if (basePosition > 0) voices.unshift(...voices.splice(basePosition, 1));
      return voices;
    },

    async getRelated(title, signal) {
      const resolved = resolveSource(availableSources, title.alias);
      if (!resolved?.source.getRelated) return { similar: [] };
      const { source, alias } = resolved;
      const info = await resolved.source.getRelated({ ...title, alias }, signal);

      return {
        similar: info.similar.map((entry) => prefixEntry(source.key, entry)),
        franchises: info.franchises?.map((franchise) => ({
          ...franchise,
          releases: franchise.releases.map((release) => prefixEntry(source.key, release)),
        })),
      } satisfies RelatedInfo;
    },
  };
}