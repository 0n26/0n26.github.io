import { Alert, Group, Image, Loader, NativeSelect, Stack, Text, Title } from '@mantine/core';
import { useCallback, useEffect } from 'react';
import { Link, useHref, useLocation, useParams, useSearchParams } from 'react-router';
import { catalog } from '../../catalog';
import type { TitleAccess, VoiceOption } from '../../catalog/catalog';
import { parseVoiceAlias } from '../../catalog/titleRef';
import type { EpisodeRange } from '../../sources/source';
import { Playback } from './Playback';
import { RelatedSections } from './RelatedSections';
import { useSourceRequest } from './useSourceRequest';
import { titleMetaRows } from './titleMeta';
import { EpisodeNavigation, episodeCaption } from './EpisodeNavigation';
import { rangeContains, voiceEpisodeIndex, voiceEpisodeNumber } from './voiceEpisodes';
import styles from './TitlePage.module.css';

function useTitleRequest(source: TitleAccess, alias: string | null) {
  const load = useCallback(async (signal: AbortSignal) => {
    // Let StrictMode cancel its probe effect before issuing a network request.
    await Promise.resolve();
    return alias === null || signal.aborted ? null : source.getTitle(alias, signal);
  }, [source, alias]);
  return useSourceRequest(alias === null ? null : load);
}

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

function TitleContent({ source, sourceKey, alias }: { source: TitleAccess; sourceKey: string; alias: string }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const href = useHref(location);
  const voice = source.getVoices ? params.get('voice') : null;
  const selectedId = params.get('episode');

  const locator = voice === null || parseVoiceAlias(voice) ? voice ?? alias : null;
  const request = useTitleRequest(source, locator);
  const title = request.status === 'ready' ? request.data : null;
  const loadVoices = useCallback(async (signal: AbortSignal) => {
    await Promise.resolve();
    return signal.aborted ? [] : (source.getVoices?.(alias, signal) ?? []);
  }, [source, alias]);
  const voicesRequest = useSourceRequest(source.getVoices ? loadVoices : null);
  const indexedVoices = voicesRequest.status === 'ready' ? voicesRequest.data : undefined;

  const switchFrom = location.state?.voiceEpisodeNumber;
  const pendingNumber = voice !== null && typeof switchFrom === 'number' ? switchFrom : null;
  const pendingRange: EpisodeRange | undefined = location.state?.voiceEpisodeRange;
  const matchedIndex = title && pendingNumber !== null
    ? voiceEpisodeIndex(title.episodes, pendingNumber, pendingRange)
    : -1;
  const currentIndex = matchedIndex >= 0 ? matchedIndex
    : selectedId === null ? 0 : (title?.episodes.findIndex(({ id }) => id === selectedId) ?? -1);
  const episode = title?.episodes[currentIndex];
  const rangeMismatch = pendingNumber !== null && matchedIndex < 0;
  const metaRows = title && titleMetaRows(title);

  useEffect(() => {
    // Back can change the hash before React Router commits the new location.
    if (!title || pendingNumber === null || window.location.hash !== href) return;
    const next = new URLSearchParams(params);
    if (matchedIndex >= 0 && episode) next.set('episode', episode.id);
    setParams(next, { replace: true });
  }, [episode, href, matchedIndex, params, pendingNumber, setParams, title]);

  if (locator !== null && request.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем аниме…</Text></Group>;
  }
  if (!title) {
    const alternatives = indexedVoices?.filter((option) => option.alias !== voice);
    const legacyFallback = voice !== null && locator !== null && voice !== alias && parseVoiceAlias(alias)
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
    return siblings.some((other) => other !== option && other.sourceKey === option.sourceKey);
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
        <Playback title={title} episode={episode} hasSelection={selectedId !== null} rangeMismatch={rangeMismatch} />
        {title.episodes.length > 0 && (
          <EpisodeNavigation key={episode?.id ?? selectedId} episodes={title.episodes} currentIndex={currentIndex} voice={voice} />
        )}
      </div>
      <details className={styles.about}>
        <summary>
          <strong>О тайтле</strong>
          <span>{source.name}{title.year && ` · ${title.year}`}</span>
        </summary>
        {metaRows && metaRows.length > 0 && (
          <dl className={styles.meta}>
            {metaRows.map(({ label, value }) => (
              <div key={label} className={styles.metaRow}>
                <dt>{label}:</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
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
          sourceKey={sourceKey}
        />
      )}
    </Stack>
  );
}

export function TitlePage() {
  const { source: sourceKey, alias } = useParams<'source' | 'alias'>();
  const source = sourceKey ? catalog.getTitleAccess(sourceKey) : undefined;
  return source && sourceKey && alias
    ? <TitleContent key={`${sourceKey}/${alias}`} source={source} sourceKey={sourceKey} alias={alias} />
    : <Alert color="red" title="Источник не найден">Проверьте ссылку или выберите аниме в каталоге.</Alert>;
}
