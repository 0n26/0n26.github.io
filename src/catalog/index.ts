import { directSources, indexedSources } from '../sources';
import { createCatalog } from './catalog';
import { loadCatalogIndex } from './loadCatalogIndex';

export const catalog = createCatalog(indexedSources.map(({ source }) => source), loadCatalogIndex, directSources);
