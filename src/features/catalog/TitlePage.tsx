import { Alert, AspectRatio, Badge, Group, Image, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { getSource } from '../../sources';
import type { AnimeSource, AnimeTitle, CatalogEntry, Episode, Franchise } from '../../sources/source';
import { Player } from '../player/Player';
import { useSourceRequest } from './useSourceRequest';
import { EpisodeNavigation, episodeCaption } from './EpisodeNavigation';
import styles from './TitlePage.module.css';

const restrictionMessages = {
  geo: 'Источник ограничил просмотр в вашем регионе.',
  copyright: 'Просмотр ограничен по требованию правообладателя.',
  unknown: 'Источник не подтвердил доступность просмотра.',
};

function Playback({ title, episode, sourceKey, hasSelection }: {
  title: AnimeTitle; episode?: Episode; sourceKey: string; hasSelection: boolean;
}) {
  if (title.restriction) {
    return <Alert color="yellow" title="Просмотр недоступен">{restrictionMessages[title.restriction]}</Alert>;
  }
  if (!episode) {
    return hasSelection
      ? <Alert role="alert" color="red" title="Эпизод не найден">Выберите эпизод из списка, если он доступен.</Alert>
      : <Text role="status" c="dimmed">У этого аниме пока нет эпизодов.</Text>;
  }
  if (episode.streams.length === 0) {
    return <Alert color="gray" title="Видео недоступно">Источник не предоставил видео для этого эпизода.</Alert>;
  }
  const poster = episode.preview ?? title.poster;
  const episodeKey = JSON.stringify([sourceKey, title.alias, episode.id]);
  return <Player key={episodeKey} episodeKey={episodeKey} streams={episode.streams} poster={poster} />;
}

function RelatedCard({ routePrefix, entry }: { routePrefix: string; entry: CatalogEntry }) {
  return (
    <Link to={`${routePrefix}/${encodeURIComponent(entry.alias)}`} className={styles.card}>
      <AspectRatio ratio={2 / 3} className={styles.poster}>
        {entry.poster
          ? <Image src={entry.poster} alt="" loading="lazy" decoding="async" />
          : <div className={styles.placeholder}>Нет постера</div>}
      </AspectRatio>
      <Text fw={650} lineClamp={2} className={styles.cardTitle}>{entry.name}</Text>
      {entry.year && <Text size="sm" c="dimmed">{entry.year}</Text>}
    </Link>
  );
}

function Chronology({ franchise, currentAlias, routePrefix }: {
  franchise: Franchise;
  currentAlias: string;
  routePrefix: string;
}) {
  return (
    <div>
      <Text fw={600} mb={6}>{franchise.name}</Text>
      <ol className={styles.chronology}>
        {franchise.releases.map((release) => (
          <li key={release.alias} aria-current={release.alias === currentAlias ? 'page' : undefined}>
            <Link to={`${routePrefix}/${encodeURIComponent(release.alias)}`} className={styles.chronologyLink}>
              {release.name}
            </Link>
            {release.year && <Text span size="sm" c="dimmed"> · {release.year}</Text>}
            {release.alias === currentAlias && <Badge size="xs" variant="light" ml="xs">Сейчас</Badge>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function RelatedSections({ getRelated, alias, currentAlias, routePrefix }: {
  getRelated: NonNullable<AnimeSource['getRelated']>;
  alias: string;
  currentAlias: string;
  routePrefix: string;
}) {
  const load = useCallback((signal: AbortSignal) => getRelated(alias, signal), [getRelated, alias]);
  const request = useSourceRequest(load);

  if (request.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text c="dimmed">Загружаем связанные тайтлы…</Text></Group>;
  }
  if (request.status === 'error') return null;

  const { similar, franchises } = request.data;
  if (similar.length === 0 && franchises.length === 0) return null;

  return (
    <Stack gap="lg">
      {similar.length > 0 && (
        <section aria-labelledby="similar-heading">
          <Title order={2} size="h3" id="similar-heading" mb="sm">Похожее</Title>
          <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 6 }} spacing="md">
            {similar.map((entry) => <RelatedCard key={entry.alias} routePrefix={routePrefix} entry={entry} />)}
          </SimpleGrid>
        </section>
      )}
      {franchises.length > 0 && (
        <section aria-labelledby="franchise-heading">
          <Title order={2} size="h3" id="franchise-heading" mb="sm">Франшиза (Хронология)</Title>
          <Stack gap="md">
            {franchises.map((franchise) => (
              <Chronology key={franchise.id} franchise={franchise} currentAlias={currentAlias} routePrefix={routePrefix} />
            ))}
          </Stack>
        </section>
      )}
    </Stack>
  );
}

function TitleContent({ source, alias }: { source: AnimeSource; alias: string }) {
  const [params] = useSearchParams();
  const selectedId = params.get('episode');
  const load = useCallback((signal: AbortSignal) => source.getTitle(alias, signal), [source, alias]);
  const request = useSourceRequest(load);

  if (request.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем аниме…</Text></Group>;
  }
  if (request.status === 'error') {
    return <Alert role="alert" color="red" title="Не удалось загрузить аниме">Проверьте подключение и обновите страницу.</Alert>;
  }
  if (!request.data) {
    return <Alert color="gray" title="Аниме не найдено">Возможно, ссылка устарела.</Alert>;
  }

  const title = request.data;
  const currentIndex = selectedId === null ? 0 : title.episodes.findIndex(({ id }) => id === selectedId);
  const episode = title.episodes[currentIndex];

  return (
    <Stack gap="lg">
      <Group gap="sm" align="baseline" className={styles.heading}>
        <Title order={1}>{title.name}</Title>
        {episode && <Text c="dimmed" size="lg" id="playback-heading">{episodeCaption(episode, currentIndex, title.episodes.length)}</Text>}
      </Group>
      <div className={styles.theater}>
        <Playback title={title} episode={episode} sourceKey={source.key} hasSelection={selectedId !== null} />
        {title.episodes.length > 0 && (
          <EpisodeNavigation key={episode?.id ?? selectedId} episodes={title.episodes} currentIndex={currentIndex} />
        )}
      </div>
      <details className={styles.about}>
        <summary>
          <strong>О тайтле</strong>
          <span>{source.name}{title.year && ` · ${title.year}`}</span>
        </summary>
        <div className={styles.synopsis}>
          {title.poster && <Image src={title.poster} alt="" w={90} radius="sm" loading="lazy" />}
          <Stack gap="xs">
            {title.alternateName && <Text fw={600}>{title.alternateName}</Text>}
            <Text>{title.description ?? 'Источник не предоставил описание.'}</Text>
          </Stack>
        </div>
      </details>
      {source.getRelated && (
        <RelatedSections
          getRelated={source.getRelated}
          alias={alias}
          currentAlias={title.alias}
          routePrefix={`/anime/${encodeURIComponent(source.key)}`}
        />
      )}
    </Stack>
  );
}

export function TitlePage() {
  const { source: key, alias } = useParams<'source' | 'alias'>();
  const source = key ? getSource(key) : undefined;
  return source && alias
    ? <TitleContent key={`${source.key}/${alias}`} source={source} alias={alias} />
    : <Alert color="red" title="Источник не найден">Проверьте ссылку или выберите аниме в каталоге.</Alert>;
}
