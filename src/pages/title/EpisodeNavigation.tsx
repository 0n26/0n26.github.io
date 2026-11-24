import { NativeSelect, Paper, Title, UnstyledButton, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import type { Episode } from '../../sources/source';
import { episodeQuery } from '../../routes/titleLinks';
import styles from './EpisodeNavigation.module.css';

const groupSize = 20;

export function episodeCaption(episode: Episode, index: number, total: number) {
  const count = episode.number === index + 1 ? ` из ${total}` : '';
  return `Серия ${episode.number}${count}${episode.name ? ` · ${episode.name}` : ''}`;
}

export function EpisodeNavigation({ episodes, currentIndex, voice }: { episodes: readonly Episode[]; currentIndex: number; voice: string | null }) {
  const { breakpoints } = useMantineTheme();
  const desktop = useMediaQuery(`(min-width: ${breakpoints.sm})`, undefined, { getInitialValueInEffect: false });
  const [expanded, setExpanded] = useState(false);
  const [group, setGroup] = useState(Math.floor(Math.max(0, currentIndex) / groupSize));
  const pickerId = useId();
  const start = group * groupSize;
  const current = episodes[currentIndex];
  const caption = current ? episodeCaption(current, currentIndex, episodes.length) : 'Выбрать серию';
  const groupLabel = episodes.every((episode, index) => episode.number === index + 1) ? 'Серии' : 'Позиции';

  function neighbor(direction: -1 | 1) {
    const episode = episodes[currentIndex + direction];
    if (!current || !episode) return null;
    const back = direction === -1;
    const label = desktop ? `Серия ${episode.number}` : back ? 'Назад' : 'Далее';
    const description = `${back ? 'Назад' : 'Далее'}: ${episodeCaption(episode, currentIndex + direction, episodes.length)}`;
    return (
      <Link to={episodeQuery(episode.id, voice)} className={back ? styles.previous : styles.next} aria-label={description} title={description}>
        {back ? `← ${label}` : `${label} →`}
      </Link>
    );
  }

  const picker = (desktop || expanded) && (
    <div id={pickerId} className={styles.picker}>
      {episodes.length > groupSize && (
        <NativeSelect aria-label="Диапазон эпизодов" value={group} onChange={(event) => setGroup(Number(event.currentTarget.value))}>
          {Array.from({ length: Math.ceil(episodes.length / groupSize) }, (_, i) => (
            <option key={i} value={i}>{groupLabel} {i * groupSize + 1}–{Math.min((i + 1) * groupSize, episodes.length)}</option>
          ))}
        </NativeSelect>
      )}
      <ul className={styles.grid}>
        {episodes.slice(start, start + groupSize).map((episode, offset) => {
          const index = start + offset;
          const label = episodeCaption(episode, index, episodes.length);
          return (
            <li key={episode.id} className={episode.name ? styles.named : undefined}>
              <Link to={episodeQuery(episode.id, voice)} aria-current={index === currentIndex ? 'page' : undefined} aria-label={label} title={label}>
                {episode.number}{episode.name && ` · ${episode.name}`}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <Paper component="nav" aria-label="Эпизоды" withBorder className={styles.panel} data-desktop={desktop || undefined}>
      {desktop && <><Title order={2} size="h4">Эпизоды</Title>{picker}</>}
      {(!desktop || (current && episodes.length > 1)) && (
        <div className={styles.row}>
          {neighbor(-1)}
          {!desktop && (
            <UnstyledButton className={styles.toggle} aria-expanded={expanded} aria-controls={expanded ? pickerId : undefined}
              onClick={() => setExpanded(!expanded)} title={caption}>
              <span>{caption}</span><span aria-hidden>{expanded ? '▴' : '▾'}</span>
            </UnstyledButton>
          )}
          {neighbor(1)}
        </div>
      )}
      {!desktop && picker}
    </Paper>
  );
}
