import { Alert, Button, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import retryUrl from 'virtual:title-retry-url';

let request: Promise<typeof import('../pages/title')> | undefined;

function freshImport(): Promise<typeof import('../pages/title')> {
  const url = new URL(retryUrl, location.href);
  // Safari can retain the failed import for the original URL even after reload.
  url.searchParams.set('retry', crypto.randomUUID());
  return import(/* @vite-ignore */ url.href);
}

export function TitleRoute() {
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<typeof import('../pages/title') | null>();

  useEffect(() => {
    let active = true;
    request ??= import('../pages/title').catch(freshImport);
    void request.then(module => {
      if (active) setPage(module);
    }, () => {
      request = undefined;
      if (active) setPage(null);
    });
    return () => { active = false; };
  }, [attempt]);

  if (page) return <page.TitlePage />;
  if (page === undefined) return <Text role="status">Загрузка страницы…</Text>;
  return (
    <Alert role="alert" title="Не удалось открыть страницу тайтла">
      <Stack align="flex-start" gap="xs">
        <Text size="sm">Проверьте подключение и попробуйте ещё раз.</Text>
        <Button onClick={() => {
          request ??= freshImport();
          setPage(undefined);
          setAttempt(value => value + 1);
        }}>Повторить</Button>
      </Stack>
    </Alert>
  );
}
