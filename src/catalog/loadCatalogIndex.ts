import { catalogIndexMaxAge, parseCatalogIndex } from '../sources/catalogIndex';
import type { CatalogIndex } from '../sources/catalogIndex';

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
        nextCheck = index ? Math.min(index.generatedAt + catalogIndexMaxAge, now + 60 * 60 * 1000) : now + 60 * 1000;
        return index;
      });
  }
  return request;
}
