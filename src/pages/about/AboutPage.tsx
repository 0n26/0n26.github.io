import { Anchor, Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import { version } from '../../../package.json';
import { ContributorsSection } from './ContributorsSection';
import { REPOSITORY_URL } from './contributors';
import styles from './AboutPage.module.css';

export function AboutPage({ onInstall }: { onInstall?: () => void }) {
  return (
    <Stack gap="lg" className={styles.page}>
      <header>
        <Group justify="space-between" align="center" gap="xs">
          <Title order={1}>О проекте</Title>
          <Badge variant="light" aria-label={`Версия приложения ${version}`}>v{version}</Badge>
        </Group>
        <Text c="dimmed" mt={4}>
          «Ночной сеанс» — клиентское PWA для поиска и просмотра аниме. Сайт работает прямо в браузере,
          без собственного сервера и ключей доступа.
        </Text>
      </header>

      <section className={styles.section} aria-labelledby="about-install">
        <Title id="about-install" order={2} size="h3">Установка приложения</Title>
        {onInstall && (
          <div>
            <Button variant="light" mih={44} onClick={onInstall}>Установить приложение</Button>
          </div>
        )}
        <ul className={styles.list}>
          <li>На iPhone и iPad: в Safari нажмите «Поделиться» → «На экран „Домой“».</li>
          <li>В других браузерах: найдите в меню «Установить приложение» или «Добавить на главный экран», если такой пункт есть.</li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="about-description">
        <Title id="about-description" order={2} size="h3">Описание</Title>
        <Text>
          Приложение объединяет AniLiberty и AnimeVost в один каталог с поиском, выбором озвучки и прямыми
          ссылками на серии. Фильтры по жанру и году и недельное расписание доступны для AniLiberty.
          Видео загружается напрямую от источника: AniLiberty отдаёт HLS, AnimeVost — MP4.
        </Text>
        <Text>
          Каталог и поиск используют полный индекс, когда он актуален. Для доступа к каталогу, расписанию,
          профилям и просмотру нужна действующая сессия и интернет.
        </Text>
      </section>

      <section className={styles.section} aria-labelledby="about-goals">
        <Title id="about-goals" order={2} size="h3">Цели</Title>
        <ul className={styles.list}>
          <li>Дать единый каталог аниме без переключения между источниками.</li>
          <li>Сохранить прямые ссылки на эпизоды и удобную навигацию по сериям.</li>
          <li>Показывать варианты озвучки на странице тайтла и открывать их напрямую.</li>
          <li>Работать из браузера по HTTPS, без прокси и обхода ограничений источников.</li>
          <li>Оставаться быстрым на телефоне: два постера в ряд, поиск по Enter, фильтры по запросу.</li>
          <li>Поддерживать воспроизведение без WebGPU и предлагать Anime4K как опциональное улучшение.</li>
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="about-how">
        <Title id="about-how" order={2} size="h3">Как это устроено</Title>
        <Text>
          Новый источник добавляется реализацией интерфейса AnimeSource и регистрацией адаптера — плеер не
          меняется. Плейлисты и сегменты загружаются браузером напрямую у источника.
        </Text>
        <Text>
          Версия берётся из package.json, а история изменений — из корневого changelog.md артефакта сборки.
        </Text>
      </section>

      <ContributorsSection />

      <section className={styles.section} aria-labelledby="about-links">
        <Title id="about-links" order={2} size="h3">Ссылки</Title>
        <Group className={styles.links}>
          <Anchor href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            Репозиторий на GitHub
          </Anchor>
          <Link to="/changelog" className={styles.link}>История изменений</Link>
          <Anchor href={`${REPOSITORY_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer">
            Правила участия
          </Anchor>
        </Group>
      </section>
    </Stack>
  );
}