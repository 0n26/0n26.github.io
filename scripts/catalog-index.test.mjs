import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { publishCatalogIndex } from './catalog-index.mjs';

const previousUrl = 'https://0n26.github.io/catalog-index.json';
const hour = 60 * 60 * 1000;
let directory, output;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'catalog-index-test-'));
  output = join(directory, 'catalog-index.json');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function fixture({ previous, alter = (_, body) => Response.json(body) } = {}) {
  const left = Array.from({ length: 26 }, (_, i) => ({ id: i + 1,
    alias: `left-${i + 1}`, name: { main: `Left ${i + 1}` }, year: 2024,
  }));
  const right = Array.from({ length: 49 }, (_, i) => ({ id: i + 1, title: `Right ${i + 1}`, year: '2024' }));
  const calls = [];
  const fetcher = async (input, { credentials, signal }) => {
    expect(credentials).toBe('omit');
    expect(signal).toBeInstanceOf(AbortSignal);
    const url = new URL(input);
    if (url.href === previousUrl) {
      calls.push('previous');
      return previous ? Response.json(previous) : new Response(null, { status: 404 });
    }
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
    return alter(key, body);
  };
  return { left, right, fetcher, calls };
}

function priorIndex(age) {
  return {
    version: 1,
    generatedAt: Date.now() - age,
    releases: [[{ alias: 'animevost:99', name: 'Old', year: 2020 }, { alias: 'aniliberty:old', name: 'Old', year: 2020 }]],
  };
}

it('groups unique title and year matches across full sweeps, keeping ambiguous and unknown years separate', async () => {
  const { left, right, fetcher, calls } = fixture();
  Object.assign(left[0], {
    name: { main: 'Ночь', english: 'Ｔhe　Night' },
    poster: { optimized: { preview: '/posters/night.webp' } },
    description: 'Not public', episodes: [{ video: 'https://example.test/video' }],
  });
  left[1].name.main = right[24].title = right[48].title = 'Ambiguous';
  left[2].name.main = right[2].title = 'Different year';
  right[2].year = '2023';
  left[3].name.main = right[3].title = 'Unknown year';
  delete left[3].year;
  Object.assign(right[25], { title: 'Другая ночь / the    night [TV]', urlImagePreview: 'http://animevost.org/uploads/posts/night.jpg' });

  await publishCatalogIndex(output, undefined, fetcher);

  expect(calls.slice(0, 2)).toEqual(['aniliberty:1', 'animevost:1']);
  expect(calls.filter((call) => call.startsWith('aniliberty'))).toEqual(['aniliberty:1', 'aniliberty:2']);
  expect(calls.filter((call) => call.startsWith('animevost'))).toEqual(['animevost:1', 'animevost:2', 'animevost:3']);
  const index = JSON.parse(readFileSync(output, 'utf8'));
  expect(index).toMatchObject({ version: 1, generatedAt: expect.any(Number) });
  expect(index.releases.slice(0, 4).map(([entry]) => entry.alias)).toEqual([
    'aniliberty:left-1', 'animevost:1', 'aniliberty:left-2', 'animevost:2',
  ]);
  expect(index.releases.filter((release) => release.length > 1)).toEqual([[
    { alias: 'aniliberty:left-1', name: 'Ночь', alternateName: 'Ｔhe　Night', year: 2024, poster: 'https://anilibria.top/posters/night.webp' },
    { alias: 'animevost:26', name: 'Другая ночь', alternateName: 'the    night', year: 2024, poster: 'https://animevost.org/uploads/posts/night.jpg' },
  ]]);
  expect(index.releases).toHaveLength(left.length + right.length - 1);
});

it.each(['truncated', 'duplicate', 'drifting count'])('does not publish an incomplete sweep (%s)', async (problem) => {
  const { left, right, fetcher, calls } = fixture({
    previous: priorIndex(8 * 24 * hour),
    alter(key, body) {
      if (key === 'animevost:3') {
        if (problem === 'truncated') body.data.pop();
        if (problem === 'duplicate') body.data[0].id = 1;
        if (problem === 'drifting count') body.state.count++;
      }
      return Response.json(body);
    },
  });
  left[0].name.main = right[0].title = right[48].title = 'Potential match';
  writeFileSync(output, 'old local index');

  await publishCatalogIndex(output, previousUrl, fetcher);

  expect(calls).toContain('animevost:3');
  expect(() => readFileSync(output)).toThrow(/ENOENT/);
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('publishing without an index'));
});

it('accepts a short public AnimeVost tail only after checking the exact next offset', async () => {
  const { left, right, fetcher, calls } = fixture({
    alter(key, body) {
      if (key.startsWith('animevost:')) body.state.count += 9;
      return Response.json(body);
    },
  });

  await publishCatalogIndex(output, undefined, fetcher);

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

  await publishCatalogIndex(output, undefined, fetcher);

  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases).toHaveLength(left.length + right.length);
  expect(console.warn).not.toHaveBeenCalled();
});

it('reuses a recent published index without fetching either provider', async () => {
  const previous = priorIndex(hour);
  const { fetcher, calls } = fixture({ previous });

  await publishCatalogIndex(output, previousUrl, fetcher);

  expect(calls).toEqual(['previous']);
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(previous);
});

it('does not reuse a recent index missing one provider', async () => {
  const previous = priorIndex(hour);
  previous.releases[0].pop();
  const { fetcher, calls, left, right } = fixture({ previous });

  await publishCatalogIndex(output, previousUrl, fetcher);

  expect(calls).toContain('animevost:3');
  const { releases } = JSON.parse(readFileSync(output, 'utf8'));
  expect(releases).toHaveLength(left.length + right.length);
});

it('keeps the complete, unchanged older index when only one provider fails', async () => {
  const previous = priorIndex(24 * hour);
  const { fetcher, calls } = fixture({ previous,
    alter: (key, body) => key === 'animevost:3' ? new Response(null, { status: 503 }) : Response.json(body),
  });

  await publishCatalogIndex(output, previousUrl, fetcher);

  expect(calls).toContain('aniliberty:2');
  expect(calls).toContain('animevost:3');
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(previous);
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('keeping the previous complete index'));
});
