import { Alert, Button, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useSearchParams } from 'react-router';
import { accountRequest, beginLogin } from '../../api';

export function AccountSettings() {
  const [params, setParams] = useSearchParams();
  const [connection, setConnection] = useState<{ local: boolean; shikimoriId: number | null }>();
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(params.has('code'));
  const [notice, setNotice] = useState<{ error?: boolean; text: string }>();

  useEffect(() => {
    const controller = new AbortController();
    void accountRequest('connections', {}, controller.signal).then(data => {
      const result = data as typeof connection;
      if (!result || typeof result.local !== 'boolean' || (result.shikimoriId !== null
        && (!Number.isSafeInteger(result.shikimoriId) || result.shikimoriId < 1))) throw new Error('Invalid connection');
      if (!controller.signal.aborted) setConnection(result);
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, []);

  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setNotice(undefined);
    try {
      await action();
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error && !(error instanceof TypeError)
        ? error.message : 'Не удалось связаться с сервисом. Попробуйте ещё раз.' });
    } finally {
      setPending(false);
    }
  }

  function upgrade(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void run(async () => {
      if (!confirm) {
        await accountRequest('request-upgrade', { email: String(fields.get('email') ?? '') });
        setConfirm(true);
        setNotice({ text: 'Если адрес можно использовать, мы отправим код. Введите его в этой вкладке.' });
      } else {
        await accountRequest('upgrade', { code: String(fields.get('code') ?? ''), password: String(fields.get('password') ?? '') });
        if (params.has('code')) setParams({}, { replace: true });
        setConnection(previous => previous && { ...previous, local: true });
        setNotice({ text: 'Пароль установлен. В следующий раз войдите по email.' });
      }
    });
  }

  return (
    <Stack component="section" gap="sm" aria-labelledby="account-settings">
      <Title id="account-settings" order={2} size="h3">Аккаунт и интеграции</Title>
      {notice && <Alert role={notice.error ? 'alert' : 'status'} color={notice.error ? 'red' : undefined}>{notice.text}</Alert>}
      {params.get('connection') === 'failed' && !notice && <Alert role="alert" color="red">Не удалось привязать Shikimori.</Alert>}
      {loadError ? <Text role="alert">Не удалось загрузить настройки аккаунта.</Text> : !connection ? (
        <Text role="status">Загружаем настройки…</Text>
      ) : !connection.local ? (
        <form key={String(confirm)} onSubmit={upgrade}>
          <Stack gap="sm">
            <Text size="sm">Добавьте email и пароль, чтобы входить без Shikimori. Профиль и допуск сохранятся.</Text>
            {confirm ? (
              <>
                <TextInput name="code" label="Код из письма" required maxLength={64} defaultValue={params.get('code') ?? ''} />
                <PasswordInput name="password" label="Новый пароль" required minLength={15} maxLength={128}
                  description="Не менее 15 символов" autoComplete="new-password" />
              </>
            ) : <TextInput name="email" label="Email" type="email" required maxLength={254} autoComplete="email" />}
            <Group>
              <Button type="submit" loading={pending}>{confirm ? 'Установить пароль' : 'Отправить код'}</Button>
              {confirm && <Button variant="subtle" disabled={pending} onClick={() => {
                setParams({}, { replace: true });
                setConfirm(false);
                setNotice(undefined);
              }}>Указать другой email</Button>}
            </Group>
          </Stack>
        </form>
      ) : (
        <Group>
          <Text size="sm">{connection.shikimoriId ? `Shikimori привязан (ID ${connection.shikimoriId})` : 'Shikimori не привязан'}</Text>
          {connection.shikimoriId ? (
            <Button variant="default" loading={pending} onClick={() => void run(async () => {
              await accountRequest('unlink');
              setConnection({ local: true, shikimoriId: null });
              setParams({}, { replace: true });
              setNotice({ text: 'Shikimori отвязан.' });
            })}>Отвязать Shikimori</Button>
          ) : <Button loading={pending} onClick={() => void run(() => beginLogin(true))}>Привязать Shikimori</Button>}
        </Group>
      )}
    </Stack>
  );
}
