import { expect, it, vi } from 'vitest';
import { createCombinedSource } from './combined';
import { parseCatalogIndex } from './catalogIndex';
import type { AnimeSource } from './source';

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

const main = { alias: 'aniliberty:hero', name: 'Герой', year: 2024 };
const dub = { alias: 'animevost:7', name: 'Hero', alternateName: 'Герой', year: 2024 };

it('paginates the index and searches names from either version without provider requests', async () => {
  const a = provider('aniliberty');
  const b = provider('animevost');
  const fillers = Array.from({ length: 48 * 199 }, (_, i) => [{ alias: `aniliberty:p${i}`, name: 'Другой' }]);
  const payload = { version: 1, generatedAt: Date.now(), releases: [...fillers, [main, dub]] };
  const source = createCombinedSource([a, b], async () => parseCatalogIndex(payload));

  await expect(source.getCatalog('', 200, signal)).resolves.toMatchObject({ items: [main], page: 200, totalPages: 200 });
  await expect(source.getCatalog('hero', 1, signal)).resolves.toMatchObject({ items: [main], totalPages: 1 });
  await expect(source.getVoices!('animevost:7', signal)).resolves.toEqual([
    { alias: 'animevost:7', source: 'animevost' }, { alias: 'aniliberty:hero', source: 'aniliberty' },
  ]);
  expect(a.getCatalog).not.toHaveBeenCalled();
  expect(b.getCatalog).not.toHaveBeenCalled();
});

it('loads the requested provider without waiting for the index or the original provider', async () => {
  const a = provider('aniliberty');
  a.getTitle.mockRejectedValue(new Error('HTTP 503'));
  const b = provider('animevost');
  const index = vi.fn(() => new Promise<null>(() => {}));
  const source = createCombinedSource([a, b], index);

  await expect(source.getTitle('animevost:7', signal)).resolves.toMatchObject({
    alias: 'animevost:7', episodes: [{ id: 'e2' }],
  });
  expect(a.getTitle).not.toHaveBeenCalled();
  expect(index).not.toHaveBeenCalled();
});

it('fetches only the requested page per provider if the index is expired', async () => {
  const a = provider('aniliberty');
  const b = provider('animevost');
  const payload = { version: 1, generatedAt: Date.now() - 8 * 86_400_000, releases: [[main, dub]] };
  const source = createCombinedSource([a, b], async () => parseCatalogIndex(payload));

  await expect(source.getCatalog('', 200, signal)).resolves.toMatchObject({
    items: [{ alias: 'aniliberty:200' }, { alias: 'animevost:200' }], page: 200,
  });
  expect(a.getCatalog.mock.calls.map(([, page]) => page)).toEqual([200]);
  expect(b.getCatalog.mock.calls.map(([, page]) => page)).toEqual([200]);
  await expect(source.getVoices!('aniliberty:hero', signal)).resolves.toEqual([]);
});

it('shows successful results on a partial failure and retries the failed provider on the next request', async () => {
  const a = provider('aniliberty');
  const b = provider('animevost');
  b.getCatalog.mockRejectedValueOnce(new Error('HTTP 503'));
  const source = createCombinedSource([a, b], async () => null);

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
    getCatalogFilters: vi.fn(async () => ({ genres: [{ id: 1, name: 'Комедия' }], years: [2023] })),
  };
  const b = provider('animevost');
  const source = createCombinedSource([a, b], async () => null);

  await expect(source.getCatalog('', 1, signal, { genres: [1, 8], year: 2023 })).resolves.toMatchObject({
    items: [{ alias: 'aniliberty:1' }],
  });
  expect(a.getCatalog).toHaveBeenCalledWith('', 1, signal, { genres: [1, 8], year: 2023 });
  expect(b.getCatalog).not.toHaveBeenCalled();

  await expect(source.getCatalog('', 1, signal, { genres: [] })).resolves.toMatchObject({
    items: [{ alias: 'aniliberty:1' }, { alias: 'animevost:1' }],
  });
});
