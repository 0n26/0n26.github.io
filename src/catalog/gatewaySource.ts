import { readApi } from '../api';
import { catalogParams } from '../routes/catalogFilters';
import type { AnimeSource } from '../sources/source';

export function gatewaySource(source: AnimeSource): AnimeSource {
  const base = `/api/sources/${encodeURIComponent(source.key)}`;
  return {
    key: source.key,
    name: source.name,
    getCatalog: (query, page, signal, filters = {}) => readApi(`${base}/catalog?${catalogParams(query, page, filters)}`, signal),
    getTitle: (alias, signal) => readApi(`${base}/title?${new URLSearchParams({ alias })}`, signal, null),
    ...(source.getCatalogFilters && { getCatalogFilters: signal => readApi(`${base}/filters`, signal) }),
    ...(source.getSchedule && { getSchedule: signal => readApi(`${base}/schedule`, signal) }),
    ...(source.getRelated && {
      getRelated: ({ alias, id }, signal) => readApi(`${base}/related?${new URLSearchParams({ alias, id: String(id ?? '') })}`, signal),
    }),
  };
}
