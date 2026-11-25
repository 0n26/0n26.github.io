import { expect, it } from 'vitest';
import { refreshCatalogAvailability } from '../../scripts/catalog-availability.mjs';

const entries = (source, ...aliases) => aliases.map((alias) => ({ alias: `${source}:${alias}` }));
const playable = (alias) => ({ alias, episodes: [{ streams: [{ url: 'https://video.test/episode' }] }] });
const result = (playable) => ({ checkedAt: expect.any(Number), playable });

it('uses provider title normalization and persists only availability, never tracks', async () => {
  const calls = [];
  const availability = await refreshCatalogAvailability([
    entries('aniliberty', 'open', 'blocked', 'unknown', 'insecure', 'unreleased', 'missing'),
    entries('animevost', '51', '52'),
  ], {
    fetcher: async (input, { credentials, signal, body }) => {
      const url = new URL(input);
      calls.push({ path: url.pathname, credentials, signal });
      if (url.hostname === 'api.animetop.info') {
        const id = Number(body.get('id'));
        if (url.pathname === '/v1/info') return Response.json({ state: { status: 'ok' }, data: [{ id, title: 'Title' }] });
        return Response.json([{ name: '1 серия', hd: id === 51 ? 'http://video.animetop.info/1.mp4' : 'https://other.test/1.mp4' }]);
      }
      const alias = url.pathname.split('/').at(-1);
      if (alias === 'missing') return new Response(null, { status: 404 });
      return Response.json({
        alias, is_blocked_by_geo: alias === 'unknown' ? undefined : alias === 'blocked',
        is_blocked_by_copyrights: false,
        episodes: alias === 'unreleased' ? [] : [
          { id: '1', ordinal: 1 },
          { id: '2', ordinal: 2, hls_720: `${alias === 'insecure' ? 'http' : 'https'}://video.test/2.m3u8` },
        ],
      });
    },
  });

  expect(availability).toEqual({
    'aniliberty:open': result(true), 'aniliberty:blocked': result(false), 'aniliberty:unknown': result(false),
    'aniliberty:insecure': result(false), 'aniliberty:unreleased': result(false), 'aniliberty:missing': result(false),
    'animevost:51': result(true), 'animevost:52': result(false),
  });
  expect(calls).toHaveLength(10);
  for (const { path, credentials, signal } of calls) {
    expect(path).toMatch(/^(\/api\/v1\/anime\/releases\/|\/v1\/(info|playlist)$)/);
    expect(credentials).toBe('omit');
    expect(signal).toBeInstanceOf(AbortSignal);
  }
});

it('preserves known results on transient failures but allows a definitive negative to clear one', async () => {
  const previous = {
    'aniliberty:server-error': { checkedAt: 1, playable: true },
    'aniliberty:gone': { checkedAt: 1, playable: true },
    'aniliberty:wrong-alias': { checkedAt: 1, playable: true },
    'animevost:51': { checkedAt: 1, playable: false },
    'animevost:removed-from-catalog': { checkedAt: 1, playable: true },
  };
  const availability = await refreshCatalogAvailability([
    entries('aniliberty', 'server-error', 'gone', 'wrong-alias', 'bad-json'),
    entries('animevost', '51'),
  ], {
    previous,
    fetcher: async (input) => {
      const route = new URL(input).pathname.split('/').at(-1);
      if (route === 'server-error') return new Response(null, { status: 503 });
      if (route === 'gone') return new Response(null, { status: 404 });
      if (route === 'wrong-alias') return Response.json({ alias: 'another-title' });
      if (route === 'bad-json') return new Response('not JSON');
      throw new TypeError('network failure');
    },
  });

  expect(availability).toEqual({
    'aniliberty:server-error': result(true), 'aniliberty:gone': result(false),
    'aniliberty:wrong-alias': result(true), 'aniliberty:bad-json': { checkedAt: expect.any(Number) },
    'animevost:51': result(false),
  });
  expect(availability['aniliberty:server-error'].checkedAt).toBeGreaterThan(1);
  expect(previous['aniliberty:gone']).toEqual({ checkedAt: 1, playable: true });
});

it('limits each run and rotates across providers even when every unchecked lookup fails', async () => {
  const calls = [];
  const sources = ['a', 'b'].map((key) => ({
    key,
    async getTitle(alias) {
      calls.push(`${key}:${alias}`);
      throw new Error('unavailable');
    },
  }));
  const catalogs = [entries('a', '1', '2', '3'), entries('b', '1', '2')];
  const first = await refreshCatalogAvailability(catalogs, { sources, limit: 2 });
  const second = await refreshCatalogAvailability(catalogs, { sources, limit: 2, previous: first });
  const third = await refreshCatalogAvailability(catalogs, { sources, limit: 1, previous: second });

  expect(Object.keys(first)).toEqual(['a:1', 'b:1']);
  expect(calls).toEqual(['a:1', 'b:1', 'a:2', 'b:2', 'a:3']);
  expect(third).toEqual(Object.fromEntries(calls.map((alias) => [alias, { checkedAt: expect.any(Number) }])));
});

it('bounds simultaneous title checks and does not commit aborted probes', async () => {
  const controller = new AbortController();
  const pending = [];
  const sources = [{
    key: 'a',
    getTitle(alias, signal) {
      const { promise, resolve, reject } = Promise.withResolvers();
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      pending.push({ alias, resolve });
      return promise;
    },
  }];
  const previous = { 'a:1': { checkedAt: 1, playable: false }, 'a:2': { checkedAt: 1, playable: true } };
  const refresh = refreshCatalogAvailability([entries('a', '1', '2', '3', '4', '5', '6', '7')], {
    previous, sources, signal: controller.signal,
  });

  expect(pending.map(({ alias }) => alias)).toEqual(['3', '4', '5', '6']);
  pending[0].resolve(playable('3'));
  await Promise.resolve();
  expect(pending.map(({ alias }) => alias)).toEqual(['3', '4', '5', '6', '7']);
  controller.abort();

  expect(await refresh).toEqual({ ...previous, 'a:3': result(true) });
  expect(pending).toHaveLength(5);
});
