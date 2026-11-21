import { Alert, Group, Image, Loader, Stack, Text, Title } from '@mantine/core';
import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { getSource } from '../../sources';
import type { AnimeSource, AnimeTitle, Episode } from '../../sources/source';
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
