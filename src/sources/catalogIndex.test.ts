import { expect, it } from 'vitest';
import { parseCatalogIndex } from './catalogIndex';

const now = Date.UTC(2026, 10, 22);

it('keeps about-section metadata in catalog index entries', () => {
  const index = parseCatalogIndex({
    version: 1,
    generatedAt: now - 1000,
    releases: [[{
      alias: 'aniliberty:high-school-dxd',
      name: 'Демоны старшей школы',
      year: 2012,
      ageRating: '18+',
      publishStatus: 'Завершен',
      type: 'ТВ',
      season: 'Осень',
      genres: ['Комедия', 'Этти'],
      episodesTotal: 12,
      episodeDurationMinutes: 25,
    }]],
  }, now);

  expect(index?.releases[0][0]).toMatchObject({
    alias: 'aniliberty:high-school-dxd',
    name: 'Демоны старшей школы',
    ageRating: '18+',
    publishStatus: 'Завершен',
    type: 'ТВ',
    season: 'Осень',
    genres: ['Комедия', 'Этти'],
    episodesTotal: 12,
    episodeDurationMinutes: 25,
  });
});

it('drops malformed metadata without rejecting a valid index entry', () => {
  const index = parseCatalogIndex({
    version: 1,
    generatedAt: now - 1000,
    releases: [[{
      alias: 'aniliberty:test',
      name: 'Тест',
      genres: ['Комедия', 42, '', { name: 'Этти' }],
      episodesTotal: -3,
      episodeDurationMinutes: '25',
      ageRating: 18,
    }]],
  }, now);

  expect(index?.releases[0][0]).toMatchObject({ alias: 'aniliberty:test', name: 'Тест', genres: ['Комедия'] });
  expect(index?.releases[0][0].episodesTotal).toBeUndefined();
  expect(index?.releases[0][0].episodeDurationMinutes).toBeUndefined();
  expect(index?.releases[0][0].ageRating).toBeUndefined();
});
