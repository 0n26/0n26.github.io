import { createAniLiberty } from './aniliberty';
import type { AnimeSource } from './source';

export const defaultSource = createAniLiberty();

export const sources: readonly AnimeSource[] = [defaultSource];

export function getSource(key: string): AnimeSource | undefined {
  return sources.find((source) => source.key === key);
}
