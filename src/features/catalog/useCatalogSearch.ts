import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { catalog } from '../../catalog';
import type { CatalogFilters } from '../../sources/source';
import { catalogParams, filterKey, parseCatalogFilters, positiveParam } from './catalogFilters';
import { useSourceRequest } from './useSourceRequest';

export function useCatalogSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const page = positiveParam(params.get('page')) ?? 1;
  const filtersKey = filterKey(params);
  const filters = useMemo(() => parseCatalogFilters(new URLSearchParams(filtersKey)), [filtersKey]);
  const load = useCallback((signal: AbortSignal) => catalog.getCatalog(query, page, signal, filters), [query, page, filters]);
  const results = useSourceRequest(load);
  const references = useSourceRequest(catalog.getCatalogFilters);

  function search(nextQuery: string) {
    setParams(catalogParams(nextQuery.trim(), 1, filters));
  }

  function applyFilters(nextFilters: CatalogFilters) {
    setParams(catalogParams(query, 1, nextFilters));
  }

  function changePage(nextPage: number) {
    setParams(catalogParams(query, nextPage, filters));
  }

  return { query, filtersKey, filters, results, references, search, applyFilters, changePage };
}
