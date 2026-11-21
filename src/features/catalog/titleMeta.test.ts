import { expect, it } from 'vitest';
import type { AnimeTitle } from '../../sources/source';
import { episodeCountText, titleMetaRows, watchTimeText } from './titleMeta';

const title: AnimeTitle = {
  alias: 'hotaru-no-yomeiri',
  name: 'Свадьба светлячков',
  year: 2026,
  ageRating: '16+',
  publishStatus: 'Онгоинг',
  type: 'ТВ',
  season: 'Осень',
  genres: ['Исторический', 'Романтика'],
  episodesTotal: 12,
  episodeDurationMinutes: 24,
  episodes: [],
};

it('formats episode counts with Russian plural rules', () => {
  expect([1, 2, 5, 11, 21, 22].map(episodeCountText)).toEqual([
    '1 эпизод', '2 эпизода', '5 эпизодов', '11 эпизодов', '21 эпизод', '22 эпизода',
  ]);
});

it('formats total watch time in hours and minutes', () => {
  expect([160, 60, 61, 5, 120].map(watchTimeText)).toEqual([
    '2 часа, 40 минут', '1 час', '1 час, 1 минута', '5 минут', '2 часа',
  ]);
});

it('builds the title metadata rows in the requested order', () => {
  expect(titleMetaRows(title)).toEqual([
    { label: 'Возраст', value: '16+' },
    { label: 'Статус', value: 'Онгоинг' },
    { label: 'Тип', value: 'ТВ' },
    { label: 'Сезон', value: 'Осень' },
    { label: 'Жанры', value: 'Исторический • Романтика' },
    { label: 'Год выхода', value: '2026' },
    { label: 'Длительность', value: '~ 24 мин' },
    { label: 'Всего эпизодов', value: '12 эпизодов' },
    { label: 'Общее время просмотра', value: '4 часа, 48 минут' },
  ]);
});

it('omits metadata that the source did not provide', () => {
  expect(titleMetaRows({ alias: 'x', name: 'X', episodes: [] })).toEqual([]);
  expect(titleMetaRows({ ...title, ageRating: undefined, publishStatus: undefined, genres: [],
    episodesTotal: undefined, episodeDurationMinutes: undefined })).toEqual([
    { label: 'Тип', value: 'ТВ' },
    { label: 'Сезон', value: 'Осень' },
    { label: 'Год выхода', value: '2026' },
  ]);
});

it.each([
  [{ episodesTotal: undefined }, 'Длительность'],
  [{ episodeDurationMinutes: -24 }, 'Всего эпизодов'],
  [{ episodesTotal: Number.MAX_SAFE_INTEGER }, 'Всего эпизодов'],
] as const)('does not show a total for incomplete or invalid durations (%j)', (fields, remainingLabel) => {
  const rows = titleMetaRows({ ...title, ...fields });
  expect(rows.map(({ label }) => label)).toContain(remainingLabel);
  expect(rows.some(({ label }) => label === 'Общее время просмотра')).toBe(false);
});
