import { AppShell, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { lazy, Suspense } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router';
import { version } from '../../package.json';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { UpdateNotice } from './UpdateNotice';
import styles from './App.module.css';

const TitlePage = lazy(() => import('../features/catalog/TitlePage').then(m => ({ default: m.TitlePage })));
const ChangelogPage = lazy(() => import('../features/changelog/ChangelogPage').then(m => ({ default: m.ChangelogPage })));

export function App() {
  return (
    <AppShell header={{ height: 76 }} className={styles.shell}>
      <AppShell.Header className={styles.header}>
        <Container size="xl" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap" gap="xs">
            <Link className={styles.brand} to="/">
              <img src="/icon.svg" alt="" width={36} height={36} />
              <Text span fw={800} size="sm">Ночной сеанс</Text>
            </Link>
            <Group component="nav" aria-label="Основная навигация" gap={4} wrap="nowrap">
              <NavLink to="/" end className={styles.navLink}>Каталог</NavLink>
              <NavLink to="/changelog" className={styles.navLink}>Изменения</NavLink>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="xl" className={styles.page}>
          <UpdateNotice />
          <Suspense fallback={<Text role="status">Загрузка страницы…</Text>}>
            <Routes>
              <Route index element={<CatalogPage />} />
              <Route path="anime/:source/:alias" element={<TitlePage />} />
              <Route path="changelog" element={<ChangelogPage />} />
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
            <Link to="/changelog" className={styles.navLink}>Версия {version}</Link>
          </footer>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
