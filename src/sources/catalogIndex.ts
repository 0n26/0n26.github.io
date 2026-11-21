import type { CatalogEntry, EpisodeRange } from './source';
import { positiveInteger, record, text } from './values.ts';

type IndexedEntry = CatalogEntry & { episodeRange?: EpisodeRange };

export const catalogIndexVersion = 2;

interface CatalogIndex {
  generatedAt: number;
  releases: readonly (readonly IndexedEntry[])[];
  byAlias: ReadonlyMap<string, readonly IndexedEntry[]>;
}

const maxAge = 7 * 24 * 60 * 60 * 1000;

export function parseCatalogIndex(value: unknown, now = Date.now()): CatalogIndex | null {
  const index = record(value);
  if (index?.version !== catalogIndexVersion || !positiveInteger(index.generatedAt) || index.generatedAt > now
    || now - index.generatedAt >= maxAge || !Array.isArray(index.releases) || index.releases.length === 0) return null;

  const releases: IndexedEntry[][] = [];
  const byAlias = new Map<string, readonly IndexedEntry[]>();
  for (const raw of index.releases) {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 3) return null;
    const release: IndexedEntry[] = [];
    for (const value of raw) {
      const entry = record(value);
      const alias = text(entry?.alias);
      const name = text(entry?.name);
      const provider = alias && /^([a-z][a-z0-9_-]*):[a-z0-9_-]+$/i.exec(alias)?.[1];
      if (!entry || !alias || !name || !provider || byAlias.has(alias)) return null;
      byAlias.set(alias, release);
      const alternateName = text(entry.alternateName);
      const searchName = text(entry.searchName);
      const poster = text(entry.poster);
      let episodeRange: EpisodeRange | undefined;
      if (entry.episodeRange !== undefined) {
        const range = record(entry.episodeRange);
        if (!positiveInteger(range?.first) || !positiveInteger(range?.count)
          || !Number.isSafeInteger(range.first + range.count)) return null;
        episodeRange = { first: range.first, count: range.count };
      }
      release.push({ alias, name, alternateName, searchName, episodeRange,
        year: positiveInteger(entry.year) ? entry.year : undefined, poster: poster?.startsWith('https://') ? poster : undefined });
    }
    if (release.length === 3) {
      const [first, second, complete] = release;
      const a = first.episodeRange, b = second.episodeRange, c = complete.episodeRange;
      const [firstProvider, secondProvider, fullProvider] = release.map(({ alias }) => alias.split(':', 1)[0]);
      if (!a || !b || !c || a.first !== 1 || b.first !== a.count + 1 || c.first !== 1
        || c.count !== a.count + b.count || firstProvider !== secondProvider || firstProvider === fullProvider) return null;
    } else if (release.some((entry) => entry.episodeRange)
      || (release.length === 2 && release[0].alias.split(':', 1)[0] === release[1].alias.split(':', 1)[0])) return null;
    releases.push(release);
  }
  return { generatedAt: index.generatedAt, releases, byAlias };
}

let request: Promise<CatalogIndex | null> | undefined;
let nextCheck = 0;

export function loadCatalogIndex(): Promise<CatalogIndex | null> {
  if (!request || Date.now() >= nextCheck) {
    nextCheck = Infinity;
    request = fetch(`${import.meta.env.BASE_URL}catalog-index.json`, {
      cache: 'no-cache', signal: AbortSignal.timeout(4000),
    }).then(async (response) => response.ok ? parseCatalogIndex(await response.json()) : null)
      .catch(() => null)
      .then((index) => {
        const now = Date.now();
        nextCheck = index ? Math.min(index.generatedAt + maxAge, now + 60 * 60 * 1000) : now + 60 * 1000;
        return index;
      });
  }
  return request;
}
