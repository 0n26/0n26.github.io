import { positiveInteger } from './values.ts';

// Canonical codes shared by catalog URLs and source adapters.
export const catalogFilterValues = {
  types: { TV: true, ONA: true, WEB: true, OVA: true, OAD: true, MOVIE: true, DORAMA: true, SPECIAL: true },
  publishStatuses: { IS_ONGOING: true, IS_NOT_ONGOING: true },
  sorting: { FRESH_AT_DESC: true, FRESH_AT_ASC: true, RATING_DESC: true, RATING_ASC: true, YEAR_DESC: true, YEAR_ASC: true },
  seasons: { winter: true, spring: true, summer: true, autumn: true },
  ageRatings: { R0_PLUS: true, R6_PLUS: true, R12_PLUS: true, R16_PLUS: true, R18_PLUS: true },
} as const;

export function normalizeCatalogYears(from?: number, to?: number) {
  const yearFrom = positiveInteger(from) ? from : undefined;
  const yearTo = positiveInteger(to) ? to : undefined;
  return yearFrom && yearTo && yearFrom > yearTo
    ? { yearFrom: yearTo, yearTo: yearFrom }
    : { yearFrom, yearTo };
}
