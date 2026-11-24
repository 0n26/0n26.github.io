import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../../public/pwa-cache-cleanup.js', import.meta.url), 'utf8');
const scope = 'https://0n26.github.io/';
const legacy = `workbox-precache-v2-${scope}`;
const current = `0n26-precache-v2-${scope}`;
const unrelated = `workbox-precache-v2-${scope}other-app/`;

it.each([true, false])('cleans up only the old precache for this scope (legacy present: %s)', async (hasLegacy) => {
  const keys = new Set([current, unrelated, ...(hasLegacy ? [legacy] : [])]);
  const handlers = new Map();
  const skipWaiting = vi.fn();
  runInNewContext(script, {
    self: { registration: { scope }, addEventListener: (type, handler) => handlers.set(type, handler), skipWaiting },
    caches: { has: async key => keys.has(key), delete: async key => keys.delete(key) },
  });

  expect([...handlers.keys()]).toEqual(['install', 'activate']);
  const waitUntil = vi.fn();
  handlers.get('install')({ waitUntil });
  await waitUntil.mock.calls[0][0];
  expect(skipWaiting).toHaveBeenCalledTimes(Number(hasLegacy));
  handlers.get('activate')({ waitUntil });
  await waitUntil.mock.calls[1][0];
  expect([...keys]).toEqual([current, unrelated]);
});
