const gatewayOrigin = 'https://gateway.pyw0w.workers.dev';
const callbackPath = '/auth/callback';
const callbackUrl = `https://0n26.github.io${callbackPath}`;
const tokenKey = '0n26:session';
const verifierKey = '0n26:login-verifier';
const attemptKey = '0n26:login-attempt';

export type SessionState = 'signed-in' | 'guest' | 'denied' | 'invalid' | 'unavailable';

function gatewayFetch(path: string, init: RequestInit) {
  const url = new URL(path, gatewayOrigin);
  if (url.origin !== gatewayOrigin) throw new Error('Gateway: invalid URL');
  return fetch(url.href, { ...init, cache: 'no-store', credentials: 'omit', redirect: 'error' });
}

function postAuth(path: string, body: object) {
  return gatewayFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeout(),
  });
}

type AccountAction = 'register' | 'login' | 'request-reset' | 'reset' | 'request-upgrade' | 'upgrade'
  | 'connections' | 'link-start' | 'link-complete' | 'unlink';

export async function accountRequest(action: AccountAction, body: Record<string, string> = {}, signal = timeout()): Promise<unknown> {
  const token = sessionStorage.getItem(tokenKey);
  const response = await gatewayFetch(`/auth/account/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(isBearer(token) ? bearer(token) : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, timeout()]),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('Слишком много попыток. Попробуйте позже.');
    if (response.status === 409) throw new Error('Не удалось выполнить действие: адрес или аккаунт уже используется.');
    if (response.status === 403) throw new Error('Действие недоступно для этого аккаунта или приглашения.');
    if (response.status === 400 || response.status === 401) throw new Error('Проверьте данные. Ссылка или код могли истечь.');
    throw new Error('Сервис аккаунтов недоступен. Попробуйте позже.');
  }
  if (action === 'reset') sessionStorage.removeItem(tokenKey);
  return response.json();
}

export async function openLocalSession(action: 'login' | 'register', body: Record<string, string>) {
  const result = await accountRequest(action, body);
  const token = (result as { token?: unknown } | null)?.token;
  if (!isBearer(token) || await verifySession(token) !== 'signed-in') {
    throw new Error('Не удалось подтвердить сессию.');
  }
}

function isCredential(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isReturnPath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 2048 && /^\/#\/[^\u0000-\u0020\u007f\\]*$/u.test(value);
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

export async function beginLogin(link = false) {
  const verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const hashPath = `/${location.hash}`;
  const returnTo = link ? '/#/profile' : isReturnPath(hashPath) ? hashPath : '/#/';
  const response = link ? null : await postAuth('/auth/start', { returnTo, challenge });
  if (response && !response.ok) throw new Error('Не удалось начать вход через Shikimori.');
  const data = (response ? await response.json() : await accountRequest('link-start', { challenge })) as { url?: unknown };
  if (typeof data?.url !== 'string') throw new Error('Invalid authorization URL');
  const url = new URL(data.url);
  const [state, ...extraStates] = url.searchParams.getAll('state');
  const [redirect, ...extraRedirects] = url.searchParams.getAll('redirect_uri');
  if (url.origin !== 'https://shikimori.io' || url.pathname !== '/oauth/authorize' || url.username || url.password
    || redirect !== callbackUrl || extraRedirects.length || !isCredential(state) || extraStates.length) {
    throw new Error('Invalid authorization URL');
  }
  sessionStorage.setItem(attemptKey, JSON.stringify({ state, verifier, returnTo, ...(link && { link: true }) }));
  location.assign(url.href);
}

function consumeAttempt() {
  const saved = sessionStorage.getItem(attemptKey);
  sessionStorage.removeItem(attemptKey);
  if (!saved) return null;
  try {
    const attempt = JSON.parse(saved);
    if (isCredential(attempt?.state) && isCredential(attempt.verifier) && isReturnPath(attempt.returnTo)) {
      return { state: attempt.state, verifier: attempt.verifier, returnTo: attempt.returnTo, link: attempt.link === true };
    }
  } catch {
    // An unreadable attempt cannot authenticate this tab.
  }
  return null;
}

async function completeCallback(url: URL): Promise<SessionState> {
  history.replaceState(history.state, '', '/');
  const attempt = consumeAttempt();
  if (attempt?.link) {
    const token = sessionStorage.getItem(tokenKey);
    const state = url.searchParams.getAll('state');
    const code = url.searchParams.getAll('code');
    let linked = false;
    if (isBearer(token) && state.length === 1 && state[0] === attempt.state
      && code.length === 1 && code[0] && code[0].length <= 2048 && !url.searchParams.has('error')) {
      try {
        await accountRequest('link-complete', { state: state[0], code: code[0], verifier: attempt.verifier });
        linked = true;
      } catch {
        // A failed connection must not end the site session.
      }
    }
    history.replaceState(history.state, '', `/#/profile?connection=${linked ? 'linked' : 'failed'}`);
    return isBearer(token) ? verifySession(token) : 'guest';
  }
  sessionStorage.removeItem(tokenKey);
  if (!attempt) return 'invalid';
  history.replaceState(history.state, '', attempt.returnTo);

  const [state, ...extraStates] = url.searchParams.getAll('state');
  if (state !== attempt.state || extraStates.length) return 'invalid';
  const [code, ...extraCodes] = url.searchParams.getAll('code');
  const [error, ...extraErrors] = url.searchParams.getAll('error');
  if (error !== undefined) {
    return error === 'access_denied' && !extraErrors.length && code === undefined ? 'denied' : 'invalid';
  }
  if (!code || code.length > 2048 || extraCodes.length) return 'invalid';

  const response = await postAuth('/auth/complete', { code, state, verifier: attempt.verifier });
  if (response.status === 401) return 'invalid';
  if (response.status === 403) return 'denied';
  if (!response.ok) return 'unavailable';
  const data = await response.json();
  if (!isBearer(data?.token) || data.returnTo !== attempt.returnTo) return 'unavailable';
  return verifySession(data.token);
}

async function verifySession(token: string): Promise<SessionState> {
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
}

export async function restoreSession(): Promise<SessionState> {
  try {
    const url = new URL(location.href);
    if (url.pathname === callbackPath || url.pathname === `${callbackPath}/`) return await completeCallback(url);

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
      if (codes.length !== 1 || !codes[0] || errors.length || !isCredential(verifier)) {
        return 'invalid';
      }
      const exchange = await postAuth('/auth/exchange', { code: codes[0], verifier });
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
    return isBearer(token) ? await verifySession(token) : 'guest';
  } catch {
    return 'unavailable';
  }
}

export async function logout() {
  const token = sessionStorage.getItem(tokenKey);
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(verifierKey);
  sessionStorage.removeItem(attemptKey);
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
