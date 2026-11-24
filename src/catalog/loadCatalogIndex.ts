import { readApi } from '../api';
import { catalogIndexMaxAge, parseCatalogIndex } from '../sources/catalogIndex';
import type { CatalogIndex } from '../sources/catalogIndex';

let request: Promise<CatalogIndex | null> | undefined;
let nextCheck = 0;

export function loadCatalogIndex(): Promise<CatalogIndex | null> {
  if (!request || Date.now() >= nextCheck) {
    nextCheck = Infinity;
    request = readApi<unknown>('/api/catalog-index', AbortSignal.timeout(4000), null).then(parseCatalogIndex)
      .catch(() => null)
      .then((index) => {
        const now = Date.now();
        nextCheck = index ? Math.min(index.generatedAt + catalogIndexMaxAge, now + 60 * 60 * 1000) : now + 60 * 1000;
        return index;
      });
  }
  return request;
}
