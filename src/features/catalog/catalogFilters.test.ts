import { expect, it } from 'vitest';
import { MAX_GENRES, catalogParams, filterKey, parseCatalogFilters, parseGenreIds, positiveParam } from './catalogFilters';

it('parses repeated and comma-separated genre params, deduplicating invalid ids', () => {
  expect(parseGenreIds('15,1,15,0,abc,,8')).toEqual([15, 1, 8]);
  expect(parseGenreIds('')).toBeUndefined();
  expect(parseGenreIds('0,abc')).toBeUndefined();
  expect(parseGenreIds('9007199254740993')).toBeUndefined();
});

it('limits the number of selectable genres', () => {
  const ids = Array.from({ length: MAX_GENRES + 5 }, (_, index) => index + 1).join(',');
  expect(parseGenreIds(ids)).toHaveLength(MAX_GENRES);
});

it('parses all catalog filters from the URL and keeps old year links working', () => {
  const filters = parseCatalogFilters(new URLSearchParams(
    'q=Фрирен&page=2&genre=1&genre=8&type=TV&type=WEB&status=IS_ONGOING'
    + '&sort=RATING_DESC&season=winter&season=autumn&yearFrom=2000&yearTo=2010&age=R12_PLUS&age=R16_PLUS',
  ));
  expect(filters).toEqual({
    genres: [1, 8],
    types: ['TV', 'WEB'],
    publishStatuses: ['IS_ONGOING'],
    sorting: 'RATING_DESC',
    seasons: ['winter', 'autumn'],
    yearFrom: 2000,
    yearTo: 2010,
    ageRatings: ['R12_PLUS', 'R16_PLUS'],
  });
  expect(parseCatalogFilters(new URLSearchParams('year=2023&type=TV,OVA, TV'))).toMatchObject({
    yearFrom: 2023, yearTo: 2023, types: ['TV', 'OVA'],
  });
});

it('serializes filters into stable shareable params and resets the page', () => {
  const params = catalogParams('Фрирен', 1, {
    genres: [1, 8],
    types: ['TV', 'WEB'],
    publishStatuses: ['IS_ONGOING'],
    sorting: 'RATING_DESC',
    seasons: ['winter', 'autumn'],
    yearFrom: 2000,
    yearTo: 2010,
    ageRatings: ['R12_PLUS', 'R16_PLUS'],
  });
  expect([...params.entries()]).toEqual([
    ['q', 'Фрирен'], ['genre', '1'], ['genre', '8'], ['type', 'TV'], ['type', 'WEB'],
    ['status', 'IS_ONGOING'], ['sort', 'RATING_DESC'], ['season', 'winter'], ['season', 'autumn'],
    ['yearFrom', '2000'], ['yearTo', '2010'], ['age', 'R12_PLUS'], ['age', 'R16_PLUS'],
  ]);
  expect(catalogParams('', 3, {}).get('page')).toBe('3');
  expect(catalogParams('', 1, { yearFrom: 2023, yearTo: 2023 }).get('year')).toBe('2023');
  expect(positiveParam('01')).toBeUndefined();
});

it('keeps filter key independent of search text and page number', () => {
  const params = new URLSearchParams('q=Фрирен&page=2&genre=1&yearTo=2010');
  expect(filterKey(params)).toBe('genre=1&yearTo=2010');
});
