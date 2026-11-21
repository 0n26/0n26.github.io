import { Alert, Badge, Group, Image, Loader, NativeSelect, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useCallback, useEffect } from 'react';
import { Link, useHref, useLocation, useParams, useSearchParams } from 'react-router';
import { defaultSource, getSource } from '../../sources';
import type { AnimeSource, AnimeTitle, Episode, Franchise } from '../../sources/source';
import { ReleaseCard } from './ReleaseCard';
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
  const separator = sourceKey === defaultSource.key ? title.alias.indexOf(':') : -1;
  const providerKey = separator < 0 ? sourceKey : title.alias.slice(0, separator);
  const originalAlias = separator < 0 ? title.alias : title.alias.slice(separator + 1);
  const episodeKey = JSON.stringify([providerKey, originalAlias, episode.id]);
  return <Player key={episodeKey} episodeKey={episodeKey} streams={episode.streams} poster={poster} />;
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

function RelatedSections({ getRelated, title, routePrefix }: {
  getRelated: NonNullable<AnimeSource['getRelated']>;
  title: AnimeTitle;
  routePrefix: string;
}) {
  const load = useCallback((signal: AbortSignal) => getRelated(title, signal), [getRelated, title]);
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
            {similar.map((entry) => <ReleaseCard key={entry.alias} to={`${routePrefix}/${encodeURIComponent(entry.alias)}`} entry={entry} />)}
          </SimpleGrid>
        </section>
      )}
      {franchises.length > 0 && (
        <section aria-labelledby="franchise-heading">
          <Title order={2} size="h3" id="franchise-heading" mb="sm">Франшиза (Хронология)</Title>
          <Stack gap="md">
            {franchises.map((franchise) => (
              <Chronology key={franchise.id} franchise={franchise} currentAlias={title.alias} routePrefix={routePrefix} />
            ))}
          </Stack>
        </section>
      )}
    </Stack>
  );
}

function useTitleRequest(source: AnimeSource, alias: string | null) {
  const load = useCallback(async (signal: AbortSignal) => {
    // Let StrictMode cancel its probe effect before issuing a network request.
    await Promise.resolve();
    return alias === null || signal.aborted ? null : source.getTitle(alias, signal);
  }, [source, alias]);
  return useSourceRequest(alias === null ? null : load);
}

function TitleContent({ source, alias }: { source: AnimeSource; alias: string }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const href = useHref(location);
  const combined = source.key === defaultSource.key;
  const voice = combined ? params.get('voice') : null;
  const selectedId = params.get('episode');

  const baseRequest = useTitleRequest(source, alias);
  const baseTitle = baseRequest.status === 'ready' ? baseRequest.data : null;
  const voices = combined ? baseTitle?.voices : undefined;
  const useBaseTitle = voice === null || voice === baseTitle?.alias;
  const alternate = !useBaseTitle && voices?.some(({ alias: option }) => option === voice) ? voice : null;
  const voiceRequest = useTitleRequest(source, alternate);
  const request = alternate === null ? baseRequest : voiceRequest;
  const title = request.status === 'ready' && (useBaseTitle || request.data?.alias === alternate) ? request.data : null;

  const switchFrom = location.state?.voiceEpisodeNumber;
  const pendingNumber = voice !== null && typeof switchFrom === 'number' ? switchFrom : null;
  const matchedIndex = title && pendingNumber !== null
    ? title.episodes.findIndex(({ number }) => number === pendingNumber)
    : -1;
  const currentIndex = matchedIndex >= 0 ? matchedIndex
    : selectedId === null ? 0 : (title?.episodes.findIndex(({ id }) => id === selectedId) ?? -1);
  const episode = title?.episodes[currentIndex];

  useEffect(() => {
    // Back can change the hash before React Router commits the new location.
    if (!title || pendingNumber === null || window.location.hash !== href) return;
    const next = new URLSearchParams(params);
    if (matchedIndex >= 0 && episode) next.set('episode', episode.id);
    setParams(next, { replace: true });
  }, [episode, href, matchedIndex, params, pendingNumber, setParams, title]);

  function changeVoice(nextAlias: string) {
    if (!voices?.some(({ alias: option }) => option === nextAlias) || nextAlias === (voice ?? title?.alias)) return;
    const next = new URLSearchParams(params);
    next.set('voice', nextAlias);
    next.delete('episode');
    setParams(next, { state: { voiceEpisodeNumber: episode?.number } });
  }

  if (request.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем аниме…</Text></Group>;
  }
  if (voice !== null && !title) {
    const next = new URLSearchParams(params);
    if (baseTitle) next.set('voice', baseTitle.alias);
    next.delete('episode');
    return (
      <Alert role="alert" color="red" title="Выбранная озвучка недоступна">
        {baseTitle ? <Link to={`?${next}`}>Открыть доступную озвучку</Link> : 'Проверьте подключение и обновите страницу.'}
      </Alert>
    );
  }
  if (request.status === 'error') {
    return <Alert role="alert" color="red" title="Не удалось загрузить аниме">Проверьте подключение и обновите страницу.</Alert>;
  }
  if (!title) {
    return <Alert color="gray" title="Аниме не найдено">Возможно, ссылка устарела.</Alert>;
  }
  return (
    <Stack gap="lg">
      <Group gap="sm" align="baseline" className={styles.heading}>
        <Title order={1}>{title.name}</Title>
        {episode && <Text c="dimmed" size="lg" id="playback-heading">{episodeCaption(episode, currentIndex, title.episodes.length)}</Text>}
      </Group>
      {voices && voices.length > 1 && (
        <NativeSelect aria-label="Озвучка" size="md" radius="xl" value={voice ?? title.alias}
          data={voices.map((voice) => ({ value: voice.alias, label: voice.source }))}
          onChange={(event) => changeVoice(event.currentTarget.value)} />
      )}
      <div className={styles.theater}>
        <Playback title={title} episode={episode} sourceKey={source.key} hasSelection={selectedId !== null} />
        {title.episodes.length > 0 && (
          <EpisodeNavigation key={episode?.id ?? selectedId} episodes={title.episodes} currentIndex={currentIndex} voice={voice} />
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
          title={title}
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
