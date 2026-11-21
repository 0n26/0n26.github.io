import type { CatalogFilters } from '../../sources/source';

export const MAX_GENRES = 8;
const MAX_VALUES = 16;

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

function parseValues(values: readonly string[]): readonly string[] | undefined {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const item of value.split(',')) {
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      result.push(trimmed);
      if (result.length === MAX_VALUES) return result;
    }
  }
  return result.length ? result : undefined;
}

function parseYears(params: URLSearchParams): Pick<CatalogFilters, 'yearFrom' | 'yearTo'> {
  // Old links used a single ?year=2023 and meant an exact year.
  const legacy = positiveParam(params.get('year'));
  const from = positiveParam(params.get('yearFrom')) ?? legacy;
  const to = positiveParam(params.get('yearTo')) ?? legacy;
  return { yearFrom: from, yearTo: to };
}

export function filterKey(params: URLSearchParams): string {
  const next = new URLSearchParams(params);
  next.delete('q');
  next.delete('page');
  return next.toString();
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  return {
    genres: parseGenreIds(params.getAll('genre').join(',')),
    types: parseValues(params.getAll('type')),
    publishStatuses: parseValues(params.getAll('status')),
    sorting: params.get('sort')?.trim() || undefined,
    seasons: parseValues(params.getAll('season')),
    ...parseYears(params),
    ageRatings: parseValues(params.getAll('age')),
  };
}

export function catalogParams(query: string, page: number, filters: CatalogFilters): URLSearchParams {
  const next = new URLSearchParams();
  if (query) next.set('q', query);
  if (page > 1) next.set('page', String(page));
  for (const id of filters.genres ?? []) next.append('genre', String(id));
  for (const value of filters.types ?? []) next.append('type', value);
  for (const value of filters.publishStatuses ?? []) next.append('status', value);
  if (filters.sorting) next.set('sort', filters.sorting);
  for (const value of filters.seasons ?? []) next.append('season', value);
  if (filters.yearFrom && filters.yearFrom === filters.yearTo) {
    next.set('year', String(filters.yearFrom));
  } else {
    if (filters.yearFrom) next.set('yearFrom', String(filters.yearFrom));
    if (filters.yearTo) next.set('yearTo', String(filters.yearTo));
  }
  for (const value of filters.ageRatings ?? []) next.append('age', value);
  return next;
}
