import { afterEach, expect, it, vi } from 'vitest';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { requestPasskeyCredential } from '../src/passkeys';

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => true,
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it('does not finish or redeem an invitation when the browser cancels key creation', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ attempt: 'a'.repeat(64), options: {} }));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('sessionStorage', { getItem: () => null });
  vi.mocked(startRegistration).mockRejectedValueOnce(new DOMException('Cancelled', 'NotAllowedError'));

  await expect(requestPasskeyCredential('register', { invite: 'b'.repeat(64), nickname: 'Tester' }))
    .rejects.toMatchObject({ name: 'NotAllowedError' });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(startAuthentication).not.toHaveBeenCalled();
});
