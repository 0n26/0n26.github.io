import { Alert, Anchor, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { accountRequest, openLocalSession } from '../api';

export type AccountMode = 'login' | 'register' | 'forgot' | 'reset';

const labels = {
  login: 'Войти', register: 'Создать аккаунт', forgot: 'Отправить письмо', reset: 'Сохранить новый пароль',
};

export function AccountForm({ mode }: { mode: AccountMode }) {
  const [params] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ error?: boolean; text: string }>();
  const password = mode !== 'forgot';

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? '');
    setPending(true);
    setNotice(undefined);
    try {
      if (mode === 'login' || mode === 'register') {
        const credentials = { email: value('email'), password: value('password') };
        await openLocalSession(mode, mode === 'login' ? credentials : {
          ...credentials, invite: value('invite'), nickname: value('nickname'),
        });
        if (mode === 'register') history.replaceState(history.state, '', '/#/');
        location.reload();
      } else if (mode === 'forgot') {
        await accountRequest('request-reset', { email: value('email') });
        setNotice({ text: 'Если этот адрес связан с аккаунтом, на него придёт письмо для сброса пароля.' });
      } else {
        await accountRequest('reset', { code: params.get('code') ?? '', password: value('password') });
        location.replace('/');
      }
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error && !(error instanceof TypeError)
        ? error.message : 'Не удалось связаться с сервисом. Попробуйте ещё раз.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={event => void submit(event)}>
      <Stack gap="sm">
        {notice && <Alert role={notice.error ? 'alert' : 'status'} color={notice.error ? 'red' : undefined}>{notice.text}</Alert>}
        {mode === 'register' && <TextInput label="Код приглашения" name="invite" required maxLength={64}
          defaultValue={params.get('invite') ?? ''} spellCheck={false} autoComplete="off" />}
        {mode !== 'reset' && <TextInput label="Email" name="email" type="email" required maxLength={254}
          autoComplete={mode === 'login' ? 'username' : 'email'} />}
        {mode === 'register' && <TextInput label="Имя в профиле" name="nickname" required maxLength={128} autoComplete="nickname" />}
        {password && <PasswordInput label={mode === 'reset' ? 'Новый пароль' : 'Пароль'} name="password" required
          minLength={mode === 'login' ? undefined : 15} maxLength={128}
          description={mode === 'login' ? undefined : 'Не менее 15 символов'}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />}
        <Button type="submit" mih={44} loading={pending} variant="light">{labels[mode]}</Button>
        {mode === 'login' ? (
          <>
            <Anchor component={Link} to="/register" size="sm">У меня есть приглашение</Anchor>
            <Anchor component={Link} to="/forgot" size="sm">Не помню пароль</Anchor>
          </>
        ) : <Anchor component={Link} to="/" size="sm">Ко входу</Anchor>}
      </Stack>
    </form>
  );
}
