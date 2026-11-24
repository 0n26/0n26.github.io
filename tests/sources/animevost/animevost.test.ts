import { expect, it, vi } from 'vitest';
import { createAnimeVost } from '../../../src/sources/animevost/index';

const signal = new AbortController().signal;

it('paginates unpaged search results, independently of the zero count returned by search', async () => {
  const data = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, title: `Тайтл ${i + 1}` }));
  const source = createAnimeVost(async (_url, init) => {
    expect(init?.body?.toString()).toBe('name=A%26B');
    return Response.json({ state: { status: 'ok', count: 0 }, data });
  });
  await expect(source.getCatalog('A&B', 2, signal)).resolves.toMatchObject({
    items: [{ alias: '25', name: 'Тайтл 25' }], page: 2, totalPages: 2,
  });
});

it('splits only the first spaced slash and removes only trailing catalog metadata', async () => {
  const source = createAnimeVost(async () => Response.json({
    state: { status: 'ok', count: 4 }, data: [
      { id: 1, title: 'Судьба/Апокриф / Fate/Apocrypha [1-25 из 25] [OVA 1 из 1]' },
      { id: 2, title: 'Ранма 1/2 / Ranma 1/2 / [Subtitle] [1-8 из 12+] [9 серия - 28 ноября]' },
      { id: 3, title: 'Судьба/Апокриф [1 из 1]' },
      { id: 4, title: 'Тайтл [Имя] / [Name] Story [Subtitle]' },
    ],
  }));
  const { items } = await source.getCatalog('', 1, signal);
  expect(items.map(({ name, alternateName }) => [name, alternateName])).toEqual([
    ['Судьба/Апокриф', 'Fate/Apocrypha'],
    ['Ранма 1/2', 'Ranma 1/2 / [Subtitle]'],
    ['Судьба/Апокриф', undefined],
    ['Тайтл [Имя]', '[Name] Story [Subtitle]'],
  ]);
});

it('loads the catalog without URL.parse and ignores a malformed poster without losing the title', async () => {
  const source = createAnimeVost(async () => Response.json({
    state: { status: 'ok', count: 2 }, data: [
      { id: 1, title: 'Первый', urlImagePreview: 'http://animevost.org/uploads/posts/1.jpg' },
      { id: 2, title: 'Второй', urlImagePreview: 'invalid url' },
    ],
  }));
  class LegacyURL extends URL {}
  Object.defineProperty(LegacyURL, 'parse', { value: undefined });
  vi.stubGlobal('URL', LegacyURL);
  try {
    const { items } = await source.getCatalog('', 1, signal);
    expect(items.map(({ alias, poster }) => [alias, poster])).toEqual([
      ['1', 'https://animevost.org/uploads/posts/1.jpg'], ['2', undefined],
    ]);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('only exposes provider MP4s over HTTPS, keeps special episodes and rejects foreign image URLs', async () => {
  const source = createAnimeVost(async (url) => String(url).endsWith('/info') ? Response.json({
    state: { status: 'ok' }, data: [{ id: 4, title: 'Тайтл', urlImagePreview: 'https://animevost.org.evil.test/uploads/posts/p.jpg' }],
  }) : Response.json([
    { name: '2 серия', hd: 'https://user@video.animetop.info/720/12.mp4', std: 'http://video.animetop.info/12.mp4' },
    { name: 'ОВА', hd: 'https://example.com/evil.mp4', std: 'https://video.animetop.info/playlist.m3u8' },
  ]));
  const title = await source.getTitle('4', signal);
  expect(title?.poster).toBeUndefined();
  expect(title?.episodes).toMatchObject([
    { id: '12', number: 2, streams: [{ quality: 480, url: 'https://video.animetop.info/12.mp4' }] },
    { name: 'ОВА', streams: [] },
  ]);
});

it('returns a missing title without requesting playback; network errors stay errors', async () => {
  const source = createAnimeVost(async (url) => {
    if (String(url).endsWith('/info')) return Response.json({ state: { status: 'fail' }, data: [] });
    return new Response(null, { status: 503 });
  });
  await expect(source.getTitle('99999999', signal)).resolves.toBeNull();
  await expect(source.getCatalog('A', 1, signal)).rejects.toThrow('503');
});
