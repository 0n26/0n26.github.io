import type { CatalogIndex } from '../sources/catalogIndex';
import { hasCatalogFilters } from '../sources/source';
import type { AnimeSource, AnimeTitle, CatalogEntry, CatalogFilters, CatalogFilterOptions, CatalogResult, EpisodeRange, RelatedInfo, ScheduleEntry } from '../sources/source';
import { catalogSourceKey, catalogTitleAlias, parseVoiceAlias, qualifyTitle } from './titleRef';
import type { TitleRef } from './titleRef';

export interface ResolvedTitle extends AnimeTitle {
  ref: TitleRef;
}

export interface VoiceOption {
  alias: string;
  sourceKey: string;
  source: string;
  episodeRange?: EpisodeRange;
}

export interface TitleAccess {
  name: string;
  getTitle(alias: string, signal: AbortSignal): Promise<ResolvedTitle | null>;
  getRelated?(title: ResolvedTitle, signal: AbortSignal): Promise<RelatedInfo>;
  getVoices?(alias: string, signal: AbortSignal): Promise<readonly VoiceOption[]>;
}

function prefixEntry<T extends CatalogEntry>(sourceKey: string, entry: T): T {
  return { ...entry, alias: qualifyTitle(sourceKey, entry.alias) };
}

const pageSize = 48;

async function loadTitle(source: AnimeSource, alias: string, signal: AbortSignal, combined = false): Promise<ResolvedTitle | null> {
  const title = await source.getTitle(alias, signal);
  if (!title) return null;
  return {
    ...title,
    alias: combined ? qualifyTitle(source.key, title.alias) : title.alias,
    ref: { sourceKey: source.key, alias: title.alias },
  };
}

export function createCatalog(
  sources: readonly AnimeSource[],
  loadIndex: () => Promise<CatalogIndex | null>,
  directSources: readonly AnimeSource[] = [],
) {
  const catalogSources = new Map(sources.map((source) => [source.key, source]));
  const availableSources = [...catalogSources.values()];
  // Catalog URLs carry provider-local genre IDs; both operations must use the same provider.
  const filterSource = catalogSources.get('aniliberty');
  const name = 'Общий каталог';

  const titles = new Map<string, TitleAccess>();
  for (const source of [...availableSources, ...directSources]) {
    titles.set(source.key, {
      name: source.name,
      getTitle: (alias, signal) => loadTitle(source, alias, signal),
      getRelated: source.getRelated?.bind(source),
    });
  }

  titles.set(catalogSourceKey, {
    name,
    async getTitle(alias, signal) {
      const ref = parseVoiceAlias(catalogTitleAlias(alias));
      const source = ref && catalogSources.get(ref.sourceKey);
      return ref && source ? loadTitle(source, ref.alias, signal, true) : null;
    },

    async getVoices(alias, signal) {
      signal.throwIfAborted();
      const index = await loadIndex();
      signal.throwIfAborted();
      const base = catalogTitleAlias(alias);
      const release = index?.byAlias.get(base);
      const voices = release?.flatMap((entry, position) => {
        const ref = parseVoiceAlias(entry.alias);
        const source = ref && catalogSources.get(ref.sourceKey);
        if (!source) return [];
        const label = release.length === 3 && position < 2 ? `${source.name} · Часть ${position + 1}` : source.name;
        return [{ alias: entry.alias, sourceKey: source.key, source: label, ...(entry.episodeRange && { episodeRange: entry.episodeRange }) }];
      }) ?? [];
      const basePosition = voices.findIndex((voice) => voice.alias === base);
      if (basePosition > 0) voices.unshift(...voices.splice(basePosition, 1));
      return voices;
    },

    async getRelated(title, signal) {
      const source = catalogSources.get(title.ref.sourceKey);
      if (!source?.getRelated) return { similar: [] };
      const info = await source.getRelated({ alias: title.ref.alias, id: title.id }, signal);
      return {
        similar: info.similar.map((entry) => prefixEntry(source.key, entry)),
        franchises: info.franchises?.map((franchise) => ({
          ...franchise,
          releases: franchise.releases.map((release) => prefixEntry(source.key, release)),
        })),
      };
    },
  });

  return {
    name,
    getTitleAccess: (sourceKey: string) => titles.get(sourceKey),

    async getCatalog(query: string, page: number, signal: AbortSignal, filters?: CatalogFilters): Promise<CatalogResult> {
      signal.throwIfAborted();
      const hasFilters = hasCatalogFilters(filters);
      const selectedSources = hasFilters
        ? filterSource?.getCatalogFilters ? [filterSource] : []
        : availableSources;

      const index = await loadIndex();
      signal.throwIfAborted();
      if (!hasFilters && index) {
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
        items: successes.flatMap(({ source, result }) => {
          if (page !== result.page || page > result.totalPages) return [];
          return result.items.flatMap((entry) => {
            const item = prefixEntry(source.key, entry);
            if (!index?.verifiedPlayback) return [item];
            const verified = index.byAlias.get(item.alias)?.find(variant => variant.alias === item.alias);
            return verified ? [verified] : [];
          });
        }),
        page,
        totalPages: Math.max(1, ...successes.map(({ result }) => result.totalPages)),
        incomplete: successes.length < selectedSources.length || successes.some(({ result }) => result.incomplete),
      };
    },

    async getCatalogFilters(signal: AbortSignal): Promise<CatalogFilterOptions> {
      try {
        signal.throwIfAborted();
        if (filterSource?.getCatalogFilters) {
          const options = await filterSource.getCatalogFilters(signal);
          signal.throwIfAborted();
          return options;
        }
      } catch (error) {
        signal.throwIfAborted();
        throw new Error('Catalog filter references unavailable', { cause: error });
      }
      throw new Error('Catalog filter references unavailable');
    },

    async getSchedule(signal: AbortSignal): Promise<readonly ScheduleEntry[]> {
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
  };
}