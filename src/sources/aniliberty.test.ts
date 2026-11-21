import { expect, it } from 'vitest';
import { createAniLiberty } from './aniliberty';

const validStream = 'https://example.com/720.m3u8?token=keep';

it.each([
  [false, false, undefined],
  [true, false, 'geo'],
  [false, true, 'copyright'],
  [undefined, false, 'unknown'],
] as const)('validates HTTPS and playback restrictions (geo=%s, copyright=%s)', async (geo, copyright, restriction) => {
  const source = createAniLiberty(async () => Response.json({
    alias: 'test-release',
    name: { main: 'Тест' },
    is_blocked_by_geo: geo,
    is_blocked_by_copyrights: copyright,
    external_player: 'https://example.com/fallback',
    episodes: [{
      id: 'episode-1',
      ordinal: 1,
      hls_480: 'http://example.com/480.m3u8',
      hls_720: validStream,
      hls_1080: 'javascript:alert(1)',
    }],
  }));

  const title = await source.getTitle('test-release', new AbortController().signal);
  expect(title).toMatchObject({
    restriction,
    episodes: [{ id: 'episode-1', streams: restriction ? [] : [{ quality: 720, url: validStream }] }],
  });
});

it('combines search, genre, and exact year before requesting the matching page', async () => {
  const signal = new AbortController().signal;
  const source = createAniLiberty(async (input, options) => {
    const url = new URL(String(input));
    expect(url.pathname).toBe('/api/v1/anime/catalog/releases');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'f[search]': 'Фрирен',
      'f[genres]': '15',
      'f[years][from_year]': '2023',
      'f[years][to_year]': '2023',
      limit: '24',
      page: '2',
    });
    expect(options?.signal).toBe(signal);
    return Response.json({
      data: [{ alias: 'frieren', name: { main: 'Фрирен' }, year: 2023 }],
      meta: { pagination: { current_page: 2, total_pages: 3 } },
    });
  });

  await expect(source.getCatalog('Фрирен', 2, signal, { genres: [15], yearFrom: 2023, yearTo: 2023 })).resolves.toMatchObject({
    items: [{ alias: 'frieren', name: 'Фрирен', year: 2023 }],
    page: 2,
    totalPages: 3,
  });
});

it('joins several genre ids into one comma-separated filter and skips invalid ids', async () => {
  const signal = new AbortController().signal;
  const source = createAniLiberty(async (input) => {
    const url = new URL(String(input));
    expect(url.searchParams.getAll('f[genres]')).toEqual(['1,8']);
    return Response.json({
      data: [], meta: { pagination: { current_page: 1, total_pages: 1 } },
    });
  });

  await expect(source.getCatalog('', 1, signal, { genres: [1, 0, 8] })).resolves.toMatchObject({
    items: [], page: 1, totalPages: 1,
  });
});

it('maps all catalog filters to AniLiberty params and drops unknown values', async () => {
  const source = createAniLiberty(async (input) => {
    const url = new URL(String(input));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      'f[types]': 'TV,WEB',
      'f[publish_statuses]': 'IS_ONGOING',
      'f[sorting]': 'RATING_DESC',
      'f[seasons]': 'winter,spring',
      'f[years][from_year]': '2000',
      'f[years][to_year]': '2010',
      'f[age_ratings]': 'R12_PLUS,R16_PLUS',
      limit: '24',
      page: '1',
    });
    return Response.json({
      data: [], meta: { pagination: { current_page: 1, total_pages: 1 } },
    });
  });

  await expect(source.getCatalog('', 1, new AbortController().signal, {
    types: ['TV', 'WEB', 'INVALID'],
    publishStatuses: ['IS_ONGOING', 'INVALID'],
    sorting: 'RATING_DESC',
    seasons: ['winter', 'spring', 'INVALID'],
    yearFrom: 2010,
    yearTo: 2000,
    ageRatings: ['R12_PLUS', 'R16_PLUS', 'INVALID'],
  })).resolves.toMatchObject({ items: [], page: 1, totalPages: 1 });
});

it('normalizes all catalog reference options', async () => {
  const references: Record<string, unknown[]> = {
    genres: [{ id: 1, name: 'Комедия' }, { id: 0, name: 'Брак' }],
    years: [2021, 2020, 2021],
    types: [{ value: 'TV', description: 'ТВ' }, { value: 'INVALID', description: 'Брак' }],
    'publish-statuses': [{ value: 'IS_ONGOING', description: 'Онгоинг' }],
    sorting: [{ value: 'RATING_DESC', label: 'Самый высокий рейтинг', description: 'Сначала популярные' }],
    seasons: [{ value: 'winter', description: 'Зима' }],
    'age-ratings': [{ value: 'R16_PLUS', label: '16+', description: 'С шестнадцати лет' }],
  };
  const source = createAniLiberty(async (input) => {
    const field = new URL(String(input)).pathname.split('/').pop() ?? '';
    return Response.json(references[field] ?? []);
  });

  await expect(source.getCatalogFilters!(new AbortController().signal)).resolves.toEqual({
    genres: [{ id: 1, name: 'Комедия' }],
    years: [2021, 2020],
    types: [{ value: 'TV', label: 'ТВ', description: undefined }],
    publishStatuses: [{ value: 'IS_ONGOING', label: 'Онгоинг', description: undefined }],
    sorting: [{ value: 'RATING_DESC', label: 'Самый высокий рейтинг', description: 'Сначала популярные' }],
    seasons: [{ value: 'winter', label: 'Зима', description: undefined }],
    ageRatings: [{ value: 'R16_PLUS', label: '16+', description: 'С шестнадцати лет' }],
  });
});

it('loads similar releases and franchise chronology without duplicates', async () => {
  const signal = new AbortController().signal;
  const source = createAniLiberty(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/api/v1/anime/releases/test-release') {
      return Response.json({ id: 42, alias: 'test-release', name: { main: 'Тест' } });
    }
    if (url.pathname === '/api/v1/anime/releases/recommended') {
      expect(Object.fromEntries(url.searchParams)).toEqual({ release_id: '42', limit: '6' });
      return Response.json([
        { alias: 'similar-one', name: { main: 'Похожий' }, year: 2021 },
        { alias: 'test-release', name: { main: 'Тест' } },
        { alias: 'similar-one', name: { main: 'Дубль' } },
        { alias: 'bad alias!', name: { main: 'Некорректный' } },
      ]);
    }
    if (url.pathname === '/api/v1/anime/franchises/release/42') {
      return Response.json([{
        id: 'franchise-1',
        name: 'Франшиза',
        franchise_releases: [
          { sort_order: 2, release: { alias: 'second-part', name: { main: 'Вторая часть' } } },
          { sort_order: 1, release: { alias: 'test-release', name: { main: 'Тест' }, year: 2020 } },
          { sort_order: 3, release: { alias: 'bad alias!', name: { main: 'Некорректный' } } },
        ],
      }]);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  await expect(source.getRelated!({ alias: 'test-release', id: 42, name: 'Тест', episodes: [] } as any, signal)).resolves.toMatchObject({
    similar: [{ alias: 'similar-one', name: 'Похожий', year: 2021 }],
    franchises: [{
      id: 'franchise-1',
      name: 'Франшиза',
      releases: [
        { alias: 'test-release', name: 'Тест', year: 2020, order: 1 },
        { alias: 'second-part', name: 'Вторая часть', order: 2 },
      ],
    }],
  });
});

it('keeps published episode IDs and does not advertise a next episode for a finished season', async () => {
  const source = createAniLiberty(async (input) => {
    expect(String(input)).toBe('https://anilibria.top/api/v1/anime/schedule/week');
    return Response.json({ data: [
      { release: { alias: 'bad-day', publish_day: { value: 8 } } },
      {
        release: { alias: 'weekly-release', name: { main: 'Тайтл недели' }, publish_day: { value: 2 }, poster: { preview: '/images/week.jpg' } },
        full_season_is_released: false,
        next_release_episode_number: 8,
        published_release_episode: { id: 'ep-seven', ordinal: 7, hls_720: validStream },
      },
      {
        release: { alias: 'completed-release', name: { main: 'Завершённый тайтл' }, publish_day: { value: 6 } },
        full_season_is_released: true,
        next_release_episode_number: 13,
      },
    ] });
  });

  await expect(source.getSchedule!(new AbortController().signal)).resolves.toEqual([
    { day: 2, alias: 'weekly-release', name: 'Тайтл недели', poster: 'https://anilibria.top/images/week.jpg', seasonComplete: false, publishedEpisode: { id: 'ep-seven', number: 7 }, nextEpisodeNumber: 8 },
    { day: 6, alias: 'completed-release', name: 'Завершённый тайтл', seasonComplete: true },
  ]);
});
