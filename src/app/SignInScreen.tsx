import { Alert, Badge, Button, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useLocation } from 'react-router';
import { beginLogin } from '../api';
import type { SessionState } from '../api';
import { AccountForm } from './AccountForm';
import { ThemeMenu } from './ThemeMenu';
import { UpdateNotice } from './UpdateNotice';
import styles from './SignInScreen.module.css';

export type SignInStatus = Exclude<SessionState, 'signed-in'> | 'checking' | 'signing-out' | 'logout-failed';

const feedback = {
  denied: { title: 'Вход отменён или доступ не выдан', text: 'Если вас пригласили, проверьте, какой аккаунт выбран в Shikimori.' },
  invalid: { title: 'Вход не подтверждён', text: 'Начните вход заново и завершите его в этой же вкладке.' },
  unavailable: { title: 'Не удалось связаться с сервисом входа', text: 'Проверьте подключение и попробуйте ещё раз.' },
  'logout-failed': { title: 'Не удалось завершить сессию на сервере', text: 'В этой вкладке вы вышли из аккаунта.' },
};

export function SignInScreen({ status }: { status: SignInStatus }) {
  const { pathname } = useLocation();
  const mode = pathname === '/register' ? 'register' : pathname === '/forgot' ? 'forgot' : pathname === '/reset' ? 'reset' : 'login';
  const title = {
    login: 'Вход в Ночной сеанс', register: 'Регистрация по приглашению',
    forgot: 'Восстановление доступа', reset: 'Новый пароль',
  }[mode];
  const [login, setLogin] = useState<'pending' | 'failed'>();
  const checking = status === 'checking' || status === 'signing-out';
  const error = login === 'failed' ? feedback.unavailable : !login && !checking && status !== 'guest' ? feedback[status] : null;

  return (
    <main className={styles.screen}>
      <div className={styles.frame}>
        <Group justify="space-between" wrap="nowrap" className={styles.header}>
          <Group gap="xs" wrap="nowrap">
            <img src="/icon.svg" alt="" width={36} height={36} />
            <Text fw={800}>Ночной сеанс</Text>
          </Group>
          <ThemeMenu />
        </Group>
        {status !== 'checking' && <UpdateNotice />}
        <div className={styles.layout}>
          <div className={styles.art} aria-hidden="true">
            <img src="/icon.svg" alt="" width={112} height={112} />
          </div>
          <Paper className={styles.panel} withBorder radius="xl" component="section" aria-labelledby="signin-title">
            <Stack gap="lg">
              <Stack gap="sm" align="flex-start">
                <Badge variant="light">Закрытое тестирование</Badge>
                <Title id="signin-title" order={1} className={styles.title}>{title}</Title>
                <Text c="dimmed">Каталог, расписание и плеер доступны приглашённым участникам.</Text>
              </Stack>
              {checking ? (
                <Group role="status" gap="xs">
                  <Loader size="xs" aria-hidden="true" />
                  <Text>{status === 'checking' ? 'Проверяем сессию…' : 'Завершаем сессию…'}</Text>
                </Group>
              ) : (
                <>
                  {error && <Alert color="red" role="alert" title={error.title}>{error.text}</Alert>}
                  <AccountForm key={mode} mode={mode} />
                  {mode === 'login' && (
                    <Button variant="default" size="compact-md" mih={44} fullWidth loading={login === 'pending'}
                      onClick={() => {
                        setLogin('pending');
                        void beginLogin().catch(() => setLogin('failed'));
                      }}>
                      Вход через Shikimori для тестировщиков
                    </Button>
                  )}
                </>
              )}
            </Stack>
          </Paper>
        </div>
      </div>
    </main>
  );
}
