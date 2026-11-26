import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { accountRequest } from './api';

type Ceremony = 'register' | 'login' | 'recover' | 'upgrade' | 'add';

export async function requestPasskeyCredential(action: Ceremony, input: Record<string, string> = {}) {
  if (!browserSupportsWebAuthn()) {
    throw new Error('Этот браузер не поддерживает ключи доступа. Откройте сайт в актуальном Safari, Chrome или Firefox.');
  }
  const start = await accountRequest(`${action}-start`, input) as { attempt?: unknown; options?: unknown } | null;
  if (!start || typeof start.attempt !== 'string' || !/^[a-f0-9]{64}$/.test(start.attempt)
    || !start.options || typeof start.options !== 'object') {
    throw new Error('Сервис не вернул параметры ключа. Начните заново.');
  }
  const credential = action === 'login'
    ? await startAuthentication({ optionsJSON: start.options as PublicKeyCredentialRequestOptionsJSON })
    : await startRegistration({ optionsJSON: start.options as PublicKeyCredentialCreationOptionsJSON });
  return accountRequest(`${action}-finish`, { attempt: start.attempt, credential });
}

export function getRecoveryCode(result: unknown) {
  const code = (result as { recoveryCode?: unknown } | null)?.recoveryCode;
  if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) throw new Error('Не удалось получить код восстановления.');
  return code;
}

export function passkeyError(error: unknown): string {
  if (error instanceof Error) {
    if (['NotAllowedError', 'AbortError', 'InvalidStateError', 'NotSupportedError', 'SecurityError'].includes(error.name)) {
      return 'Ключ не удалось использовать или запрос был отменён. Проверьте устройство и попробуйте ещё раз.';
    }
    if (!(error instanceof TypeError)) return error.message;
  }
  return 'Не удалось связаться с сервисом. Попробуйте ещё раз.';
}
