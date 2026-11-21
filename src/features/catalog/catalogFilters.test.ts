import { expect, it } from 'vitest';
import { MAX_GENRES, catalogParams, parseGenreIds, positiveParam } from './catalogFilters';

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

it('serializes filters into stable shareable params and resets the page', () => {
  const params = catalogParams('Фрирен', 1, { genres: [1, 8], year: 2023 });
  expect([...params.entries()]).toEqual([
    ['q', 'Фрирен'], ['genre', '1'], ['genre', '8'], ['year', '2023'],
  ]);
  expect(catalogParams('', 3, {}).get('page')).toBe('3');
  expect(positiveParam('01')).toBeUndefined();
});
