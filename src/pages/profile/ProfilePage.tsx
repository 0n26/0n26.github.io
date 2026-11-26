import { Alert, Avatar, Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { readApi } from '../../api';
import { useRequest } from '../../hooks/useRequest';
import { positiveParam } from '../../routes/catalogFilters';
import { AccountSettings } from './AccountSettings';

interface Profile {
  id: number;
  nickname: string;
  avatar: string | null;
  tester: boolean;
}

export function ProfilePage({ onLogout }: { onLogout: () => void }) {
  const { id } = useParams<'id'>();
  const own = id === undefined;
  const profileId = positiveParam(id);
  const load = useCallback((signal: AbortSignal) => own
    ? readApi<Profile>('/api/session', signal)
    : readApi<Profile>(`/api/profiles/${profileId}`, signal, null), [own, profileId]);
  const request = useRequest(own || profileId ? load : null);

  if (!own && !profileId) return <Text role="status">Профиль не найден.</Text>;
  if (request.status === 'loading') return <Text role="status">Загружаем профиль…</Text>;
  if (request.status === 'error') return <Alert title="Не удалось загрузить профиль" role="alert">Обновите страницу и попробуйте ещё раз.</Alert>;
  if (!request.data) return <Text role="status">Профиль не найден.</Text>;

  const { id: accountId, nickname, avatar, tester } = request.data;
  return (
    <Stack align="flex-start" gap="lg">
      <Group>
        <Avatar src={avatar} alt="" size="lg" imageProps={{ referrerPolicy: 'no-referrer' }} />
        <Title order={1}>{nickname}</Title>
      </Group>
      {tester && <Badge variant="light">Тестировщик</Badge>}
      {own && (
        <Group>
          <Button component={Link} to={`/profile/${accountId}`} variant="light">Открыть ссылку на профиль</Button>
          <Button onClick={onLogout} variant="default">Выйти</Button>
        </Group>
      )}
      {own && <AccountSettings />}
    </Stack>
  );
}
