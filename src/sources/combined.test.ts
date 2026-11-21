import { expect, it, vi } from 'vitest';
import { createCombinedSource } from './combined';
import type { AnimeSource, CatalogEntry } from './source';

const signal = new AbortController().signal;

function provider(key: string, pages: readonly (readonly CatalogEntry[])[], search = pages) {
  return {
    key,
    name: key,
    getCatalog: vi.fn<AnimeSource['getCatalog']>(async (query, page) => {
      const results = query ? search : pages;
      return { page, items: results[page - 1] ?? [], totalPages: results.length };
    }),
    async getTitle(alias) {
      const entry = pages.flat().find((item) => item.alias === alias);
      return entry ? { ...entry, episodes: [] } : null;
    },
  } satisfies AnimeSource;
}

it('shows a match once across provider pages and finds both variants when the title opens', async () => {
  const original = { alias: 'hero', name: 'Герой', alternateName: 'Hero', year: 2024 };
  const variant = { alias: '7', name: 'Hero', year: 2024 };
  const other = { alias: '8', name: 'Другой релиз', year: 2024 };
  const a = provider('aniliberty', [[original]]);
  const b = provider('animevost', [[other], [variant]]);
  const source = createCombinedSource([a, b]);

  const first = await source.getCatalog('', 1, signal);
  expect(first.items.map(({ alias }) => alias)).toEqual(['aniliberty:hero', 'animevost:8']);
  expect(a.getCatalog).toHaveBeenCalledTimes(1);
  expect(b.getCatalog).toHaveBeenCalledTimes(1);

  await expect(source.getCatalog('', 2, signal)).resolves.toMatchObject({ items: [], page: 2, totalPages: 2 });
  expect(a.getCatalog).toHaveBeenCalledTimes(1);
  expect(b.getCatalog).toHaveBeenCalledTimes(2);
  await expect(createCombinedSource([a, b]).getCatalog('', 2, signal)).resolves.toMatchObject({ items: [] });

  const title = await source.getTitle(first.items[0].alias, signal);
  expect(title?.voices?.map(({ alias }) => alias)).toEqual(['aniliberty:hero', 'animevost:7']);
});

it.each([undefined, 2024])('keeps ambiguous matches separate when the variant year is %s', async (year) => {
  const first = { alias: 'first', name: 'Герой', year: year ?? 2020 };
  const second = { alias: 'second', name: 'Герой', year: 2024 };
  const a = provider('aniliberty', [[first, second]]);
  const b = provider('animevost', [[{ alias: '7', name: 'Герой', year }]]);
  const source = createCombinedSource([a, b]);

  const result = await source.getCatalog('', 1, signal);
  expect(result.items.map(({ alias }) => alias).sort()).toEqual([
    'aniliberty:first', 'aniliberty:second', 'animevost:7',
  ]);
  for (const { alias } of result.items) {
    const title = await source.getTitle(alias, signal);
    expect(title).not.toBeNull();
    expect(title?.voices?.some(({ sourceKey }) => !alias.startsWith(`${sourceKey}:`)) ?? false).toBe(false);
  }
});

it('retries a failed source instead of caching an incomplete page', async () => {
  const a = provider('aniliberty', [[{ alias: 'hero', name: 'Герой' }]]);
  const b = provider('animevost', [[{ alias: '7', name: 'Другой релиз' }]]);
  b.getCatalog.mockRejectedValueOnce(new Error('HTTP 503'));
  const source = createCombinedSource([a, b]);

  await expect(source.getCatalog('', 1, signal)).resolves.toMatchObject({
    incomplete: true, items: [{ alias: 'aniliberty:hero' }],
  });
  const retry = await source.getCatalog('', 1, signal);
  expect(retry.incomplete).not.toBe(true);
  expect(retry.items.map(({ alias }) => alias)).toEqual(['aniliberty:hero', 'animevost:7']);
});
