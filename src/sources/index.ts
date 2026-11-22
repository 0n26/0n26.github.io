import { createAniLiberty, openAniLibertyIndex } from './aniliberty.ts';
import { createAnimeVost, openAnimeVostIndex } from './animevost.ts';
import type { IndexedSource } from './indexSource.ts';
import type { AnimeSource } from './source.ts';

export const indexedSources: readonly IndexedSource[] = [
  { source: createAniLiberty(), openIndex: openAniLibertyIndex },
  { source: createAnimeVost(), openIndex: openAnimeVostIndex },
];
export const directSources: readonly AnimeSource[] = [];
