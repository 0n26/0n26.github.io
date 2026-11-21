import type { CatalogFilters } from '../../sources/source';

export const MAX_GENRES = 8;

export function positiveParam(value: string | null | undefined): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return;
  const number = Number(value);
  if (Number.isSafeInteger(number)) return number;
}

export function parseGenreIds(key: string): readonly number[] | undefined {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const value of key.split(',')) {
    const id = positiveParam(value);
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length === MAX_GENRES) break;
  }
  return ids.length ? ids : undefined;
}

export function catalogParams(query: string, page: number, filters: CatalogFilters): URLSearchParams {
  const next = new URLSearchParams();
  if (query) next.set('q', query);
  if (page > 1) next.set('page', String(page));
  for (const id of filters.genres ?? []) next.append('genre', String(id));
  if (filters.year) next.set('year', String(filters.year));
  return next;
}
