import { catalogFilterValues, normalizeCatalogYears } from '../../sources/catalogFilterValues';
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

function parseValues(values: readonly string[], allowed: Readonly<Record<string, true>>): readonly string[] | undefined {
  const result = new Set<string>();
  for (const value of values) {
    for (const item of value.split(',')) {
      const code = item.trim();
      if (Object.hasOwn(allowed, code)) result.add(code);
    }
  }
  return result.size ? [...result] : undefined;
}

function parseYears(params: URLSearchParams): Pick<CatalogFilters, 'yearFrom' | 'yearTo'> {
  // Old links used a single ?year=2023 and meant an exact year.
  const legacy = positiveParam(params.get('year'));
  return normalizeCatalogYears(
    positiveParam(params.get('yearFrom')) ?? legacy,
    positiveParam(params.get('yearTo')) ?? legacy,
  );
}

export function filterKey(params: URLSearchParams): string {
  const next = new URLSearchParams(params);
  next.delete('q');
  next.delete('page');
  return next.toString();
}

export function parseCatalogFilters(params: URLSearchParams): CatalogFilters {
  const sorting = params.get('sort')?.trim();
  return {
    genres: parseGenreIds(params.getAll('genre').join(',')),
    types: parseValues(params.getAll('type'), catalogFilterValues.types),
    publishStatuses: parseValues(params.getAll('status'), catalogFilterValues.publishStatuses),
    sorting: sorting && Object.hasOwn(catalogFilterValues.sorting, sorting) ? sorting : undefined,
    seasons: parseValues(params.getAll('season'), catalogFilterValues.seasons),
    ...parseYears(params),
    ageRatings: parseValues(params.getAll('age'), catalogFilterValues.ageRatings),
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
  const { yearFrom, yearTo } = normalizeCatalogYears(filters.yearFrom, filters.yearTo);
  if (yearFrom && yearFrom === yearTo) {
    next.set('year', String(yearFrom));
  } else {
    if (yearFrom) next.set('yearFrom', String(yearFrom));
    if (yearTo) next.set('yearTo', String(yearTo));
  }
  for (const value of filters.ageRatings ?? []) next.append('age', value);
  return next;
}
