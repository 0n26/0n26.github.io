import { Alert, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { accountRequest, beginLogin } from '../../api';
import { RecoveryCode } from '../../components/RecoveryCode';
import { getRecoveryCode, passkeyError, requestPasskeyCredential } from '../../passkeys';

export function AccountSettings() {
  const [params, setParams] = useSearchParams();
  const [connection, setConnection] = useState<{ local: boolean; shikimoriId: number | null }>();
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string>();
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
      setNotice({ error: true, text: passkeyError(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Stack component="section" gap="sm" aria-labelledby="account-settings">
      <Title id="account-settings" order={2} size="h3">Аккаунт и интеграции</Title>
      {notice && <Alert role={notice.error ? 'alert' : 'status'} color={notice.error ? 'red' : undefined}>{notice.text}</Alert>}
      {params.get('connection') === 'failed' && !notice && <Alert role="alert" color="red">Не удалось привязать Shikimori.</Alert>}
      {loadError ? <Text role="alert">Не удалось загрузить настройки аккаунта.</Text> : !connection ? (
        <Text role="status">Загружаем настройки…</Text>
      ) : recoveryCode ? (
        <RecoveryCode code={recoveryCode} onDone={() => {
          setRecoveryCode(undefined);
          setConnection({ ...connection, local: true });
          setNotice({ text: 'Ключ доступа добавлен. Теперь входите с ним, а не через Shikimori.' });
        }} />
      ) : !connection.local ? (
        <>
          <Text size="sm">Добавьте ключ доступа, чтобы входить без Shikimori. Профиль и допуск сохранятся.</Text>
          <Button variant="light" loading={pending} onClick={() => void run(async () => {
            setRecoveryCode(getRecoveryCode(await requestPasskeyCredential('upgrade')));
          })}>Перейти на ключ доступа</Button>
        </>
      ) : (
        <>
          <Group>
            <Text size="sm">{connection.shikimoriId ? `Shikimori привязан (ID ${connection.shikimoriId})` : 'Shikimori не привязан'}</Text>
            {connection.shikimoriId ? (
              <Button variant="default" disabled={pending} onClick={() => void run(async () => {
                await accountRequest('unlink');
                setConnection({ local: true, shikimoriId: null });
                setParams({}, { replace: true });
                setNotice({ text: 'Shikimori отвязан.' });
              })}>Отвязать Shikimori</Button>
            ) : <Button disabled={pending} onClick={() => void run(() => beginLogin(true))}>Привязать Shikimori</Button>}
          </Group>
          <Button variant="light" loading={pending} onClick={() => void run(async () => {
            await requestPasskeyCredential('add');
            setNotice({ text: 'Дополнительный ключ доступа добавлен.' });
          })}>Добавить ключ доступа</Button>
        </>
      )}
    </Stack>
  );
}
