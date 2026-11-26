import { Alert, Button, CopyButton, Group, Stack, Text, TextInput } from '@mantine/core';

export function RecoveryCode({ code, pending, onDone }: { code: string; pending?: boolean; onDone: () => void }) {
  return (
    <Stack gap="sm">
      <Alert title="Сохраните код восстановления">
        Если потеряете все ключи доступа, этот код позволит добавить новый. Код одноразовый и больше не будет показан.
      </Alert>
      <TextInput label="Код восстановления" value={code} readOnly onFocus={event => event.currentTarget.select()} />
      <Group>
        <CopyButton value={code}>{({ copied, copy }) => (
          <Button type="button" variant="default" mih={44} onClick={copy}>{copied ? 'Скопировано' : 'Скопировать'}</Button>
        )}</CopyButton>
        <Button type="button" variant="light" mih={44} loading={pending} onClick={onDone}>Я сохранил код</Button>
      </Group>
      <Text size="sm" c="dimmed">Храните код отдельно от устройства. Никому его не передавайте.</Text>
    </Stack>
  );
}
