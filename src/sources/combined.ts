import type { loadCatalogIndex } from './catalogIndex';
import { hasCatalogFilters } from './source';
import type { AnimeSource, CatalogEntry, CatalogOption, RelatedInfo, ScheduleEntry } from './source';

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
      const hasFilters = hasCatalogFilters(filters);
      const selectedSources = hasFilters
        ? availableSources.filter((source) => source.getCatalogFilters)
        : availableSources;

      if (!hasFilters) {
        const index = await loadIndex();
        signal.throwIfAborted();
        if (index) {
          const search = query.toLowerCase();
          const releases = search ? index.releases.filter((variants) => variants.some(({ name, alternateName }) =>
            name.toLowerCase().includes(search) || alternateName?.toLowerCase().includes(search),
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
      const options = {
        types: new Map<string, CatalogOption>(),
        publishStatuses: new Map<string, CatalogOption>(),
        sorting: new Map<string, CatalogOption>(),
        seasons: new Map<string, CatalogOption>(),
        ageRatings: new Map<string, CatalogOption>(),
      };
      for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const genre of result.value.genres) genres.set(genre.id, genre.name);
        for (const year of result.value.years) years.add(year);
        for (const key of Object.keys(options) as (keyof typeof options)[]) {
          for (const option of result.value[key]) options[key].set(option.value, option);
        }
      }
      return {
        genres: [...genres].map(([id, name]) => ({ id, name })),
        years: [...years].sort((a, b) => b - a),
        types: [...options.types.values()],
        publishStatuses: [...options.publishStatuses.values()],
        sorting: [...options.sorting.values()],
        seasons: [...options.seasons.values()],
        ageRatings: [...options.ageRatings.values()],
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
      const voices = index?.byAlias.get(base)?.flatMap((entry) => {
        const resolved = resolveSource(availableSources, entry.alias);
        return resolved ? [{ alias: entry.alias, source: resolved.source.name }] : [];
      }) ?? [];
      if (voices[1]?.alias === base) voices.reverse();
      return voices;
    },

    async getRelated(title, signal) {
      const resolved = resolveSource(availableSources, title.alias);
      if (!resolved?.source.getRelated) return { similar: [], franchises: [] };
      const { source, alias } = resolved;
      const info = await resolved.source.getRelated({ ...title, alias }, signal);

      return {
        similar: info.similar.map((entry) => prefixEntry(source.key, entry)),
        franchises: info.franchises.map((franchise) => ({
          ...franchise,
          releases: franchise.releases.map((release) => prefixEntry(source.key, release)),
        })),
      } satisfies RelatedInfo;
    },
  };
}