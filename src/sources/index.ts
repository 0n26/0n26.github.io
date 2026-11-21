import { createAniLiberty } from './aniliberty';
import { createAnimeVost } from './animevost';
import { createCombinedSource } from './combined';
import type { AnimeSource } from './source';

const registeredSources: readonly AnimeSource[] = [createAniLiberty(), createAnimeVost()];

export const sources: readonly AnimeSource[] = registeredSources;

export const defaultSource = createCombinedSource(registeredSources);

export { createAggregateSource, createCatalogSource, createCombinedSource, createMergedSource, createUnifiedSource } from './combined';
export { combineSources } from './combined';
export const createSourceCatalog = createCombinedSource;

export function getSource(key: string): AnimeSource | undefined {
  return sources.find((source) => source.key === key) ?? (key === defaultSource.key ? defaultSource : undefined);
}
