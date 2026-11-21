import type { AnimeTitle } from '../../sources/source';

export interface TitleMetaRow {
  label: string;
  value: string;
}

function plural(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  switch (count % 10) {
    case 1: return one;
    case 2:
    case 3:
    case 4: return few;
    default: return many;
  }
}

export function episodeCountText(count: number): string {
  return `${count} ${plural(count, 'эпизод', 'эпизода', 'эпизодов')}`;
}

export function watchTimeText(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${plural(hours, 'час', 'часа', 'часов')}`);
  if (rest > 0) parts.push(`${rest} ${plural(rest, 'минута', 'минуты', 'минут')}`);
  return parts.join(', ');
}

export function titleMetaRows(title: AnimeTitle): readonly TitleMetaRow[] {
  const rows: TitleMetaRow[] = [];
  const add = (label: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') rows.push({ label, value: String(value) });
  };

  add('Тип', title.type);
  add('Сезон', title.season);
  if (title.genres?.length) add('Жанры', title.genres.join(' • '));
  add('Год выхода', title.year);
  if (title.episodesTotal) add('Всего эпизодов', episodeCountText(title.episodesTotal));
  if (title.episodesTotal && title.episodeDurationMinutes) {
    add('Общее время просмотра', watchTimeText(title.episodesTotal * title.episodeDurationMinutes));
  }
  return rows;
}
