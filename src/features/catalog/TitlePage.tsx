import { Alert, Badge, Group, Image, Loader, NativeSelect, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useCallback, useEffect } from 'react';
import { Link, useHref, useLocation, useParams, useSearchParams } from 'react-router';
import { defaultSource, getSource } from '../../sources';
import type { AnimeSource, AnimeTitle, Episode, EpisodeRange, Franchise, VoiceOption } from '../../sources/source';
import { ReleaseCard } from './ReleaseCard';
import { Player } from '../player/Player';
import { useSourceRequest } from './useSourceRequest';
import { EpisodeNavigation, episodeCaption } from './EpisodeNavigation';
import { rangeContains, voiceEpisodeIndex, voiceEpisodeNumber } from './voiceEpisodes';
import styles from './TitlePage.module.css';

const restrictionMessages = {
  geo: 'Источник ограничил просмотр в вашем регионе.',
  copyright: 'Просмотр ограничен по требованию правообладателя.',
  unknown: 'Источник не подтвердил доступность просмотра.',
};

function Playback({ title, episode, sourceKey, hasSelection, rangeMismatch }: {
  title: AnimeTitle; episode?: Episode; sourceKey: string; hasSelection: boolean; rangeMismatch: boolean;
}) {
  if (title.restriction) {
    return <Alert color="yellow" title="Просмотр недоступен">{restrictionMessages[title.restriction]}</Alert>;
  }
  if (rangeMismatch) {
    return <Alert role="alert" color="yellow" title="Не удалось сопоставить серии">Список серий у источника изменился. Выберите серию вручную.</Alert>;
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

const qualifiedAlias = /^(?!group:)[^:]+:.+$/;

function voiceParams(params: URLSearchParams, alias: string) {
  const next = new URLSearchParams(params);
  next.set('voice', alias);
  next.delete('episode');
  return next;
}

function voiceLabel({ source, episodeRange }: VoiceOption) {
  return episodeRange ? `${source} (серии ${episodeRange.first}–${episodeRange.first + episodeRange.count - 1})` : source;
}

function VoiceStartLinks({ options, params }: { options: readonly VoiceOption[]; params: URLSearchParams }) {
  return (
    <Group gap="sm">
      {options.map((option) => (
        <Link key={option.alias} to={`?${voiceParams(params, option.alias)}`}>Открыть {voiceLabel(option)} с начала</Link>
      ))}
    </Group>
  );
}

function TitleContent({ source, alias }: { source: AnimeSource; alias: string }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const href = useHref(location);
  const combined = source.key === defaultSource.key;
  const voice = combined ? params.get('voice') : null;
  const selectedId = params.get('episode');

  const locator = voice === null || qualifiedAlias.test(voice) ? voice ?? alias : null;
  const request = useTitleRequest(source, locator);
  const title = request.status === 'ready' ? request.data : null;
  const loadVoices = useCallback(async (signal: AbortSignal) => {
    await Promise.resolve();
    return signal.aborted ? [] : (source.getVoices?.(alias, signal) ?? []);
  }, [source, alias]);
  const voicesRequest = useSourceRequest(combined ? loadVoices : null);
  const indexedVoices = voicesRequest.status === 'ready' ? voicesRequest.data : undefined;

  const switchFrom = location.state?.voiceEpisodeNumber;
  const pendingNumber = voice !== null && typeof switchFrom === 'number' ? switchFrom : null;
  const pendingRange: EpisodeRange | undefined = location.state?.voiceEpisodeRange;
  const matchedIndex = title && pendingNumber !== null && (!pendingRange || title.alias === voice)
    ? voiceEpisodeIndex(title.episodes, pendingNumber, pendingRange)
    : -1;
  const rangeMismatch = pendingRange !== undefined && pendingNumber !== null && matchedIndex < 0;
  const currentIndex = matchedIndex >= 0 ? matchedIndex : rangeMismatch ? -1
    : selectedId === null ? 0 : (title?.episodes.findIndex(({ id }) => id === selectedId) ?? -1);
  const episode = title?.episodes[currentIndex];

  useEffect(() => {
    // Back can change the hash before React Router commits the new location.
    // Keep failed ranged switches pending so revisiting them cannot play episode one.
    if (!title || pendingNumber === null || rangeMismatch || window.location.hash !== href) return;
    const next = new URLSearchParams(params);
    if (matchedIndex >= 0 && episode) next.set('episode', episode.id);
    setParams(next, { replace: true });
  }, [episode, href, matchedIndex, params, pendingNumber, rangeMismatch, setParams, title]);

  if (locator !== null && request.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем аниме…</Text></Group>;
  }
  if (!title) {
    const activeAlias = voice ?? indexedVoices?.[0]?.alias;
    const alternatives = indexedVoices?.filter((option) => option.alias !== activeAlias);
    const legacyFallback = voice !== null && locator !== null && voice !== alias && qualifiedAlias.test(alias)
      && voicesRequest.status !== 'loading' && !alternatives?.length;
    const recovery = alternatives?.length ? <VoiceStartLinks options={alternatives} params={params} />
      : legacyFallback ? <Link to={`?${voiceParams(params, alias)}`}>Вернуться к исходной озвучке</Link> : null;
    if (voice !== null || request.status === 'error') {
      return (
        <Alert role="alert" color="red" title={voice !== null ? 'Выбранная озвучка недоступна' : 'Не удалось загрузить аниме'}>
          {recovery ?? 'Проверьте подключение и обновите страницу.'}
        </Alert>
      );
    }
    return <Alert color="gray" title="Аниме не найдено">{recovery ?? 'Возможно, ссылка устарела.'}</Alert>;
  }

  const currentVoice = indexedVoices?.find((option) => option.alias === title.alias);
  const voices = currentVoice && indexedVoices && indexedVoices.length > 1 ? indexedVoices : undefined;
  const currentRange = currentVoice?.episodeRange;
  const ordinal = voiceEpisodeNumber(title.episodes, currentIndex, currentRange);
  const choices = voices?.filter((option) => option === currentVoice || !option.episodeRange
    || (ordinal !== undefined && rangeContains(option.episodeRange, ordinal)));
  const starts = voices?.filter((option, _, siblings) => {
    if (option === currentVoice || !option.episodeRange) return false;
    if (ordinal === undefined) return true;
    const provider = option.alias.slice(0, option.alias.indexOf(':') + 1);
    return siblings.some((other) => other !== option && other.alias.startsWith(provider));
  });

  function changeVoice(nextAlias: string) {
    const target = choices?.find((option) => option.alias === nextAlias);
    if (!target || target === currentVoice) return;
    setParams(voiceParams(params, target.alias), {
      state: { voiceEpisodeNumber: ordinal, voiceEpisodeRange: target.episodeRange },
    });
  }

  return (
    <Stack gap="lg">
      <Group gap="sm" align="baseline" className={styles.heading}>
        <Title order={1}>{title.name}</Title>
        {episode && <Text c="dimmed" size="lg" id="playback-heading">{episodeCaption(episode, currentIndex, title.episodes.length)}</Text>}
      </Group>
      {choices && (
        <NativeSelect aria-label="Озвучка" size="md" radius="xl" value={title.alias} disabled={choices.length === 1}
          data={choices.map((option) => ({ value: option.alias, label: voiceLabel(option) }))}
          onChange={(event) => changeVoice(event.currentTarget.value)} />
      )}
      {currentRange && episode && ordinal === undefined && (
        <Text role="status" size="sm" c="dimmed">Список серий у источника изменился. Нельзя продолжить с той же серии в другой озвучке.</Text>
      )}
      {starts && starts.length > 0 && <VoiceStartLinks options={starts} params={params} />}
      <div className={styles.theater}>
        <Playback title={title} episode={episode} sourceKey={source.key} hasSelection={selectedId !== null} rangeMismatch={rangeMismatch} />
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
