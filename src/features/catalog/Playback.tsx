import { Alert, Text } from '@mantine/core';
import type { ResolvedTitle } from '../../catalog/catalog';
import { episodePlaybackKey } from '../../catalog/titleRef';
import type { Episode } from '../../sources/source';
import { Player } from '../player/Player';

const restrictionMessages = {
  geo: 'Источник ограничил просмотр в вашем регионе.',
  copyright: 'Просмотр ограничен по требованию правообладателя.',
  unknown: 'Источник не подтвердил доступность просмотра.',
};

export function Playback({ title, episode, hasSelection, rangeMismatch }: {
  title: ResolvedTitle; episode?: Episode; hasSelection: boolean; rangeMismatch: boolean;
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
  const episodeKey = episodePlaybackKey(title.ref, episode.id);
  return <Player key={episodeKey} episodeKey={episodeKey} streams={episode.streams} poster={poster} />;
}
