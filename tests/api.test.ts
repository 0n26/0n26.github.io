import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginLogin, logout, openLocalSession, readApi, restoreSession } from '../src/api';

const site = 'https://0n26.github.io';
const gateway = 'https://gateway.pyw0w.workers.dev';
const fragment = '#/anime/aniliberty/test?episode=2&source=animevost';
const tokenKey = '0n26:session';
const attemptKey = '0n26:login-attempt';
const verifierKey = '0n26:login-verifier';
const token = 'opaque_token-123';
const verifier = 'ab'.repeat(32);
const oauthState = 'cd'.repeat(32);
const returnTo = `/${fragment}`;
const authorize = new URL('https://shikimori.io/oauth/authorize');
authorize.search = new URLSearchParams({
  state: oauthState, redirect_uri: `${site}/auth/callback`,
}).toString();
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

function saveAttempt(path = returnTo) {
  storage.set(attemptKey, JSON.stringify({ state: oauthState, verifier, returnTo: path }));
}

function directCallback(query: string, path = '/auth/callback') {
  location.href = `${site}${path}?${query}`;
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
    replaceState: (_state: unknown, _unused: string, url: string | URL) => { location.href = new URL(url, site).href; },
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

it('only saves a local login token after verifying the site session', async () => {
  fetcher.mockResolvedValueOnce(Response.json({ token }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }));
  await expect(openLocalSession('login', { email: 'test@example.org', password: 'test password' })).rejects.toThrow();
  expect(storage.has(tokenKey)).toBe(false);
  fetcher.mockResolvedValueOnce(Response.json({ token })).mockResolvedValueOnce(Response.json(profile));
  await openLocalSession('login', { email: 'test@example.org', password: 'test password' });
  expect(storage.get(tokenKey)).toBe(token);
});

it.each([200, 409])('completes Shikimori linking without replacing the site session (%s)', async status => {
  directCallback(`code=provider-code&state=${oauthState}`);
  storage.set(tokenKey, token);
  storage.set(attemptKey, JSON.stringify({ state: oauthState, verifier, returnTo: '/#/profile', link: true }));
  fetcher.mockImplementationOnce(async (_url, init) => {
    expect(location.href).toBe(`${site}/`);
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${token}` });
    return Response.json({}, { status });
  }).mockResolvedValueOnce(Response.json(profile));

  expect(await restoreSession()).toBe('signed-in');
  expect(fetcher).toHaveBeenNthCalledWith(1, `${gateway}/auth/account/link-complete`, expect.objectContaining({
    body: JSON.stringify({ state: oauthState, code: 'provider-code', verifier }),
  }));
  expect(storage.get(tokenKey)).toBe(token);
  expect(storage.has(attemptKey)).toBe(false);
  expect(location.href).toBe(`${site}/#/profile?connection=${status === 200 ? 'linked' : 'failed'}`);
});

describe('Gateway session', () => {
  it('starts as a guest without calling the gateway and binds an explicit login to this tab and route', async () => {
    expect(await restoreSession()).toBe('guest');
    expect(fetcher).not.toHaveBeenCalled();

    fetcher.mockResolvedValueOnce(Response.json({ url: authorize.href }));
    await beginLogin();
    const attempt = JSON.parse(storage.get(attemptKey)!);
    expect(attempt).toEqual({ state: oauthState, verifier: expect.stringMatching(/^[a-f0-9]{64}$/), returnTo });
    expect(fetcher).toHaveBeenCalledWith(`${gateway}/auth/start`, expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnTo, challenge: createHash('sha256').update(attempt.verifier).digest('hex') }),
      credentials: 'omit', cache: 'no-store', redirect: 'error',
    }));
    expect(location.assign).toHaveBeenCalledExactlyOnceWith(authorize.href);
    expect(authorize.href).not.toContain(attempt.verifier);
  });

  it.each([
    authorize.href.replace('shikimori.io', 'other.example'),
    authorize.href.replace('auth%2Fcallback', 'auth%2Fcallback%2F'),
    `${authorize.href}&state=${oauthState}`,
  ])('does not navigate to an invalid authorization URL: %s', async (url) => {
    fetcher.mockResolvedValueOnce(Response.json({ url }));

    await expect(beginLogin()).rejects.toThrow('Invalid authorization URL');
    expect(location.assign).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it.each(['/auth/callback', '/auth/callback/'])('finishes at %s without sending OAuth parameters in the address', async (path) => {
    directCallback(`code=provider%2Bcode&state=${oauthState}`, path);
    saveAttempt();
    storage.set(tokenKey, 'old-token');
    fetcher.mockImplementationOnce(async () => {
      expect(location.href).toBe(`${site}${returnTo}`);
      expect(storage.size).toBe(0);
      return Response.json({ token, returnTo });
    }).mockImplementationOnce(async () => {
      expect(storage.size).toBe(0);
      return Response.json(profile);
    });

    expect(await restoreSession()).toBe('signed-in');
    expect(fetcher).toHaveBeenNthCalledWith(1, `${gateway}/auth/complete`, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ code: 'provider+code', state: oauthState, verifier }),
      headers: { 'Content-Type': 'application/json' }, credentials: 'omit', cache: 'no-store', redirect: 'error',
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, `${gateway}/api/session`, expect.objectContaining({
      headers: { Authorization: `Bearer ${token}` },
    }));
    expect([...storage]).toEqual([[tokenKey, token]]);
  });

  it.each([
    [`code=one&code=two&state=${oauthState}`, 'invalid'],
    [`code=one&state=${oauthState}&state=${oauthState}`, 'invalid'],
    [`code=one&state=${verifier}`, 'invalid'],
    [`code=one&error=access_denied&state=${oauthState}`, 'invalid'],
    [`error=access_denied&error_description=private&state=${oauthState}`, 'denied'],
  ] as const)('scrubs %s and consumes the attempt without calling Gateway', async (query, state) => {
    directCallback(query);
    saveAttempt();

    expect(await restoreSession()).toBe(state);
    expect(location.href).toBe(`${site}${returnTo}`);
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it.each([undefined, '//other.example/#/profile/1'])('rejects a missing or unsafe tab attempt: %s', async (path) => {
    directCallback(`code=one&state=${oauthState}`);
    if (path) saveAttempt(path);

    expect(await restoreSession()).toBe('invalid');
    expect(location.href).toBe(`${site}/`);
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it.each([
    [401, 'invalid'],
    [403, 'denied'],
    [503, 'unavailable'],
  ] as const)('preserves the route and cannot retry a consumed callback (HTTP %s)', async (status, error) => {
    directCallback(`code=one&state=${oauthState}`);
    saveAttempt();
    fetcher.mockResolvedValueOnce(Response.json({ error }, { status }));

    expect(await restoreSession()).toBe(error);
    expect(location.href).toBe(`${site}${returnTo}`);
    expect(await restoreSession()).toBe('guest');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(storage.size).toBe(0);
  });

  it('does not accept a bearer for a different return path', async () => {
    directCallback(`code=one&state=${oauthState}`);
    saveAttempt();
    fetcher.mockResolvedValueOnce(Response.json({ token, returnTo: '/#/profile/1' }));

    expect(await restoreSession()).toBe('unavailable');
    expect(location.href).toBe(`${site}${returnTo}`);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(storage.size).toBe(0);
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
