import type { VoiceOption } from '../../catalog/catalog';
import type { Episode, EpisodeRange } from '../../sources/source';

function matchesRange(episodes: readonly Episode[], { count }: EpisodeRange) {
  return episodes.length === count && episodes.every(({ number }, index) => number === index + 1);
}

function rangeContains({ first, count }: EpisodeRange, ordinal: number) {
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

export function selectWatchEpisode(
  episodes: readonly Episode[], id: string | null, pendingNumber: number | null, pendingRange?: EpisodeRange,
) {
  if (pendingNumber !== null) return voiceEpisodeIndex(episodes, pendingNumber, pendingRange);
  return id === null ? 0 : episodes.findIndex((episode) => episode.id === id);
}

export function voiceChoices(
  title: { alias: string; episodes: readonly Episode[] }, options: readonly VoiceOption[] | undefined, currentIndex: number,
) {
  const currentVoice = options?.find((option) => option.alias === title.alias);
  const ordinal = voiceEpisodeNumber(title.episodes, currentIndex, currentVoice?.episodeRange);
  const voices = currentVoice && options && options.length > 1 ? options : undefined;
  const choices = voices?.filter((option) => option === currentVoice || !option.episodeRange
    || (ordinal !== undefined && rangeContains(option.episodeRange, ordinal)));
  const starts = voices?.filter((option, _, siblings) => option !== currentVoice && option.episodeRange
    && (ordinal === undefined || siblings.some((other) => other !== option && other.sourceKey === option.sourceKey)));
  return { currentVoice, ordinal, choices, starts };
}
