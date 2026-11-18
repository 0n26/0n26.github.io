import { Alert, AspectRatio, Button, Group, Image, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { defaultSource, getSource } from '../../sources';
import type { AnimeSource, AnimeTitle, Episode } from '../../sources/source';
import { Player } from '../player/Player';
import { useSourceRequest } from './useSourceRequest';
import styles from './Catalog.module.css';

const restrictionMessages = {
  geo: 'Источник ограничил просмотр в вашем регионе.',
  copyright: 'Просмотр ограничен по требованию правообладателя.',
  unknown: 'Источник не подтвердил доступность просмотра.',
};

function Playback({ title, episode, hasSelection }: { title: AnimeTitle; episode?: Episode; hasSelection: boolean }) {
  if (title.restriction) {
    return <Alert color="yellow" title="Просмотр недоступен">{restrictionMessages[title.restriction]}</Alert>;
  }
  if (!episode) {
    return hasSelection
      ? <Alert role="alert" color="red" title="Эпизод не найден">Выберите эпизод из списка, если он доступен.</Alert>
      : <Text role="status" c="dimmed">У этого аниме пока нет эпизодов.</Text>;
  }
  if (episode.streams.length === 0) {
    return <Alert color="gray" title="Видео недоступно">Источник не предоставил HLS-поток для этого эпизода.</Alert>;
  }
  const poster = episode.preview ?? title.poster;
  return <Player key={episode.id} streams={episode.streams} {...(poster ? { poster } : {})} />;
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
  const episode = selectedId === null ? title.episodes[0] : title.episodes.find(({ id }) => id === selectedId);

  return (
    <>
      <Paper withBorder p={{ base: 'md', sm: 'lg' }} className={styles.release}>
        <AspectRatio ratio={2 / 3} className={styles.releasePoster}>
          {title.poster ? <Image src={title.poster} alt="" /> : <div className={styles.placeholder}>Нет постера</div>}
        </AspectRatio>
        <Stack gap="xs">
          <Text c="dimmed" size="sm">{source.name}{title.year && ` · ${title.year}`}</Text>
          <Title order={1} className={styles.wrap}>{title.name}</Title>
          {title.alternateName && <Text c="dimmed" className={styles.wrap}>{title.alternateName}</Text>}
        </Stack>
        {title.description && <Text className={styles.description}>{title.description}</Text>}
      </Paper>
      <section aria-labelledby="playback-heading" className={styles.section}>
        <Title order={2} size="h3" id="playback-heading" className={styles.wrap}>
          {episode ? `Эпизод ${episode.number}${episode.name ? ` · ${episode.name}` : ''}` : 'Просмотр'}
        </Title>
        <Playback title={title} episode={episode} hasSelection={selectedId !== null} />
      </section>
      {title.episodes.length > 0 && (
        <nav aria-labelledby="episodes-heading" className={styles.section}>
          <Title order={2} size="h3" id="episodes-heading">Эпизоды</Title>
          <ul className={styles.episodeList}>
            {title.episodes.map((item) => (
              <li key={item.id}>
                <Button
                  component={Link}
                  to={`?${new URLSearchParams({ episode: item.id })}`}
                  variant={item.id === episode?.id ? 'filled' : 'default'}
                  aria-label={`Эпизод ${item.number}${item.name ? `: ${item.name}` : ''}`}
                  aria-current={item.id === episode?.id ? 'true' : undefined}
                  size="compact-md"
                >
                  {item.number}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

export function TitlePage() {
  const { source: key, alias } = useParams<'source' | 'alias'>();
  const source = key ? getSource(key) : undefined;
  const catalog = source && source !== defaultSource ? `/?${new URLSearchParams({ source: source.key })}` : '/';
  return (
    <Stack gap="lg" align="stretch">
      <div><Button component={Link} to={catalog} variant="default" size="xs">← В каталог</Button></div>
      {source && alias
        ? <TitleContent source={source} alias={alias} />
        : <Alert color="red" title="Источник не найден">Проверьте ссылку или выберите аниме в каталоге.</Alert>}
    </Stack>
  );
}
