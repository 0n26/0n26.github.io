import type { CatalogEntry } from './source';
import { positiveInteger, record, text } from './values.ts';

interface CatalogIndex {
  generatedAt: number;
  releases: readonly (readonly CatalogEntry[])[];
  byAlias: ReadonlyMap<string, readonly CatalogEntry[]>;
}

const maxAge = 7 * 24 * 60 * 60 * 1000;

export function parseCatalogIndex(value: unknown, now = Date.now()): CatalogIndex | null {
  const index = record(value);
  if (index?.version !== 1 || !positiveInteger(index.generatedAt) || index.generatedAt > now
    || now - index.generatedAt >= maxAge || !Array.isArray(index.releases) || index.releases.length === 0) return null;

  const releases: CatalogEntry[][] = [];
  const byAlias = new Map<string, readonly CatalogEntry[]>();
  for (const raw of index.releases) {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 2) return null;
    const release: CatalogEntry[] = [];
    const providers = new Set<string>();
    for (const value of raw) {
      const entry = record(value);
      const alias = text(entry?.alias);
      const name = text(entry?.name);
      const provider = alias && /^([a-z][a-z0-9_-]*):[a-z0-9_-]+$/i.exec(alias)?.[1];
      if (!entry || !alias || !name || !provider || providers.has(provider) || byAlias.has(alias)) return null;
      providers.add(provider);
      byAlias.set(alias, release);
      const alternateName = text(entry.alternateName);
      const poster = text(entry.poster);
      release.push({ alias, name, alternateName, year: positiveInteger(entry.year) ? entry.year : undefined,
        poster: poster?.startsWith('https://') ? poster : undefined });
    }
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
