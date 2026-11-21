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

function literalKeys(entry: CatalogEntry): string[] {
  if (entry.year === undefined) return [];
  const name = normalizeName(entry.name);
  const alternate = normalizeName(entry.alternateName);
  const keys = [];
  if (name) keys.push(`${entry.year}:${name}`);
  if (alternate && alternate !== name) keys.push(`${entry.year}:${alternate}`);
  return keys;
}

function makeVoiceOption(source: AnimeSource, entry: CatalogEntry): VoiceOption {
  return {
    source: source.name,
    sourceKey: source.key,
    alias: prefixed(source.key, entry.alias),
    name: entry.name,
  };
}

interface CatalogItem {
  source: AnimeSource;
  entry: CatalogEntry;
  page: number;
  order: number;
  keys: readonly string[];
}

interface ProviderPages {
  pages: Map<number, CatalogResult>;
  totalPages: number;
}

function uniqueCatalogMatch(item: CatalogItem, byKey: ReadonlyMap<string, readonly CatalogItem[]>): CatalogItem | undefined {
  let match: CatalogItem | undefined;
  for (const key of item.keys) {
    for (const candidate of byKey.get(key) ?? []) {
      if (candidate.source.key === item.source.key || candidate === match) continue;
      if (match) return;
      match = candidate;
    }
  }
  return match;
}

async function uniqueSearchMatch(
  source: AnimeSource, target: CatalogEntry, cached: ProviderPages | undefined, signal: AbortSignal, expected?: CatalogEntry,
): Promise<CatalogEntry | undefined> {
  const keys = literalKeys(target);
  if (!keys.length) return;

  let match = expected;
  function consider(entries: readonly CatalogEntry[]): boolean {
    for (const entry of entries) {
      if (entry.alias === match?.alias || !literalKeys(entry).some((key) => keys.includes(key))) continue;
      if (match) return false;
      match = entry;
    }
    return true;
  }

  if (cached) {
    for (const [page, result] of cached.pages) {
      if (page <= cached.totalPages && !consider(result.items)) return;
    }
  }
  for (const query of new Set([target.name, target.alternateName])) {
    if (!query) continue;
    for (let page = 1, totalPages = 1; page <= totalPages; page += 1) {
      signal.throwIfAborted();
      const result = await source.getCatalog(query, page, signal);
      if (result.incomplete || !consider(result.items)) return;
      totalPages = result.totalPages;
    }
  }
  return match;
}

export function createCombinedSource(sources: readonly AnimeSource[]): AnimeSource {
  const availableSources = [...sources];
  let activeCatalog: { key: string; providers: Map<AnimeSource, ProviderPages> } | undefined;

  return {
    key: 'combined',
    name: 'Общий каталог',

    async getCatalog(query, page, signal, filters) {
      signal.throwIfAborted();
      const hasFilters = Boolean(filters?.genre || filters?.year);
      const selectedSources = hasFilters
        ? availableSources.filter((source) => source.getCatalogFilters)
        : availableSources;
      const key = JSON.stringify([query, filters?.genre, filters?.year]);
      if (activeCatalog?.key !== key) activeCatalog = { key, providers: new Map() };
      const { providers } = activeCatalog;

      if (selectedSources.length === 0) return { items: [], page, totalPages: 1 };

      const singleSource = selectedSources.length === 1;
      const settled = await Promise.allSettled(selectedSources.map(async (source) => {
        let cached = providers.get(source);
        if (!cached) {
          cached = { pages: new Map(), totalPages: Infinity };
          providers.set(source, cached);
        }
        for (let current = singleSource ? page : 1; current <= page && current <= cached.totalPages; current += 1) {
          if (cached.pages.has(current)) continue;
          signal.throwIfAborted();
          const result = await source.getCatalog(query, current, signal, hasFilters ? filters : undefined);
          signal.throwIfAborted();
          cached.pages.set(current, result);
          cached.totalPages = result.totalPages;
        }
        return { source, ...cached };
      }));
      signal.throwIfAborted();
      const successes = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
      if (successes.length === 0) {
        const firstFailure = settled.find((result) => result.status === 'rejected');
        throw firstFailure?.status === 'rejected' ? firstFailure.reason : new Error('Combined catalog: all sources failed');
      }

      const totalPages = Math.max(1, ...successes.map((result) => result.totalPages));
      let incomplete = successes.length < selectedSources.length;
      if (singleSource) {
        const { source, pages } = successes[0];
        const result = page <= totalPages ? pages.get(page) : undefined;
        return {
          items: result?.items.map((entry) => prefixEntry(source.key, entry)) ?? [],
          page, totalPages, incomplete: incomplete || Boolean(result?.incomplete),
        };
      }

      const byKey = new Map<string, CatalogItem[]>();
      const currentItems: CatalogItem[] = [];
      for (const source of selectedSources) {
        const cached = providers.get(source);
        if (!cached) continue;
        const { pages, totalPages: limit } = cached;
        for (let current = 1; current <= page && current <= limit; current += 1) {
          const result = pages.get(current);
          if (!result) continue;
          incomplete ||= Boolean(result.incomplete);
          for (const entry of result.items) {
            const item = { source, entry, page: current, order: currentItems.length, keys: literalKeys(entry) };
            if (current === page) currentItems.push(item);
            for (const literal of item.keys) {
              const bucket = byKey.get(literal);
              if (bucket) bucket.push(item);
              else byKey.set(literal, [item]);
            }
          }
        }
      }

      const items: CatalogEntry[] = [];
      for (const item of currentItems) {
        const { source, entry } = item;
        const match = uniqueCatalogMatch(item, byKey);
        if (!match || uniqueCatalogMatch(match, byKey) !== item) {
          items.push(prefixEntry(source.key, entry));
        } else if (match.page === page && item.order < match.order) {
          const voices = [makeVoiceOption(source, entry), makeVoiceOption(match.source, match.entry)];
          const alias = `group:${source.key}~${entry.alias}|${match.source.key}~${match.entry.alias}`;
          items.push({ ...entry, alias, voices });
        }
      }
      return { items, page, totalPages, incomplete } satisfies CatalogResult;
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
      signal.throwIfAborted();
      // Group alias: fetch all variants listed in it.
      if (alias.startsWith('group:')) {
        const titles = await Promise.allSettled(alias.slice('group:'.length).split('|').map(async (part) => {
          const separator = part.indexOf('~');
          if (separator <= 0) return null;
          const sourceKey = part.slice(0, separator);
          const source = availableSources.find((item) => item.key === sourceKey);
          if (!source) return null;
          const title = await source.getTitle(part.slice(separator + 1), signal);
          return title ? { source, title } : null;
        }));
        signal.throwIfAborted();
        const voices: VoiceOption[] = [];
        let first: AnimeTitle | undefined;
        for (const result of titles) {
          if (result.status !== 'fulfilled' || !result.value) continue;
          const { source, title } = result.value;
          first ??= title;
          voices.push(makeVoiceOption(source, title));
        }
        if (first) return { ...first, alias: voices[0].alias, voices };
        const firstFailure = titles.find((result) => result.status === 'rejected');
        if (firstFailure?.status === 'rejected') throw firstFailure.reason;
        return null;
      }

      let resolved = resolveSource(availableSources, alias);
      let title: AnimeTitle | null = null;
      if (resolved) {
        title = await resolved.source.getTitle(resolved.alias, signal);
      } else {
        for (const source of availableSources) {
          try {
            title = await source.getTitle(alias, signal);
            if (title) {
              resolved = { source, alias: title.alias };
              break;
            }
          } catch {
            signal.throwIfAborted();
            // Try next source.
          }
        }
      }
      signal.throwIfAborted();
      if (!title || !resolved) return null;

      const baseTitle = title;
      const baseSource = resolved.source;
      const baseVoice = makeVoiceOption(baseSource, baseTitle);
      const voices = [baseVoice];
      const cached = activeCatalog?.providers;
      if (baseTitle.year !== undefined) {
        const variants = await Promise.allSettled(availableSources
          .filter((source) => source.key !== baseSource.key)
          .map(async (source) => {
            const match = await uniqueSearchMatch(source, baseTitle, cached?.get(source), signal);
            if (!match) return;
            // The other title must also resolve uniquely back to this one.
            const reverse = await uniqueSearchMatch(baseSource, match, cached?.get(baseSource), signal, baseTitle);
            if (reverse?.alias === baseTitle.alias) return makeVoiceOption(source, match);
          }));
        signal.throwIfAborted();
        for (const variant of variants) {
          if (variant.status === 'fulfilled' && variant.value) voices.push(variant.value);
        }
      }

      return { ...baseTitle, alias: baseVoice.alias, voices: voices.length > 1 ? voices : undefined };
    },

    async getRelated(title, signal) {
      const resolved = resolveSource(availableSources, title.alias);
      const source = resolved?.source ?? availableSources.find((item) => item.getRelated);
      if (!source?.getRelated) return { similar: [], franchises: [] };

      const info = await source.getRelated(resolved ? { ...title, alias: resolved.alias } : title, signal);

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