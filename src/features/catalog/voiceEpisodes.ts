import type { Episode, EpisodeRange } from '../../sources/source';

function matchesRange(episodes: readonly Episode[], { count }: EpisodeRange) {
  return episodes.length === count && episodes.every(({ number }, index) => number === index + 1);
}

export function rangeContains({ first, count }: EpisodeRange, ordinal: number) {
  return Number.isInteger(ordinal) && ordinal >= first && ordinal < first + count;
}

export function voiceEpisodeNumber(episodes: readonly Episode[], index: number, range?: EpisodeRange) {
  const episode = episodes[index];
  if (!episode) return undefined;
  if (!range) return episode.number;
  return matchesRange(episodes, range) ? range.first + index : undefined;
}

export function voiceEpisodeIndex(episodes: readonly Episode[], ordinal: number, range?: EpisodeRange) {
  if (!range) return episodes.findIndex(({ number }) => number === ordinal);
  return rangeContains(range, ordinal) && matchesRange(episodes, range) ? ordinal - range.first : -1;
}
