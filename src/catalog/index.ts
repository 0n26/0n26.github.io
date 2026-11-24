import { directSources, indexedSources } from '../sources';
import { createCatalog } from './catalog';
import { gatewaySource } from './gatewaySource';
import { loadCatalogIndex } from './loadCatalogIndex';

export const catalog = createCatalog(
  indexedSources.map(({ source }) => gatewaySource(source)),
  loadCatalogIndex,
  directSources.map(gatewaySource),
);
