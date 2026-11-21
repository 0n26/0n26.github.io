import { expect, it } from 'vitest';
import type { Episode } from '../../sources/source';
import { voiceEpisodeIndex, voiceEpisodeNumber } from './voiceEpisodes';

function playlist(alias: string, count: number): Episode[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${alias}:${index + 1}`, number: index + 1, streams: [] }));
}

it.each([36, 11])('switches the same episode in both directions across the %i-episode part boundary', (boundary) => {
  const whole = { first: 1, count: boundary + 11 };
  const first = { first: 1, count: boundary };
  const second = { first: boundary + 1, count: 11 };
  const wholeEpisodes = playlist('whole', whole.count);
  const firstEpisodes = playlist('first', first.count);
  const secondEpisodes = playlist('second', second.count);

  const lastInFirst = voiceEpisodeNumber(wholeEpisodes, boundary - 1, whole)!;
  expect(firstEpisodes[voiceEpisodeIndex(firstEpisodes, lastInFirst, first)]?.id).toBe(`first:${boundary}`);
  expect(voiceEpisodeIndex(secondEpisodes, lastInFirst, second)).toBe(-1);
  const lastFromFirst = voiceEpisodeNumber(firstEpisodes, boundary - 1, first)!;
  expect(wholeEpisodes[voiceEpisodeIndex(wholeEpisodes, lastFromFirst, whole)]?.id).toBe(`whole:${boundary}`);

  const firstInSecond = voiceEpisodeNumber(wholeEpisodes, boundary, whole)!;
  expect(secondEpisodes[voiceEpisodeIndex(secondEpisodes, firstInSecond, second)]?.id).toBe('second:1');
  expect(voiceEpisodeIndex(firstEpisodes, firstInSecond, first)).toBe(-1);
  const firstFromSecond = voiceEpisodeNumber(secondEpisodes, 0, second)!;
  expect(wholeEpisodes[voiceEpisodeIndex(wholeEpisodes, firstFromSecond, whole)]?.id).toBe(`whole:${boundary + 1}`);
});

it.each([
  ['globally numbered', [37, 38, 39]],
  ['out of order', [2, 1, 3]],
  ['duplicated', [1, 2, 2]],
  ['shorter', [1, 2]],
  ['longer', [1, 2, 3, 4]],
] as const)('rejects a %s ranged playlist at either end of the switch', (_, numbers) => {
  const range = { first: 37, count: 3 };
  const episodes = playlist('drift', numbers.length).map((episode, index) => ({ ...episode, number: numbers[index] }));
  expect(voiceEpisodeNumber(episodes, 0, range)).toBeUndefined();
  expect(voiceEpisodeIndex(episodes, 37, range)).toBe(-1);
});

it('keeps matching by episode number for ordinary voice pairs', () => {
  const special = { id: 'special', number: 5.5, streams: [] };
  const ordinal = voiceEpisodeNumber([special], 0)!;
  expect(voiceEpisodeIndex([...playlist('regular', 2), special], ordinal)).toBe(2);
  expect(voiceEpisodeIndex(playlist('regular', 2), ordinal)).toBe(-1);
});
