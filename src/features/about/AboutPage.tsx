import { Alert, Anchor, Avatar, Badge, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { version } from '../../../package.json';
import styles from './AboutPage.module.css';

type Contributor = {
  login: string;
  html_url: string;
  avatar_url: string;
  contributions: number;
  type?: string;
};

function commitsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'коммит';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'коммита';
  return 'коммитов';
}

const REPOSITORY = '0n26/0n26.github.io';
const CONTRIBUTORS_URL = `https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100`;

function isExcluded(login: string): boolean {
  const lower = login.toLowerCase();
  return (
    lower.includes('bot') ||
    lower.includes('codex') ||
    lower.includes('claude') ||
    lower.includes('copilot') ||
    lower.includes('gpt')
  );
}

export function AboutPage() {
  const [contributors, setContributors] = useState<Contributor[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(CONTRIBUTORS_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('failed');
        return response.json() as Promise<Contributor[]>;
      })
      .then((data) => {
        const people = data
          .filter((item) => item.type !== 'Bot' && !isExcluded(item.login))
          .sort((a, b) => b.contributions - a.contributions);
        setContributors(people);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setError(true);
      });
    return () => controller.abort();
  }, []);

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

      <section className={styles.section} aria-labelledby="about-description">
        <Title id="about-description" order={2} size="h3">Описание</Title>
        <Text>
          Приложение объединяет несколько источников в один каталог: AniLiberty и AnimeVost. Поиск, фильтры
          по жанру и году, недельное расписание, карточки тайтлов с вариантами озвучки и прямые ссылки на
          серии доступны из одного интерфейса. Видео загружается напрямую от источника: AniLiberty отдаёт HLS,
          AnimeVost — MP4.
        </Text>
        <Text>
          Каталог и поиск используют статический индекс, который GitHub Pages обновляет раз в сутки. При сбое
          обновления используется последний полный индекс, но не дольше семи суток. Оболочка и история
          изменений доступны офлайн благодаря PWA.
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
          Код организован по функциям в src/features. Новый источник добавляется реализацией интерфейса
          AnimeSource и регистрацией адаптера в реестре — плеер при этом не меняется. Источник должен
          работать из браузера по HTTPS и отдавать CORS для плейлистов и сегментов.
        </Text>
        <Text>
          Версия берётся из package.json, а история изменений — из корневого changelog.md артефакта сборки.
        </Text>
      </section>

      <section className={styles.section} aria-labelledby="about-contributors">
        <Title id="about-contributors" order={2} size="h3">Участники</Title>
        <Text c="dimmed" size="sm">
          Все авторы обновлений репозитория, кроме ботов и автоматических агентов.
        </Text>
        {contributors === null && !error && (
          <Group role="status" gap="xs">
            <Loader size="xs" aria-hidden />
            <Text>Загружаем список участников…</Text>
          </Group>
        )}
        {error && (
          <Alert color="red" title="Не удалось загрузить список участников">
            Проверьте подключение и обновите страницу.
          </Alert>
        )}
        {contributors && contributors.length === 0 && (
          <Text c="dimmed">Участники не найдены.</Text>
        )}
        {contributors && contributors.length > 0 && (
          <div className={styles.contributors}>
            {contributors.map((person) => (
              <Anchor
                key={person.login}
                href={person.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.contributor}
              >
                <Avatar src={person.avatar_url} alt={person.login} radius="xl" size="md" />
                <Stack gap={0}>
                  <Text fw={600} size="sm">{person.login}</Text>
                  <Text size="xs" c="dimmed">{person.contributions} {commitsLabel(person.contributions)}</Text>
                </Stack>
              </Anchor>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="about-links">
        <Title id="about-links" order={2} size="h3">Ссылки</Title>
        <Group className={styles.links}>
          <Anchor href={`https://github.com/${REPOSITORY}`} target="_blank" rel="noopener noreferrer">
            Репозиторий на GitHub
          </Anchor>
          <Link to="/changelog" className={styles.link}>История изменений</Link>
          <Anchor href="https://github.com/0n26/0n26.github.io/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">
            Правила участия
          </Anchor>
        </Group>
      </section>
    </Stack>
  );
}