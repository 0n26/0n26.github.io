import { Alert, Button, Group } from '@mantine/core';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateNotice() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <Alert title="Доступно обновление" mb="xl" color="yellow">
      Обновите страницу, когда закончите просмотр.
      <Group mt="sm">
        <Button size="xs" onClick={() => { void updateServiceWorker(true); }}>Обновить</Button>
        <Button size="xs" variant="subtle" onClick={() => setNeedRefresh(false)}>Позже</Button>
      </Group>
    </Alert>
  );
}
