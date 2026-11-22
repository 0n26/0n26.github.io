import { createAniLiberty } from './aniliberty';
import { createAnimeVost } from './animevost';
import type { AnimeSource } from './source';

export const catalogSources: readonly AnimeSource[] = [createAniLiberty(), createAnimeVost()];
export const directSources: readonly AnimeSource[] = [];
