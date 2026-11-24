const gatewayOrigin = 'https://gateway.pyw0w.workers.dev';
const tokenKey = '0n26:session';
const verifierKey = '0n26:login-verifier';

export type SessionState = 'signed-in' | 'guest' | 'denied' | 'invalid' | 'unavailable';

function gatewayFetch(path: string, init: RequestInit) {
  const url = new URL(path, gatewayOrigin);
  if (url.origin !== gatewayOrigin) throw new Error('Gateway: invalid URL');
  return fetch(url.href, { ...init, cache: 'no-store', credentials: 'omit', redirect: 'error' });
}

function isBearer(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._~+/-]+=*$/.test(value);
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function timeout() {
  return AbortSignal.timeout(10_000);
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function beginLogin() {
  const verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const returnTo = `/${location.hash.startsWith('#/') ? location.hash : '#/'}`;
  sessionStorage.setItem(verifierKey, verifier);
  location.assign(`${gatewayOrigin}/auth/login?${new URLSearchParams({ returnTo, challenge })}`);
}

export async function restoreSession(): Promise<SessionState> {
  try {
    const url = new URL(location.href);
    const codes = url.searchParams.getAll('login_code');
    const errors = url.searchParams.getAll('login_error');
    let token: unknown;
    if (codes.length || errors.length) {
      url.searchParams.delete('login_code');
      url.searchParams.delete('login_error');
      history.replaceState(history.state, '', url);

      sessionStorage.removeItem(tokenKey);
      const verifier = sessionStorage.getItem(verifierKey);
      sessionStorage.removeItem(verifierKey);
      if (!codes.length && errors.length === 1) {
        if (errors[0] === 'denied' || errors[0] === 'unavailable') return errors[0];
        return 'invalid';
      }
      if (codes.length !== 1 || !codes[0] || errors.length || !verifier || !/^[a-f0-9]{64}$/.test(verifier)) {
        return 'invalid';
      }
      const exchange = await gatewayFetch('/auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codes[0], verifier }),
        signal: timeout(),
      });
      if (exchange.status === 400 || exchange.status === 401) return 'invalid';
      if (!exchange.ok) return 'unavailable';
      const data = await exchange.json();
      token = data?.token;
      if (!isBearer(token)) return 'unavailable';
    } else {
      token = sessionStorage.getItem(tokenKey);
      // A reload during validation must not reuse an unverified token.
      sessionStorage.removeItem(tokenKey);
    }
    if (!isBearer(token)) return 'guest';
    const session = await gatewayFetch('/api/session', { headers: bearer(token), signal: timeout() });
    if (session.status === 401 || session.status === 403) return 'guest';
    if (!session.ok) return 'unavailable';
    const profile = await session.json();
    if (!Number.isSafeInteger(profile?.id) || profile.id < 1 || typeof profile.nickname !== 'string'
      || (profile.avatar !== null && typeof profile.avatar !== 'string') || typeof profile.tester !== 'boolean') {
      return 'unavailable';
    }
    sessionStorage.setItem(tokenKey, token);
    return 'signed-in';
  } catch {
    return 'unavailable';
  }
}

export async function logout() {
  const token = sessionStorage.getItem(tokenKey);
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(verifierKey);
  if (!isBearer(token)) return;
  const response = await gatewayFetch('/auth/logout', { method: 'POST', headers: bearer(token), signal: timeout() });
  if (response.status !== 204 && response.status !== 401) throw new Error(`Gateway: HTTP ${response.status}`);
}

export function readApi<T>(path: string, signal: AbortSignal): Promise<T>;
export function readApi<T>(path: string, signal: AbortSignal, missing: null): Promise<T | null>;
export async function readApi<T>(path: string, signal: AbortSignal, missing?: null): Promise<T | null> {
  const token = sessionStorage.getItem(tokenKey);
  if (!isBearer(token)) throw new Error('Gateway: no session');
  const response = await gatewayFetch(path, { headers: bearer(token), signal });
  if (response.status === 401 && sessionStorage.getItem(tokenKey) === token) {
    sessionStorage.removeItem(tokenKey);
    window.location.reload();
  }
  if (response.status === 404 && missing === null) return null;
  if (!response.ok) throw new Error(`Gateway: HTTP ${response.status}`);
  return response.json();
}
