import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginLogin, logout, readApi, restoreSession } from '../src/api';

const site = 'https://0n26.github.io';
const gateway = 'https://gateway.pyw0w.workers.dev';
const fragment = '#/anime/aniliberty/test?episode=2&source=animevost';
const tokenKey = '0n26:session';
const verifierKey = '0n26:login-verifier';
const token = 'opaque_token-123';
const verifier = 'ab'.repeat(32);
const profile = { id: 42, nickname: 'tester', avatar: null, tester: true };
const storage = new Map<string, string>();
const fetcher = vi.fn<typeof fetch>();
const location = {
  href: `${site}/${fragment}`,
  get hash() { return new URL(this.href).hash; },
  assign: vi.fn(),
  reload: vi.fn(),
};

function callback(query: string) {
  location.href = `${site}/?${query}${fragment}`;
}

beforeEach(() => {
  location.href = `${site}/${fragment}`;
  storage.clear();
  fetcher.mockReset();
  location.assign.mockClear();
  location.reload.mockClear();
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('location', location);
  vi.stubGlobal('window', { location });
  vi.stubGlobal('history', {
    state: null,
    replaceState: (_state: unknown, _unused: string, url: URL) => { location.href = url.href; },
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gateway session', () => {
  it('starts as a guest without calling the gateway and binds an explicit login to this tab and route', async () => {
    expect(await restoreSession()).toBe('guest');
    expect(fetcher).not.toHaveBeenCalled();

    await beginLogin();
    const savedVerifier = storage.get(verifierKey)!;
    expect(savedVerifier).toMatch(/^[a-f0-9]{64}$/);
    const url = new URL(location.assign.mock.calls[0][0]);
    expect(`${url.origin}${url.pathname}`).toBe(`${gateway}/auth/login`);
    expect([...url.searchParams]).toEqual([
      ['returnTo', `/${fragment}`],
      ['challenge', createHash('sha256').update(savedVerifier).digest('hex')],
    ]);
    expect(url.href).not.toContain(savedVerifier);
  });

  it('scrubs the handoff and consumes the verifier before exchange, then stores only a verified bearer', async () => {
    callback('login_code=handoff');
    storage.set(verifierKey, verifier);
    storage.set(tokenKey, 'old-token');
    fetcher.mockImplementationOnce(async () => {
      expect(location.href).toBe(`${site}/${fragment}`);
      expect(storage.size).toBe(0);
      return Response.json({ token });
    }).mockImplementationOnce(async () => {
      expect(storage.size).toBe(0);
      return Response.json(profile);
    });

    expect(await restoreSession()).toBe('signed-in');
    expect(fetcher).toHaveBeenNthCalledWith(1, `${gateway}/auth/exchange`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ code: 'handoff', verifier }),
      headers: { 'Content-Type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error',
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, `${gateway}/api/session`, expect.objectContaining({
      headers: { Authorization: `Bearer ${token}` }, credentials: 'omit', cache: 'no-store', redirect: 'error',
    }));
    expect([...storage]).toEqual([[tokenKey, token]]);
  });

  it.each([
    ['login_code=handoff', null, 'invalid'],
    ['login_code=one&login_code=two', verifier, 'invalid'],
    ['login_code=handoff&login_error=denied', verifier, 'invalid'],
    ['login_error=denied', verifier, 'denied'],
  ] as const)('fails closed on %s without trying an unbound or malformed handoff', async (query, savedVerifier, state) => {
    callback(query);
    storage.set(tokenKey, token);
    if (savedVerifier) storage.set(verifierKey, savedVerifier);

    expect(await restoreSession()).toBe(state);
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
    expect(location.href).toBe(`${site}/${fragment}`);
  });

  it('cannot retry a consumed exchange after a rejected code', async () => {
    callback('login_code=used');
    storage.set(verifierKey, verifier);
    fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

    expect(await restoreSession()).toBe('invalid');
    expect(await restoreSession()).toBe('guest');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(storage.size).toBe(0);
  });

  it.each([401, 503, 200])('discards a previously stored session on invalid verification (HTTP %s)', async (status) => {
    storage.set(tokenKey, token);
    fetcher.mockResolvedValueOnce(Response.json({ unexpected: true }, { status }));

    expect(await restoreSession()).toBe(status === 401 ? 'guest' : 'unavailable');
    expect(storage.size).toBe(0);
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('does not send a bearer to any other origin and clears a live session on HTTP 401', async () => {
    const signal = new AbortController().signal;
    storage.set(tokenKey, token);
    await expect(readApi('https://example.com/api/session', signal)).rejects.toThrow('invalid URL');
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(readApi('/api/catalog-index', signal)).rejects.toThrow('HTTP 401');
    expect(fetcher).toHaveBeenCalledWith(`${gateway}/api/catalog-index`, expect.objectContaining({
      signal, headers: { Authorization: `Bearer ${token}` },
    }));
    expect(location.reload).toHaveBeenCalledOnce();
    expect(storage.size).toBe(0);
    await expect(readApi('/api/catalog-index', signal)).rejects.toThrow('no session');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([204, 503])('clears the local session before POST logout (HTTP %s)', async (status) => {
    storage.set(tokenKey, token);
    fetcher.mockImplementationOnce(async () => {
      expect(storage.size).toBe(0);
      return new Response(null, { status });
    });

    if (status === 204) await expect(logout()).resolves.toBeUndefined();
    else await expect(logout()).rejects.toThrow('HTTP 503');
    expect(fetcher).toHaveBeenCalledWith(`${gateway}/auth/logout`, expect.objectContaining({
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, credentials: 'omit',
    }));
    expect(location.href).toBe(`${site}/${fragment}`);
  });
});
