import { Alert, Text } from '@mantine/core';
import { defaultSource } from '../../sources';
import type { AnimeTitle, Episode } from '../../sources/source';
import { Player } from '../player/Player';

const restrictionMessages = {
  geo: 'Источник ограничил просмотр в вашем регионе.',
  copyright: 'Просмотр ограничен по требованию правообладателя.',
  unknown: 'Источник не подтвердил доступность просмотра.',
};

export function Playback({ title, episode, sourceKey, hasSelection, rangeMismatch }: {
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
