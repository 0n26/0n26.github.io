import { Alert, AppShell, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { lazy, Suspense, use, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useMatch } from 'react-router';
import { version } from '../../package.json';
import { beginLogin, logout } from '../api';
import type { SessionState } from '../api';
import { CatalogPage } from '../pages/catalog';

import { ThemeMenu } from './ThemeMenu';
import { UpdateNotice } from './UpdateNotice';
import styles from './App.module.css';

const TitlePage = lazy(() => import('../pages/title').then(m => ({ default: m.TitlePage })));
const SchedulePage = lazy(() => import('../pages/schedule').then(m => ({ default: m.SchedulePage })));
const ChangelogPage = lazy(() => import('../pages/changelog').then(m => ({ default: m.ChangelogPage })));
const AboutPage = lazy(() => import('../pages/about').then(m => ({ default: m.AboutPage })));
const ProfilePage = lazy(() => import('../pages/profile').then(m => ({ default: m.ProfilePage })));

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
}

type LoginStatus = Exclude<SessionState, 'signed-in'> | 'signing-out' | 'logout-failed';

const loginErrors: Partial<Record<LoginStatus, string>> = {
  denied: 'У этого аккаунта Shikimori пока нет доступа.',
  invalid: 'Не удалось подтвердить вход. Начните его заново в этой вкладке.',
  unavailable: 'Не удалось проверить вход. Попробуйте ещё раз.',
  'logout-failed': 'Вы вышли в этой вкладке, но не удалось завершить сессию на сервере.',
};

function LoginPanel({ status }: { status: LoginStatus }) {
  const [login, setLogin] = useState<'pending' | 'failed'>();
  const error = login === 'failed' ? loginErrors.unavailable : loginErrors[status];

  return (
    <Stack maw={480} align="flex-start">
      <Title order={1}>Ночной сеанс</Title>
      {status === 'signing-out' ? <Text role="status">Завершаем сессию…</Text> : (
        <>
          <Text>Войдите через Shikimori, чтобы открыть каталог. Сейчас доступ открыт только участникам тестирования.</Text>
          {error && <Alert color="red" role="alert">{error}</Alert>}
          <Button loading={login === 'pending'} onClick={() => {
            setLogin('pending');
            void beginLogin().catch(() => setLogin('failed'));
          }}>Войти через Shikimori</Button>
        </>
      )}
    </Stack>
  );
}

export function App({ initialSession }: { initialSession: Promise<SessionState> }) {
  const restoredSession = use(initialSession);
  const [logoutStatus, setLogoutStatus] = useState<LoginStatus>();
  const session = logoutStatus ?? restoredSession;
  const guest = session !== 'signed-in';
  const signOut = () => {
    setLogoutStatus('signing-out');
    void logout().then(() => setLogoutStatus('guest'), () => setLogoutStatus('logout-failed'));
  };
  const watch = useMatch('/anime/:source/:alias');

  const catalog = useMatch('/');
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent>();

  useEffect(() => {
    const rememberPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const clearPrompt = () => setInstallPrompt(undefined);

    window.addEventListener('beforeinstallprompt', rememberPrompt);
    window.addEventListener('appinstalled', clearPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', rememberPrompt);
      window.removeEventListener('appinstalled', clearPrompt);
    };
  }, []);

  const install = () => {
    if (!installPrompt) return;
    setInstallPrompt(undefined);
    void installPrompt.prompt().catch(error => console.warn('Не удалось открыть окно установки', error));
  };

  return (
    <AppShell header={guest ? undefined : { height: catalog ? { base: 56, xs: 76 } : 76 }} className={styles.shell}>
      {!guest && <AppShell.Header className={`${styles.header} ${catalog ? styles.catalogHeader : ''}`}>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap" gap="xs">
            <Link className={styles.brand} to="/" aria-label="Ночной сеанс — каталог">
              <img src="/icon.svg" alt="" width={36} height={36} />
              <Text span fw={800} size="sm" className={watch ? undefined : styles.brandName}>Ночной сеанс</Text>
            </Link>
            {watch ? (
              <Link to="/" className={styles.navLink}>
                ← В каталог
              </Link>
            ) : (
              <Group component="nav" aria-label="Основная навигация" gap={4} wrap="nowrap">
                <NavLink to="/" end className={`${styles.navLink} ${styles.catalogLink}`}>Каталог</NavLink>
                <NavLink to="/schedule" className={styles.navLink}>Расписание</NavLink>
                <NavLink to="/changelog" className={`${styles.navLink} ${styles.secondaryLink}`}>Изменения</NavLink>
                <NavLink to="/profile" className={styles.navLink}>Профиль</NavLink>
              </Group>
            )}
            <ThemeMenu />
          </Group>
        </Container>
      </AppShell.Header>}
      <AppShell.Main>
        <Container size="xl" className={styles.page}>
          <UpdateNotice />
          {guest ? <LoginPanel status={session} /> : (
            <>
              <Suspense fallback={<Text role="status">Загрузка страницы…</Text>}>
                <Routes>
                  <Route index element={<CatalogPage />} />
                  <Route path="anime/:source/:alias" element={<TitlePage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="changelog" element={<ChangelogPage />} />
                  <Route path="about" element={<AboutPage onInstall={installPrompt ? install : undefined} />} />
                  <Route path="profile/:id?" element={<ProfilePage onLogout={signOut} />} />
                  <Route path="*" element={
                    <Stack align="flex-start">
                      <Title order={1}>Страница не найдена</Title>
                      <Button component={Link} to="/">Открыть каталог</Button>
                    </Stack>
                  } />
                </Routes>
              </Suspense>
              <footer className={styles.footer}>
                <Text size="sm" c="dimmed">Ночной сеанс</Text>
                <Link to="/about" className={styles.navLink}>О проекте</Link>
                <Link to="/changelog" className={styles.navLink}>Версия {version}</Link>
              </footer>
            </>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
