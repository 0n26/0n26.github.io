import { expect, it, vi } from 'vitest';
import { createCatalog } from './catalog';
import { catalogIndexVersion, parseCatalogIndex } from '../sources/catalogIndex';
import type { AnimeSource } from '../sources/source';
import { catalogSourceKey, episodePlaybackKey } from './titleRef';

const signal = new AbortController().signal;

function provider(key: string) {
  return {
    key,
    name: key,
    getCatalog: vi.fn<AnimeSource['getCatalog']>(async (_query, page) => ({
      page, items: [{ alias: String(page), name: key }], totalPages: 200,
    })),
    getTitle: vi.fn<AnimeSource['getTitle']>(async (alias) => ({
      alias, name: key, episodes: [{ id: 'e2', number: 2, streams: [] }],
    })),
  } satisfies AnimeSource;
}

const main = { alias: 'aniliberty:hero', name: 'Герой', searchName: 'The Champion', year: 2024 };
const dub = { alias: 'animevost:7', name: 'Hero', alternateName: 'Герой', year: 2024 };

it('paginates the index and searches names from either version without provider requests', async () => {
  const a = provider('aniliberty');
  const b = provider('animevost');
  const fillers = Array.from({ length: 48 * 199 }, (_, i) => [{ alias: `aniliberty:p${i}`, name: 'Другой' }]);
  const payload = { version: catalogIndexVersion, generatedAt: Date.now(), releases: [...fillers, [main, dub]] };
  const source = createCatalog([a, b], async () => parseCatalogIndex(payload));

  await expect(source.getCatalog('', 200, signal)).resolves.toMatchObject({ items: [main], page: 200, totalPages: 200 });
  await expect(source.getCatalog('hero', 1, signal)).resolves.toMatchObject({ items: [main], totalPages: 1 });
  await expect(source.getCatalog('the champion', 1, signal)).resolves.toMatchObject({ items: [main], totalPages: 1 });
  await expect(source.getTitleAccess(catalogSourceKey)!.getVoices!('animevost:7', signal)).resolves.toEqual([
    { alias: 'animevost:7', sourceKey: 'animevost', source: 'animevost' },
    { alias: 'aniliberty:hero', sourceKey: 'aniliberty', source: 'aniliberty' },
  ]);
  expect(a.getCatalog).not.toHaveBeenCalled();
  expect(b.getCatalog).not.toHaveBeenCalled();
});

it('searches a split release as one card and selects the base option first without fetching provider metadata', async () => {
  const part1 = { ...main, episodeRange: { first: 1, count: 36 } };
  const part2 = { alias: 'aniliberty:hero-final', name: 'Герой: Финал', episodeRange: { first: 37, count: 11 } };
  const full = { ...dub, episodeRange: { first: 1, count: 47 } };
  const index = parseCatalogIndex({ version: catalogIndexVersion, generatedAt: Date.now(), releases: [[part1, part2, full]] });
  const source = createCatalog([provider('aniliberty'), provider('animevost')], async () => index);

  await expect(source.getCatalog('финал', 1, signal)).resolves.toMatchObject({ items: [part1] });
  await expect(source.getTitleAccess(catalogSourceKey)!.getVoices!('animevost:7', signal)).resolves.toEqual([
    { alias: 'animevost:7', sourceKey: 'animevost', source: 'animevost', episodeRange: full.episodeRange },
    { alias: 'aniliberty:hero', sourceKey: 'aniliberty', source: 'aniliberty · Часть 1', episodeRange: part1.episodeRange },
    { alias: 'aniliberty:hero-final', sourceKey: 'aniliberty', source: 'aniliberty · Часть 2', episodeRange: part2.episodeRange },
  ]);
});

it('rejects a publisher payload whose split numbering overlaps', () => {
  const index = parseCatalogIndex({ version: catalogIndexVersion, generatedAt: Date.now(), releases: [[
    { ...main, episodeRange: { first: 1, count: 36 } },
    { alias: 'aniliberty:part2', name: 'Часть 2', episodeRange: { first: 36, count: 11 } },
    { ...dub, episodeRange: { first: 1, count: 47 } },
  ]] });
  expect(index).toBeNull();
});

it('loads the requested provider without waiting for the index or the original provider', async () => {
  const a = provider('aniliberty');
  a.getTitle.mockRejectedValue(new Error('HTTP 503'));
  const b = provider('animevost');
  const index = vi.fn(() => new Promise<null>(() => {}));
  const source = createCatalog([a, b], index);

  await expect(source.getTitleAccess(catalogSourceKey)!.getTitle('animevost:7', signal)).resolves.toMatchObject({
    alias: 'animevost:7', episodes: [{ id: 'e2' }],
  });
  expect(a.getTitle).not.toHaveBeenCalled();
  expect(index).not.toHaveBeenCalled();
});

it('does not report an empty franchise lookup for a provider that cannot look up franchises', async () => {
  const access = createCatalog([provider('animevost')], async () => null).getTitleAccess(catalogSourceKey)!;
  const title = (await access.getTitle('animevost:7', signal))!;
  const info = await access.getRelated!(title, signal);
  expect(info.franchises).toBeUndefined();
});

it('fetches only the requested page per provider if the index is expired', async () => {
  const a = provider('aniliberty');
  const b = provider('animevost');
  const payload = { version: catalogIndexVersion, generatedAt: Date.now() - 8 * 86_400_000, releases: [[main, dub]] };
  const source = createCatalog([a, b], async () => parseCatalogIndex(payload));

  await expect(source.getCatalog('', 200, signal)).resolves.toMatchObject({
    items: [{ alias: 'aniliberty:200' }, { alias: 'animevost:200' }], page: 200,
  });
  expect(a.getCatalog.mock.calls.map(([, page]) => page)).toEqual([200]);
  expect(b.getCatalog.mock.calls.map(([, page]) => page)).toEqual([200]);
  await expect(source.getTitleAccess(catalogSourceKey)!.getVoices!('aniliberty:hero', signal)).resolves.toEqual([]);
});

it('shows successful results on a partial failure and retries the failed provider on the next request', async () => {
  const a = provider('aniliberty');
  const b = provider('animevost');
  b.getCatalog.mockRejectedValueOnce(new Error('HTTP 503'));
  const source = createCatalog([a, b], async () => null);

  await expect(source.getCatalog('', 1, signal)).resolves.toMatchObject({
    incomplete: true, items: [{ alias: 'aniliberty:1' }],
  });
  const retry = await source.getCatalog('', 1, signal);
  expect(retry.incomplete).not.toBe(true);
  expect(retry.items.map(({ alias }) => alias)).toEqual(['aniliberty:1', 'animevost:1']);
});

it('routes multi-genre filters only to providers with filter support', async () => {
  const a: AnimeSource = {
    ...provider('aniliberty'),
    getCatalogFilters: vi.fn(async () => ({
      genres: [{ id: 1, name: 'Комедия' }],
      years: [2023],
      types: [{ value: 'TV', label: 'ТВ' }],
      publishStatuses: [{ value: 'IS_ONGOING', label: 'Онгоинг' }],
      sorting: [{ value: 'RATING_DESC', label: 'По рейтингу' }],
      seasons: [{ value: 'winter', label: 'Зима' }],
      ageRatings: [{ value: 'R16_PLUS', label: '16+' }],
    })),
  };
  const b = provider('animevost');
  const source = createCatalog([a, b], async () => null);

  const filters = { genres: [1, 8], yearFrom: 2023, yearTo: 2023 };
  await expect(source.getCatalog('', 1, signal, filters)).resolves.toMatchObject({
    items: [{ alias: 'aniliberty:1' }],
  });
  expect(a.getCatalog).toHaveBeenCalledWith('', 1, signal, filters);
  expect(b.getCatalog).not.toHaveBeenCalled();

  await expect(source.getCatalog('', 1, signal, { genres: [] })).resolves.toMatchObject({
    items: [{ alias: 'aniliberty:1' }, { alias: 'animevost:1' }],
  });
});

it('keeps filters scoped to AniLiberty even when another adapter has overlapping genre IDs', async () => {
  const a: AnimeSource = {
    ...provider('aniliberty'),
    getCatalogFilters: vi.fn(async () => ({
      genres: [{ id: 1, name: 'Комедия' }],
      years: [2023],
      types: [{ value: 'TV', label: 'ТВ' }],
      publishStatuses: [{ value: 'IS_ONGOING', label: 'Онгоинг' }],
      sorting: [{ value: 'RATING_DESC', label: 'По рейтингу' }],
      seasons: [{ value: 'winter', label: 'Зима' }],
      ageRatings: [{ value: 'R16_PLUS', label: '16+' }],
    })),
  };
  const b = {
    ...provider('another-source'),
    getCatalogFilters: vi.fn(async () => ({
      genres: [{ id: 1, name: 'Экшен' }],
      years: [],
      types: [],
      publishStatuses: [],
      sorting: [],
      seasons: [],
      ageRatings: [],
    })),
  };
  const source = createCatalog([a, b], async () => null);
  const filters = {
    types: ['TV'],
    publishStatuses: ['IS_ONGOING'],
    sorting: 'RATING_DESC',
    seasons: ['winter'],
    ageRatings: ['R16_PLUS'],
  };

  await expect(source.getCatalog('', 1, signal, filters)).resolves.toMatchObject({
    items: [{ alias: 'aniliberty:1' }],
  });
  expect(a.getCatalog).toHaveBeenCalledWith('', 1, signal, filters);
  expect(b.getCatalog).not.toHaveBeenCalled();

  await expect(source.getCatalogFilters(signal)).resolves.toMatchObject({
    genres: [{ id: 1, name: 'Комедия' }],
    years: [2023],
    types: [{ value: 'TV', label: 'ТВ' }],
    publishStatuses: [{ value: 'IS_ONGOING', label: 'Онгоинг' }],
    sorting: [{ value: 'RATING_DESC', label: 'По рейтингу' }],
    seasons: [{ value: 'winter', label: 'Зима' }],
    ageRatings: [{ value: 'R16_PLUS', label: '16+' }],
  });
  expect(b.getCatalogFilters).not.toHaveBeenCalled();
});

it('opens direct, current catalog and legacy group links with the same existing playback key', async () => {
  const catalog = createCatalog([provider('animevost')], async () => null);
  const links = [
    ['animevost', '7'],
    ['combined', 'animevost:7'],
    ['combined', 'group:animevost~7|aniliberty~hero'],
  ];
  for (const [sourceKey, alias] of links) {
    const title = (await catalog.getTitleAccess(sourceKey)!.getTitle(alias, signal))!;
    expect(episodePlaybackKey(title.ref, title.episodes[0].id)).toBe('["animevost","7","e2"]');
  }
});

it('opens a direct-only adapter without including it in the live catalog or the combined route', async () => {
  const extra = provider('extra');
  const catalog = createCatalog([provider('aniliberty')], async () => null, [extra]);
  await expect(catalog.getTitleAccess('extra')!.getTitle('hero', signal)).resolves.toMatchObject({
    alias: 'hero', ref: { sourceKey: 'extra', alias: 'hero' },
  });
  await expect(catalog.getCatalog('', 1, signal)).resolves.toMatchObject({ items: [{ alias: 'aniliberty:1' }] });
  await expect(catalog.getTitleAccess(catalogSourceKey)!.getTitle('extra:hero', signal)).resolves.toBeNull();
  expect(extra.getCatalog).not.toHaveBeenCalled();
});
