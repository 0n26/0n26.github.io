import { expect, it } from 'vitest';
import { enrichShikimoriMetadata } from '../../scripts/shikimori-metadata.mjs';

const playback = (alias, fields = {}) => ({ alias, name: alias, year: 2024, ...fields });
const anime = (id, name, fields = {}) => ({ id: String(id), name, airedOn: { year: 2024 }, ...fields });
const response = (animes) => Response.json({ data: { animes } });

function fixture(respond, signal = new AbortController().signal) {
  const calls = [];
  return {
    calls,
    load: (releases) => enrichShikimoriMetadata(releases, async (url, request) => {
      expect(url).toBe('https://shikimori.io/api/graphql');
      expect(request).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error' });
      expect(Object.fromEntries(new Headers(request.headers))).toEqual({
        accept: 'application/json', 'content-type': 'application/json', 'user-agent': '0n26',
      });
      expect(request.signal).toBeInstanceOf(AbortSignal);
      const { query, variables } = JSON.parse(request.body);
      expect(query).toContain('limit: 50');
      calls.push(variables);
      return respond(variables);
    }, signal),
  };
}

it('uses provider IDs before names and applies validated Shikimori metadata without replacing playback identity', async () => {
  const left = playback('aniliberty:night', {
    shikimoriId: 7, name: 'Provider title', alternateName: 'Provider alternate', searchName: 'Provider alias',
    poster: 'https://provider.test/night.webp', description: 'Provider text', genres: ['Драма'], episodesTotal: 8,
  });
  const right = playback('animevost:17', { name: 'Another title' });
  const unmatched = playback('aniliberty:missing', { shikimoriId: 8, name: 'Remote title' });
  const { load, calls } = fixture(() => response([anime(7, 'Remote title', {
    airedOn: { year: 2023 }, poster: { mainUrl: 'https://cdn.shikimori.io/night.webp' }, description: ' Synopsis ',
    genres: [{ russian: ' Комедия ' }, { russian: 'Комедия' }, { name: 'Fantasy' }, { name: 13 }, null],
    kind: 'tv', status: 'released', rating: 'pg_13', season: 'winter_2024', episodes: 12, duration: 24,
    videos: [{ url: 'https://cdn.example/never-publish' }],
  })]));

  const index = await load([[left, right], [unmatched]]);
  expect(calls).toEqual([{ ids: '7,8' }]);
  expect(index).toEqual([[
    { ...left, poster: 'https://cdn.shikimori.io/night.webp', description: 'Synopsis', genres: ['Комедия', 'Fantasy'],
      type: 'ТВ', publishStatus: 'Завершён', ageRating: 'PG-13', season: 'Зима', episodeDurationMinutes: 24 },
    { ...right, shikimoriId: 7, poster: 'https://cdn.shikimori.io/night.webp', description: 'Synopsis',
      genres: ['Комедия', 'Fantasy'], type: 'ТВ', publishStatus: 'Завершён', ageRating: 'PG-13', season: 'Зима',
      episodesTotal: 12, episodeDurationMinutes: 24 },
  ], [unmatched]]);
  expect(left.poster).toBe('https://provider.test/night.webp');
});

it('requires an exact normalized title and year unique across pages and ignores unrelated anime', async () => {
  const night = playback('animevost:17', { name: 'Ночь', searchName: 'The Night' });
  const duplicate = playback('animevost:18', { name: 'Тёмный двойник' });
  const conflict = playback('animevost:19', { name: 'First', alternateName: 'Second' });
  const differentYear = playback('animevost:20', { name: 'First', year: 2023 });
  const missingYear = playback('animevost:21', { name: 'First', year: undefined });
  const fuzzy = playback('animevost:22', { name: 'The Night Part 2' });
  const firstPage = [
    anime(1, 'Night', { synonyms: ['Ｔhe　Night'] }),
    anime(2, 'Double', { russian: 'Темный двойник' }),
    anime(3, 'First'), anime(4, 'Second'),
    ...Array.from({ length: 46 }, (_, i) => anime(i + 5, `Unrelated ${i}`)),
  ];
  const { load, calls } = fixture(({ ids, season, page }) => {
    if (ids) return response([anime(1, 'Night', { description: 'Synopsis' })]);
    if (season === '2023') return response([]);
    return response(page === 1 ? firstPage : [anime(51, 'Тёмный двойник')]);
  });

  const unchanged = [duplicate, conflict, differentYear, missingYear, fuzzy];
  const index = await load([[night], ...unchanged.map((entry) => [entry])]);
  expect(calls).toEqual([{ season: '2024', page: 1 }, { season: '2024', page: 2 }, { season: '2023', page: 1 }, { ids: '1' }]);
  expect(index[0]).toEqual([{ ...night, shikimoriId: 1, description: 'Synopsis' }]);
  expect(index.slice(1)).toEqual(unchanged.map((entry) => [entry]));
});

it('keeps split playback ranges and discards malformed optional metadata', async () => {
  const first = playback('animevost:1', { shikimoriId: 11, episodeRange: { first: 1, count: 13 } });
  const second = playback('animevost:2', { shikimoriId: 12, episodeRange: { first: 14, count: 13 } });
  const complete = playback('aniliberty:all', {
    shikimoriId: 11, episodeRange: { first: 1, count: 26 }, episodesTotal: 26,
    poster: 'https://provider.test/poster.webp', description: 'Provider description', genres: ['Драма'],
  });
  const { load } = fixture(() => response([
    anime(11, 'Season one', { poster: { mainUrl: 'https://user:password@cdn.shikimori.io/poster.webp' },
      description: {}, genres: ['Not a genre row', null], kind: 'constructor', ageRating: '18+',
      status: 'unknown', rating: [], season: 'summer_NOT_A_YEAR', duration: '24', episodes: 13 }),
    anime(12, 'Season two', { poster: { mainUrl: 'http://cdn.shikimori.io/poster.webp' }, description: 'Season 2', episodes: 13 }),
  ]));

  expect(await load([[first, second, complete]])).toEqual([[first, { ...second, description: 'Season 2' }, complete]]);
});

it('deduplicates and batches explicit IDs rather than requesting one title at a time', async () => {
  const releases = Array.from({ length: 52 }, (_, i) => [playback(`aniliberty:${i}`, { shikimoriId: Math.min(i + 1, 51) })]);
  let callTime;
  const { load, calls } = fixture(() => {
    const now = performance.now();
    if (callTime !== undefined) expect(now - callTime).toBeGreaterThanOrEqual(667);
    callTime = now;
    return response([]);
  });
  expect(await load(releases)).toEqual(releases);
  expect(calls).toEqual([
    { ids: Array.from({ length: 50 }, (_, i) => i + 1).join(',') }, { ids: '51' },
  ]);
});

it.each([
  [() => new Response(null, { status: 429 }), 'HTTP 429'],
  [() => Response.json({ errors: [{ message: 'partial' }], data: { animes: [] } }), 'GraphQL errors'],
  [() => Response.json({ data: { animes: {} } }), 'invalid anime list'],
  [() => response([anime('1e0', 'Invalid')]), 'invalid anime ID'],
  [() => response([anime(2, 'Unrequested')]), 'unexpected or duplicate anime ID'],
  [() => response([anime(1, 'Expected'), anime(1, 'Duplicate')]), 'unexpected or duplicate anime ID'],
])('rejects failed or inconsistent GraphQL responses', async (respond, error) => {
  const { load, calls } = fixture(respond);

  await expect(load([[playback('aniliberty:one', { shikimoriId: 1 })]])).rejects.toThrow(error);
  expect(calls).toEqual([{ ids: '1' }]);
});

it('ignores a fallback result outside the requested year', async () => {
  const { load } = fixture(() => response([anime(1, 'First', { airedOn: { year: 2023 } })]));
  const groups = [[playback('animevost:1', { name: 'First' })]];
  await expect(load(groups)).resolves.toEqual(groups);
});

it('does not send requests after cancellation', async () => {
  const controller = new AbortController();
  const { load, calls } = fixture(() => response([]), controller.signal);
  controller.abort();

  await expect(load([[playback('aniliberty:one', { shikimoriId: 1 })]])).rejects.toThrow(/aborted/i);
  expect(calls).toEqual([]);
});
