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

  await expect(source.getCatalog('Фрирен', 2, signal, { genre: 15, year: 2023 })).resolves.toMatchObject({
    items: [{ alias: 'frieren', name: 'Фрирен', year: 2023 }],
    page: 2,
    totalPages: 3,
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

it('normalizes title metadata for the about section', async () => {
  const source = createAniLiberty(async () => Response.json({
    alias: 'meta-release',
    name: { main: 'Метаданные' },
    year: 2026,
    age_rating: { value: 'R18_PLUS', description: '18+' },
    is_ongoing: false,
    type: { value: 'TV', description: 'ТВ' },
    season: { value: 'autumn', description: 'Осень' },
    genres: [
      { id: 26, name: 'Исторический' },
      { id: 11, name: 'Романтика' },
      { id: 26, name: 'Исторический' },
      { id: 1, name: '   ' },
      { name: 42 },
    ],
    episodes_total: 12,
    average_duration_of_episode: 24,
    is_blocked_by_geo: false,
    is_blocked_by_copyrights: false,
  }));

  await expect(source.getTitle('meta-release', new AbortController().signal)).resolves.toMatchObject({
    type: 'ТВ',
    season: 'Осень',
    genres: ['Исторический', 'Романтика'],
    year: 2026,
    episodesTotal: 12,
    episodeDurationMinutes: 24,
    ageRating: '18+',
    publishStatus: 'Завершен',
  });
});

it('maps raw metadata values and drops invalid ones', async () => {
  const source = createAniLiberty(async () => Response.json({
    alias: 'meta-release',
    name: { main: 'Метаданные' },
    type: { value: 'movie' },
    season: 'summer',
    genres: 'not a list',
    episodes_total: '12',
    average_duration_of_episode: 0,
    age_rating: 'unknown-rating',
    publish_status: 'UNKNOWN',
  }));

  const title = await source.getTitle('meta-release', new AbortController().signal);
  expect(title).toMatchObject({ type: 'Фильм', season: 'Лето' });
  expect(title?.genres).toBeUndefined();
  expect(title?.episodesTotal).toBeUndefined();
  expect(title?.episodeDurationMinutes).toBeUndefined();
  expect(title?.ageRating).toBe('unknown-rating');
  expect(title?.publishStatus).toBe('UNKNOWN');
});

it('reads age rating and publish status from every supported response shape', async () => {
  const cases = [
    [{ age_rating: { value: 'R16_PLUS' }, publish_status: { value: 'IS_ONGOING', description: 'Онгоинг' } }, '16+', 'Онгоинг'],
    [{ age_rating: { description: '12+' }, is_ongoing: true }, '12+', 'Онгоинг'],
    [{ age_rating: 'R0_PLUS', is_ongoing: false }, '0+', 'Завершен'],
    [{ is_ongoing: 'false', age_rating: 18 }, undefined, undefined],
  ] as const;

  for (const [fields, ageRating, publishStatus] of cases) {
    const source = createAniLiberty(async () => Response.json({
      alias: 'meta-release', name: { main: 'Метаданные' }, ...fields,
    }));
    const title = await source.getTitle('meta-release', new AbortController().signal);
    expect(title?.ageRating).toBe(ageRating);
    expect(title?.publishStatus).toBe(publishStatus);
  }
});

it('keeps metadata on catalog entries as well as on the full title', async () => {
  const source = createAniLiberty(async () => Response.json({
    data: [{
      alias: 'meta-release',
      name: { main: 'Метаданные' },
      genres: [{ name: 'Комедия' }],
      type: { description: 'ТВ' },
      episodes_total: 12,
      average_duration_of_episode: 25,
    }],
    meta: { pagination: { current_page: 1, total_pages: 1 } },
  }));

  await expect(source.getCatalog('', 1, new AbortController().signal)).resolves.toMatchObject({
    items: [{
      alias: 'meta-release',
      name: 'Метаданные',
      genres: ['Комедия'],
      type: 'ТВ',
      episodesTotal: 12,
      episodeDurationMinutes: 25,
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
