import { Alert, Anchor, Avatar, Badge, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { version } from '../../../package.json';
import styles from './AboutPage.module.css';

type Contributor = {
  login: string;
  avatar_url: string;
  contributions: number;
};

function commitsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'коммит';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'коммита';
  return 'коммитов';
}

const REPOSITORY = '0n26/0n26.github.io';
const REPOSITORY_URL = `https://github.com/${REPOSITORY}`;
// shortcut: load the first page, paginate if the repository reaches 100 contributors.
const CONTRIBUTORS_URL = `https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100`;

function isContributor(item: unknown): item is Contributor {
  if (typeof item !== 'object' || item === null) return false;
  const { type, login, avatar_url, contributions } = item as Record<string, unknown>;
  return type === 'User' &&
    typeof login === 'string' && /^[a-z\d-]{1,39}$/i.test(login) &&
    typeof avatar_url === 'string' && avatar_url.startsWith('https://avatars.githubusercontent.com/') &&
    typeof contributions === 'number' && Number.isSafeInteger(contributions) && contributions >= 0;
}

export function AboutPage() {
  const [contributors, setContributors] = useState<Contributor[] | 'error' | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(CONTRIBUTORS_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const data: unknown = response.status === 204 ? [] : await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid contributor list');
        if (!controller.signal.aborted) setContributors(data.filter(isContributor));
      })
      .catch(() => {
        if (!controller.signal.aborted) setContributors('error');
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
          Приложение объединяет AniLiberty и AnimeVost в один каталог с поиском, выбором озвучки и прямыми
          ссылками на серии. Фильтры по жанру и году и недельное расписание доступны для AniLiberty.
          Видео загружается напрямую от источника: AniLiberty отдаёт HLS, AnimeVost — MP4.
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
          Участники с аккаунтом GitHub. Боты, отмеченные GitHub, скрыты.
        </Text>
        {contributors === null && (
          <Group role="status" gap="xs">
            <Loader size="xs" aria-hidden />
            <Text>Загружаем список участников…</Text>
          </Group>
        )}
        {contributors === 'error' && (
          <Alert color="red" title="Не удалось загрузить список участников">
            <Anchor href={`${REPOSITORY_URL}/graphs/contributors`} target="_blank" rel="noopener noreferrer">
              Посмотреть вклад в репозиторий на GitHub
            </Anchor>
          </Alert>
        )}
        {Array.isArray(contributors) && contributors.length === 0 && (
          <Text c="dimmed">Участники не найдены.</Text>
        )}
        {Array.isArray(contributors) && contributors.length > 0 && (
          <div className={styles.contributors}>
            {contributors.map((person) => (
              <Anchor
                key={person.login}
                href={`https://github.com/${person.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.contributor}
              >
                <Avatar src={person.avatar_url} alt="" radius="xl" size="md" />
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