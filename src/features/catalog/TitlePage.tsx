import { Alert, Group, Image, Loader, NativeSelect, Stack, Text, Title } from '@mantine/core';
import { Link, useParams } from 'react-router';
import { catalog } from '../../catalog';
import type { TitleAccess, VoiceOption } from '../../catalog/catalog';
import { voiceParams } from './titleLinks';
import { Playback } from './Playback';
import { RelatedSections } from './RelatedSections';
import { useTitlePlayback } from './useTitlePlayback';
import { titleMetaRows } from './titleMeta';
import { EpisodeNavigation, episodeCaption } from './EpisodeNavigation';
import styles from './TitlePage.module.css';

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
  const watch = useTitlePlayback(source, alias);

  if (watch.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем аниме…</Text></Group>;
  }
  if (watch.status === 'unavailable') {
    const recovery = watch.alternatives?.length ? <VoiceStartLinks options={watch.alternatives} params={watch.params} />
      : watch.legacyFallback ? <Link to={`?${voiceParams(watch.params, alias)}`}>Вернуться к исходной озвучке</Link> : null;
    if (watch.error) {
      return (
        <Alert role="alert" color="red" title={watch.error}>
          {recovery ?? 'Проверьте подключение и обновите страницу.'}
        </Alert>
      );
    }
    return <Alert color="gray" title="Аниме не найдено">{recovery ?? 'Возможно, ссылка устарела.'}</Alert>;
  }

  const { title, episode, currentIndex, selectedId, voice, choices, starts, params } = watch;
  const metaRows = titleMetaRows(title);

  return (
    <Stack gap="lg">
      <Group gap="sm" align="baseline" className={styles.heading}>
        <Title order={1}>{title.name}</Title>
        {episode && <Text c="dimmed" size="lg" id="playback-heading">{episodeCaption(episode, currentIndex, title.episodes.length)}</Text>}
      </Group>
      {choices && (
        <NativeSelect aria-label="Озвучка" size="md" radius="xl" value={title.alias} disabled={choices.length === 1}
          data={choices.map((option) => ({ value: option.alias, label: voiceLabel(option) }))}
          onChange={(event) => watch.changeVoice(event.currentTarget.value)} />
      )}
      {watch.rangeChanged && (
        <Text role="status" size="sm" c="dimmed">Список серий у источника изменился. Нельзя продолжить с той же серии в другой озвучке.</Text>
      )}
      {starts && starts.length > 0 && <VoiceStartLinks options={starts} params={params} />}
      <div className={styles.theater}>
        <Playback title={title} episode={episode} hasSelection={selectedId !== null} rangeMismatch={watch.rangeMismatch} />
        {title.episodes.length > 0 && (
          <EpisodeNavigation key={episode?.id ?? selectedId} episodes={title.episodes} currentIndex={currentIndex} voice={voice} />
        )}
      </div>
      <details className={styles.about}>
        <summary>
          <strong>О тайтле</strong>
          <span>{source.name}{title.year && ` · ${title.year}`}</span>
        </summary>
        {metaRows.length > 0 && (
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
