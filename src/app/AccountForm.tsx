import { Alert, Anchor, Button, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { openLocalSession } from '../api';
import { RecoveryCode } from '../components/RecoveryCode';
import { getRecoveryCode, passkeyError, requestPasskeyCredential } from '../passkeys';

export type AccountMode = 'login' | 'register' | 'recover';

const labels = { login: 'Войти с ключом доступа', register: 'Создать ключ доступа', recover: 'Восстановить доступ' };

export function AccountForm({ mode }: { mode: AccountMode }) {
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [recovery, setRecovery] = useState<{ code: string; session: unknown }>();

  async function enter(session: unknown) {
    await openLocalSession(session);
    if (mode !== 'login') history.replaceState(history.state, '', '/#/');
    location.reload();
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    try {
      const result = await requestPasskeyCredential(mode, mode === 'login' ? {} : mode === 'register' ? {
        invite: String(fields.get('invite') ?? '').trim(), nickname: String(fields.get('nickname') ?? ''),
      } : { code: String(fields.get('code') ?? '').trim() });
      if (mode === 'login') await enter(result);
      else setRecovery({ code: getRecoveryCode(result), session: result });
    } catch (failure) {
      setError(passkeyError(failure));
    } finally {
      setPending(false);
    }
  }

  if (recovery) return (
    <Stack gap="sm">
      {error && <Alert role="alert" color="red">{error}</Alert>}
      <RecoveryCode code={recovery.code} pending={pending} onDone={() => {
        if (pending) return;
        setPending(true);
        setError(undefined);
        void enter(recovery.session).catch(failure => setError(passkeyError(failure))).finally(() => setPending(false));
      }} />
    </Stack>
  );

  return (
    <form onSubmit={event => void submit(event)}>
      <Stack gap="sm">
        {error && <Alert role="alert" color="red">{error}</Alert>}
        {mode === 'register' && (
          <>
            <TextInput label="Код приглашения" name="invite" required pattern="[a-f0-9]{64}" maxLength={64}
              defaultValue={params.get('invite') ?? ''} spellCheck={false} autoComplete="off" />
            <TextInput label="Имя в профиле" name="nickname" required maxLength={128} autoComplete="nickname" />
          </>
        )}
        {mode === 'recover' && (
          <>
            <TextInput label="Код восстановления" name="code" required pattern="[a-f0-9]{64}" maxLength={64}
              spellCheck={false} autoComplete="off" />
            <Text size="sm" c="dimmed">После восстановления прежние ключи и сессии перестанут работать.</Text>
          </>
        )}
        <Button type="submit" mih={44} loading={pending} variant="light">{labels[mode]}</Button>
        {mode === 'login' ? (
          <>
            <Anchor component={Link} to="/register" size="sm">У меня есть приглашение</Anchor>
            <Anchor component={Link} to="/recover" size="sm">Потерял ключ доступа</Anchor>
          </>
        ) : <Anchor component={Link} to="/" size="sm">Ко входу</Anchor>}
      </Stack>
    </form>
  );
}
