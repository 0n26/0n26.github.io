import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { catalogIndexVersion, parseCatalogIndex } from '../../src/sources/catalogIndex.ts';
import { indexedSources } from '../../src/sources/index.ts';
import { publishCatalogIndex } from '../../scripts/catalog-index.mjs';

vi.mock(import('../../src/sources/index.ts'), async (original) => {
  const registry = await original();
  return { ...registry, indexedSources: registry.indexedSources.map(entry => ({
    ...entry,
    source: { ...entry.source, getTitle: async alias => playableTitle(alias) },
  })) };
});

function playableTitle(alias) {
  return { alias, episodes: [{ streams: [{ url: 'https://example.test/episode.m3u8' }] }] };
}

let directory, output;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'catalog-index-test-'));
  output = join(directory, 'catalog-index.json');
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function fixture({ alter = (_, body) => Response.json(body) } = {}) {
  const left = Array.from({ length: 26 }, (_, i) => ({ id: i + 1,
    alias: `left-${i + 1}`, name: { main: `Left ${i + 1}` }, year: 2024,
  }));
  const right = Array.from({ length: 49 }, (_, i) => ({ id: i + 1, title: `Right ${i + 1}`, year: '2024' }));
  const calls = [];
  const fetcher = async (input, { credentials, signal }) => {
    expect(credentials).toBe('omit');
    expect(signal).toBeInstanceOf(AbortSignal);
    const url = new URL(input);
    if (url.hostname === 'shikimori.io') return Response.json({ data: { animes: [] } });
    const page = Number(url.searchParams.get('page'));
    const isLeft = url.hostname === 'anilibria.top';
    const rows = isLeft ? left : right;
    const limit = Number(url.searchParams.get(isLeft ? 'limit' : 'quantity'));
    const data = rows.slice((page - 1) * limit, page * limit);
    const body = isLeft ? {
      data,
      meta: { pagination: { count: data.length, per_page: 24, current_page: page,
        total: rows.length, total_pages: Math.ceil(rows.length / 24) } },
    } : { data, state: { status: data.length ? 'ok' : 'fail', page, count: rows.length } };
    const key = `${isLeft ? 'aniliberty' : 'animevost'}:${page}`;
    calls.push(key);
    return alter(key, body, url);
  };
  return { left, right, fetcher, calls };
}

it('does not replace a snapshot when playback availability is unknown', async () => {
  const { fetcher } = fixture();
  await publishCatalogIndex(output, fetcher);
  const previous = readFileSync(output, 'utf8');
  const unavailable = indexedSources.map(entry => ({
    ...entry, source: { ...entry.source, async getTitle() { throw new Error('provider unavailable'); } },
  }));
  await expect(publishCatalogIndex(output, fetcher, unavailable)).rejects.toThrow('Playback verification incomplete');
  expect(readFileSync(output, 'utf8')).toBe(previous);
});

it('groups unique title and year matches across full sweeps, keeping ambiguous and unknown years separate', async () => {
  const { left, right, fetcher, calls } = fixture();
  Object.assign(left[0], {
    name: { main: 'Ночь', english: 'Ｔhe　Night' },
    poster: { optimized: { preview: '/posters/night.webp' } },
    age_rating: { label: '12+' },
    is_ongoing: false,
    type: { value: 'TV', description: 'ТВ' },
    season: { value: 'winter', description: 'Зима' },
    genres: [{ name: 'Драма' }],
    episodes_total: 12,
    average_duration_of_episode: 24,
    shikimori: { id: 63801 },
    description: 'Not public', episodes: [{ video: 'https://example.test/video' }],
  });
  left[1].name.main = right[24].title = right[48].title = 'Ambiguous';
  left[2].name.main = right[2].title = 'Different year';
  right[2].year = '2023';
  left[3].name.main = right[3].title = 'Unknown year';
  delete left[3].year;
  Object.assign(left[4], { alias: 'ao-no-hako', name: { main: 'Голубая шкатулка', english: 'Ao no Hako', alternative: 'Blue Box' } });
  right[4].title = 'Blue Box';
  Object.assign(right[25], { title: 'Другая ночь / the    night [TV]', urlImagePreview: 'http://animevost.org/uploads/posts/night.jpg' });
  const metadata = {
    ageRating: '12+', publishStatus: 'Завершён', type: 'ТВ', season: 'Зима',
    genres: ['Драма'], episodesTotal: 12, episodeDurationMinutes: 24, shikimoriId: 63801,
  };

  await publishCatalogIndex(output, fetcher);

  expect(calls.slice(0, 2)).toEqual(['aniliberty:1', 'animevost:1']);
  expect(calls.filter((call) => call.startsWith('aniliberty'))).toEqual(['aniliberty:1', 'aniliberty:2']);
  expect(calls.filter((call) => call.startsWith('animevost'))).toEqual(['animevost:1', 'animevost:2', 'animevost:3']);
  const index = JSON.parse(readFileSync(output, 'utf8'));
  expect(index).toMatchObject({ version: catalogIndexVersion, generatedAt: expect.any(Number) });
  expect(index.releases.slice(0, 4).map(([entry]) => entry.alias)).toEqual([
    'aniliberty:left-1', 'animevost:1', 'aniliberty:left-2', 'animevost:2',
  ]);
  expect(index.releases.filter((release) => release.length > 1)).toEqual([[
    { alias: 'aniliberty:left-1', name: 'Ночь', alternateName: 'Ｔhe　Night', year: 2024,
      poster: 'https://anilibria.top/posters/night.webp', ...metadata },
    { alias: 'animevost:26', name: 'Другая ночь', alternateName: 'the    night', year: 2024, poster: 'https://animevost.org/uploads/posts/night.jpg' },
  ]]);
  expect(parseCatalogIndex(index)?.byAlias.get('aniliberty:left-1')?.[0]).toMatchObject(metadata);
  expect(index.releases.find(([entry]) => entry.alias === 'aniliberty:ao-no-hako')).toMatchObject([
    { alias: 'aniliberty:ao-no-hako', alternateName: 'Ao no Hako', searchName: 'Blue Box' },
  ]);
  expect(index.releases).toHaveLength(left.length + right.length - 1);
});

it('matches formatting variants without dropping season or release markers', async () => {
  const { left, right, fetcher } = fixture();
  left[0].name.english = '[Oshi no Ko] 3rd Season';
  right[0].title = 'Звёздное дитя (третий сезон) / Oshi no Ko 3rd Season [1-11 из 11]';
  left[1].name.english = 'W&#039;z';
  right[1].title = String.raw`Уиз / W\'z`;
  left[2].name.english = 'Fruits Basket: 2nd Season';
  right[2].title = 'Fruits Basket 1st Season';
  left[3].name.english = 'Hero (OVA)';
  right[3].title = 'Hero (Movie)';
  left[4].name.main = 'Тёмный дворецкий';
  right[4].title = 'Темный дворецкий';
  left[5].name.english = '[Oshi no Ko] 3rd Season!';
  right[5].title = 'Another Oshi no Ko';
  left[5].year = 2023;
  Object.assign(left[6], {
    alias: 'senyuu-istinno-geroyskiy-fayt',
    name: { main: 'Истинно геройский файт', english: 'Senyuu [TV1-TV2]' },
    episodes_total: 26,
  });
  Object.assign(right[6], { id: 143, title: 'Истинно геройский файт. / Senyuu. [1-13 из 13]' });

  await publishCatalogIndex(output, fetcher);

  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases.filter((group) => group.length > 1).map((group) => group.map(({ alias }) => alias)))
    .toEqual([['aniliberty:left-1', 'animevost:1'], ['aniliberty:left-2', 'animevost:2'], ['aniliberty:left-5', 'animevost:5']]);
  expect(releases.find(([entry]) => entry.alias === 'aniliberty:left-2')?.map(({ alternateName }) => alternateName))
    .toEqual(["W'z", "W'z"]);
});

it('pairs a third provider when the match is mutual, but keeps three-way matches separate in v2', async () => {
  const { left, right, fetcher } = fixture();
  left[0].name.main = 'Unique match';
  left[1].name.main = right[0].title = 'Three-way match';
  const third = {
    source: {
      key: 'third',
      getCatalog() { throw new Error('The generator must not call the browser catalog'); },
      async getTitle(alias) { return playableTitle(alias); },
    },
    openIndex() {
      const items = [
        { alias: 'one', name: 'Unique match', year: 2024 },
        { alias: 'two', name: 'Three-way match', year: 2024 },
      ];
      return {
        pageSize: items.length,
        async readPage(page) {
          return { page, total: items.length, totalPages: 1, rawCount: items.length, items };
        },
      };
    },
  };

  await publishCatalogIndex(output, fetcher, [...indexedSources, third]);

  const index = parseCatalogIndex(JSON.parse(readFileSync(output, 'utf8')));
  expect(index.byAlias.get('third:one')?.map(({ alias }) => alias)).toEqual(['aniliberty:left-1', 'third:one']);
  for (const alias of ['aniliberty:left-2', 'animevost:1', 'third:two']) {
    expect(index.byAlias.get(alias)).toHaveLength(1);
  }
});

it('automatically pairs the full Fate slash titles without collapsing distinct releases', async () => {
  const { left, right, fetcher } = fixture();
  const matches = [
    ['fate-apocrypha', 1899, 'Fate/Apocrypha', 2017, '[1-25 из 25]'],
    ['fatestrange-fake-whispers-of-dawn', 3028, 'Fate/strange Fake: Whispers of Dawn', 2023, '[1 из 1]'],
    ['fate-extra-last-encore', 2001, 'Fate/Extra Last Encore', 2018, '[1-10 из 10] [OVA 1-3 из 3]'],
    ['fate-grand-order-first-order', 1828, 'Fate/Grand Order: First Order', 2017, '[1 из 1]'],
  ];
  for (const [i, [alias, id, english, year, metadata]] of matches.entries()) {
    Object.assign(left[i], { alias, year, name: { main: `Судьба/Левый ${i}`, english } });
    Object.assign(right[i], { id, year: String(year), title: `Судьба: Правый ${i} / ${english} ${metadata}` });
  }
  left[4].name.main = 'Fate';
  left[5].name.main = 'Fate/stay night';
  right[4].title = 'Судьба: Ночь схватки / Fate/stay night [Unlimited Blade Works] [1-12 из 12]';

  await publishCatalogIndex(output, fetcher);

  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases.filter((release) => release.length > 1)).toEqual(
    matches.map(([alias, id, alternateName]) => [
      expect.objectContaining({ alias: `aniliberty:${alias}`, alternateName }),
      expect.objectContaining({ alias: `animevost:${id}`, alternateName }),
    ]),
  );
});

it('pairs curated aliases even when names or years differ, with the primary member first', async () => {
  const { left, right, fetcher } = fixture();
  const pairs = [
    ['ao-no-hako-2nd-season', 3996],
    ['fatestrange-fake', 3410],
    ['jujutsu-kaisen-0-movie', 2879],
    ['jujutsu-kaisen-season-2', 3014],
    ['sword-art-online-ii', 854],
    ['sword-art-online-movie-ordinal-scale', 1852],
    ['dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-no-darou-ka-ii', 2285],
    ['dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-no-darou-ka-iii', 2499],
    ['dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-darou-ka-gaiden-sword-oratoria', 1856],
  ];
  for (const [i, [alias, id]] of pairs.entries()) {
    left[i + 10].alias = alias;
    right[i].id = id;
  }
  Object.assign(left[11], { name: { main: 'Судьба/Странная подделка', english: 'Fate/strange Fake' }, year: 2026 });
  Object.assign(right[1], { title: 'Судьба: Странная подделка / Fate/strange Fake [1-13 из 13]', year: '2025' });

  await publishCatalogIndex(output, fetcher);

  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases.filter((release) => release.length > 1).map((release) => release.map(({ alias }) => alias))).toEqual(
    pairs.map(([alias, id]) => [`aniliberty:${alias}`, `animevost:${id}`]),
  );
});

it('emits complete split releases once at their first member’s position, ordered from the primary member', async () => {
  const { left, right, fetcher } = fixture();
  left[1].alias = 'sword-art-online-alicization---war-of-underworld-part-2';
  left[23].alias = 'sword-art-online-alicization';
  right[40].id = 1987;
  left[3].alias = 'dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-no-darou-ka-iv-part-2';
  left[5].alias = 'dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-no-darou-ka-iv';
  right[1].id = 2822;

  await publishCatalogIndex(output, fetcher);

  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases.slice(0, 4).map(([entry]) => entry.alias)).toEqual([
    'aniliberty:left-1', 'animevost:1', `aniliberty:${left[23].alias}`, `aniliberty:${left[5].alias}`,
  ]);
  expect(releases.filter((release) => release.length > 1)).toMatchObject([
    [
      { alias: `aniliberty:${left[23].alias}`, episodeRange: { first: 1, count: 36 } },
      { alias: `aniliberty:${left[1].alias}`, episodeRange: { first: 37, count: 11 } },
      { alias: 'animevost:1987', episodeRange: { first: 1, count: 47 } },
    ],
    [
      { alias: `aniliberty:${left[5].alias}`, episodeRange: { first: 1, count: 11 } },
      { alias: `aniliberty:${left[3].alias}`, episodeRange: { first: 12, count: 11 } },
      { alias: 'animevost:2822', episodeRange: { first: 1, count: 22 } },
    ],
  ]);
  expect(releases).toHaveLength(left.length + right.length - 4);
});

it('keeps available curated members single when a member is missing, even with exact alternate candidates', async () => {
  const { left, right, fetcher } = fixture();
  left[1].alias = 'sword-art-online-alicization---war-of-underworld-part-2';
  left[1].name.main = right[2].title;
  Object.assign(right[0], { id: 3410, title: left[0].name.main });
  Object.assign(right[1], { id: 1987, title: left[2].name.main });

  await publishCatalogIndex(output, fetcher);

  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases).toHaveLength(left.length + right.length);
  expect(releases.every(([entry, ...others]) => !entry.episodeRange && !others.length)).toBe(true);
});

it('collects a full AnimeVost snapshot when independently cached pages overlap', async () => {
  let snapshot;
  const { right, fetcher } = fixture({
    alter(key, body, url) {
      if (key === 'animevost:1') snapshot = url.searchParams.get('_snapshot');
      if (key === 'animevost:2' && (!snapshot || url.searchParams.get('_snapshot') !== snapshot)) {
        body.data[0].id = 24;
      }
      return Response.json(body);
    },
  });

  await publishCatalogIndex(output, fetcher);

  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases.flat().map(({ alias }) => alias).filter((alias) => alias.startsWith('animevost:')))
    .toEqual(right.map(({ id }) => `animevost:${id}`));
});

it.each(['truncated', 'duplicate', 'drifting count', 'invalid row', 'wrong page'])('rejects an incomplete sweep and keeps the previous snapshot (%s)', async (problem) => {
  const { left, right, fetcher, calls } = fixture({
    alter(key, body) {
      if (key === 'animevost:3') {
        if (problem === 'truncated') body.data.pop();
        if (problem === 'duplicate') body.data[0].id = 1;
        if (problem === 'drifting count') body.state.count++;
        if (problem === 'invalid row') delete body.data[0].title;
        if (problem === 'wrong page') body.state.page++;
      }
      return Response.json(body);
    },
  });
  left[0].name.main = right[0].title = right[48].title = 'Potential match';
  writeFileSync(output, 'old local index');

  await expect(publishCatalogIndex(output, fetcher)).rejects.toThrow(/animevost page 3:/);

  expect(calls).toContain('animevost:3');
  expect(readFileSync(output, 'utf8')).toBe('old local index');
});

it('rejects an AniLiberty page whose reported size disagrees with its rows', async () => {
  const { fetcher } = fixture({
    alter(key, body) {
      if (key === 'aniliberty:2') body.meta.pagination.count++;
      return Response.json(body);
    },
  });
  writeFileSync(output, 'old local index');

  await expect(publishCatalogIndex(output, fetcher)).rejects.toThrow(/aniliberty page 2:/);
  expect(readFileSync(output, 'utf8')).toBe('old local index');
});

it('accepts a short public AnimeVost tail only after checking the exact next offset', async () => {
  const { left, right, fetcher, calls } = fixture({
    alter(key, body) {
      if (key.startsWith('animevost:')) body.state.count += 9;
      return Response.json(body);
    },
  });

  await publishCatalogIndex(output, fetcher);

  expect(calls).toContain('animevost:50');
  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases).toHaveLength(left.length + right.length);
  expect(releases.at(-1)).toMatchObject([{ alias: `animevost:${right.length}` }]);
});

it('retries a transient server error without publishing a partial index', async () => {
  let firstError = true;
  const { left, right, fetcher } = fixture({
    alter(key, body) {
      if (key === 'animevost:1' && firstError) {
        firstError = false;
        return new Response(null, { status: 503 });
      }
      return Response.json(body);
    },
  });

  await publishCatalogIndex(output, fetcher);

  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases).toHaveLength(left.length + right.length);
});
