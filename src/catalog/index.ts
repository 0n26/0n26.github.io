import { catalogSources, directSources } from '../sources';
import { loadCatalogIndex } from '../sources/catalogIndex';
import { createCatalog } from './catalog';

export const catalog = createCatalog(catalogSources, loadCatalogIndex, directSources);
