import { expect, it } from 'vitest';
import type { AnimeTitle } from '../../sources/source';
import { episodeCountText, titleMetaRows, watchTimeText } from './titleMeta';

const title: AnimeTitle = {
  alias: 'aniliberty:high-school-dxd',
  name: 'Демоны старшей школы',
  ageRating: '18+',
  publishStatus: 'Завершен',
  type: 'ТВ',
  season: 'Осень',
  genres: ['Комедия', 'Приключения', 'Романтика', 'Сёнен', 'Этти'],
  year: 2012,
  episodeDurationMinutes: 25,
  episodesTotal: 12,
  episodes: [],
};

it('formats episode counts with Russian plural rules', () => {
  expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111, 112, 115].map(episodeCountText)).toEqual([
    '1 эпизод', '2 эпизода', '4 эпизода', '5 эпизодов', '11 эпизодов', '12 эпизодов',
    '14 эпизодов', '21 эпизод', '22 эпизода', '25 эпизодов', '111 эпизодов', '112 эпизодов', '115 эпизодов',
  ]);
});

it('formats total watch time in hours and minutes', () => {
  expect([0, 1, 5, 21, 60, 61, 120, 160, 332].map(watchTimeText)).toEqual([
    '', '1 минута', '5 минут', '21 минута', '1 час', '1 час, 1 минута', '2 часа', '2 часа, 40 минут', '5 часов, 32 минуты',
  ]);
});

it('builds all title metadata rows in the about-section order', () => {
  expect(titleMetaRows(title)).toEqual([
    { label: 'Возраст', value: '18+' },
    { label: 'Статус', value: 'Завершен' },
    { label: 'Тип', value: 'ТВ' },
    { label: 'Сезон', value: 'Осень' },
    { label: 'Жанры', value: 'Комедия • Приключения • Романтика • Сёнен • Этти' },
    { label: 'Год выхода', value: '2012' },
    { label: 'Длительность', value: '~ 25 мин' },
    { label: 'Всего эпизодов', value: '12 эпизодов' },
    { label: 'Общее время просмотра', value: '5 часов' },
  ]);
});

it('omits metadata the source did not provide', () => {
  expect(titleMetaRows({ alias: 'x', name: 'X', episodes: [] })).toEqual([]);
  expect(titleMetaRows({ ...title, genres: [], season: '', episodesTotal: undefined, episodeDurationMinutes: undefined })).toEqual([
    { label: 'Возраст', value: '18+' },
    { label: 'Статус', value: 'Завершен' },
    { label: 'Тип', value: 'ТВ' },
    { label: 'Год выхода', value: '2012' },
  ]);
});

it('does not render watch time when only one of count and duration is known', () => {
  const withoutCount = titleMetaRows({ ...title, episodesTotal: undefined });
  expect(withoutCount.map(({ label }) => label)).toContain('Длительность');
  expect(withoutCount.map(({ label }) => label)).not.toContain('Всего эпизодов');
  expect(withoutCount.map(({ label }) => label)).not.toContain('Общее время просмотра');

  const withoutDuration = titleMetaRows({ ...title, episodeDurationMinutes: undefined });
  expect(withoutDuration.map(({ label }) => label)).toContain('Всего эпизодов');
  expect(withoutDuration.map(({ label }) => label)).not.toContain('Длительность');
  expect(withoutDuration.map(({ label }) => label)).not.toContain('Общее время просмотра');
});

it('ignores invalid counts instead of producing nonsense rows', () => {
  expect(titleMetaRows({ ...title, episodesTotal: 0, episodeDurationMinutes: -5, year: Number.NaN })).toEqual([
    { label: 'Возраст', value: '18+' },
    { label: 'Статус', value: 'Завершен' },
    { label: 'Тип', value: 'ТВ' },
    { label: 'Сезон', value: 'Осень' },
    { label: 'Жанры', value: 'Комедия • Приключения • Романтика • Сёнен • Этти' },
  ]);
});
