import { Group, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import { catalogSourceKey } from '../../catalog/titleRef';
import type { ScheduleEntry } from '../../sources/source';
import { episodeQuery, titleHref } from './titleLinks';
import styles from './SchedulePage.module.css';

const days = [
  ['Понедельник', 'Пн'],
  ['Вторник', 'Вт'],
  ['Среда', 'Ср'],
  ['Четверг', 'Чт'],
  ['Пятница', 'Пт'],
  ['Суббота', 'Сб'],
  ['Воскресенье', 'Вс'],
] as const;

export function ScheduleWeek({ today, selected, entries }: {
  today: number;
  selected: number;
  entries: readonly ScheduleEntry[];
}) {
  return (
    <>
      <nav className={styles.week} aria-label="Дни недели">
        {days.map(([day, shortDay], i) => {
          const number = i + 1;
          return (
            <Link key={day} to={`?day=${number}`} aria-current={selected === number ? 'page' : undefined}
              aria-label={today === number ? `${day}, сегодня` : day}>
              <span className={styles.longDay}>{day}</span>
              <span className={styles.shortDay}>{shortDay}</span>
              {today === number && <span className={styles.todayDot} aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
      <section aria-labelledby="schedule-day">
        <Group justify="space-between" align="baseline" mb="sm">
          <Title id="schedule-day" order={2} size="h3">{selected === today && 'Сегодня · '}{days[selected - 1][0]}</Title>
          <Text c="dimmed" size="sm">Тайтлов: {entries.length}</Text>
        </Group>
        {entries.length === 0 ? <Text role="status" c="dimmed">На этот день релизов нет. Выберите другой день.</Text> : (
          <ul className={styles.list}>
            {entries.map(({ alias, name, poster, seasonComplete, publishedEpisode, nextEpisodeNumber }) => {
              const href = titleHref(catalogSourceKey, alias);
              return (
                <li key={alias} className={styles.row}>
                  <div className={styles.poster} aria-hidden="true">
                    {poster ? <img src={poster} alt="" loading="lazy" decoding="async" /> : name.slice(0, 1)}
                  </div>
                  <div className={styles.info}>
                    <Link className={styles.title} to={href}>{name}</Link>
                    {seasonComplete ? <Text size="sm" c="dimmed">Сезон вышел полностью</Text>
                      : nextEpisodeNumber ? <Text size="sm" c="dimmed">Следующая серия: {nextEpisodeNumber}</Text>
                      : !publishedEpisode && <Text size="sm" c="dimmed">В расписании</Text>}
                  </div>
                  {publishedEpisode && (
                    <Link className={styles.watch} to={`${href}${episodeQuery(publishedEpisode.id)}`}
                      aria-label={`Смотреть: ${name}, серия ${publishedEpisode.number}`}>
                      Серия {publishedEpisode.number} <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
