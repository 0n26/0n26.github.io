import { Alert, Badge, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { Link, useSearchParams } from 'react-router';
import { defaultSource } from '../../sources';
import type { AnimeSource } from '../../sources/source';
import { useSourceRequest } from './useSourceRequest';
import styles from './SchedulePage.module.css';

const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const shortDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function SchedulePage() {
  return (
    <Stack gap="lg" className={styles.guide}>
      <Stack gap={4}>
        <Group justify="space-between" gap="xs">
          <Title order={1}>Расписание</Title>
          <Badge variant="outline" color="gray">{defaultSource.name}</Badge>
        </Group>
        <Text c="dimmed">Выход серий по дням недели. Дни выхода могут меняться.</Text>
      </Stack>
      {defaultSource.getSchedule ? (
        <WeeklySchedule load={defaultSource.getSchedule} sourceKey={defaultSource.key} />
      ) : <Text c="dimmed">Источник не предоставляет расписание.</Text>}
    </Stack>
  );
}

function WeeklySchedule({ load, sourceKey }: { load: NonNullable<AnimeSource['getSchedule']>; sourceKey: string }) {
  const request = useSourceRequest(load);
  const [params] = useSearchParams();
  const today = new Date().getDay() || 7;
  const param = params.get('day') ?? '';
  const selected = /^[1-7]$/.test(param) ? Number(param) : today;
  if (request.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем расписание…</Text></Group>;
  }
  if (request.status === 'error') {
    return <Alert role="alert" color="red" title="Не удалось загрузить расписание">Проверьте подключение и обновите страницу.</Alert>;
  }
  if (request.data.length === 0) return <Text role="status" c="dimmed">На этой неделе нет релизов в расписании.</Text>;

  const entries = request.data.filter(({ day }) => day === selected);
  return (
    <>
      <nav className={styles.week} aria-label="Дни недели">
        {days.map((day, i) => (
          <Link key={day} to={`?day=${i + 1}`} aria-current={selected === i + 1 ? 'page' : undefined}
            aria-label={today === i + 1 ? `${day}, сегодня` : day}>
            <span className={styles.longDay}>{day}</span>
            <span className={styles.shortDay}>{shortDays[i]}</span>
            {today === i + 1 && <span className={styles.todayDot} aria-hidden="true" />}
          </Link>
        ))}
      </nav>
      <section aria-labelledby="schedule-day">
        <Group justify="space-between" align="baseline" mb="sm">
          <Title id="schedule-day" order={2} size="h3">{selected === today && 'Сегодня · '}{days[selected - 1]}</Title>
          <Text c="dimmed" size="sm">Тайтлов: {entries.length}</Text>
        </Group>
        {entries.length === 0 ? <Text role="status" c="dimmed">На этот день релизов нет. Выберите другой день.</Text> : (
          <ul className={styles.list}>
            {entries.map(({ alias, name, poster, seasonComplete, publishedEpisode, nextEpisodeNumber }) => {
              const href = `/anime/${encodeURIComponent(sourceKey)}/${encodeURIComponent(alias)}`;
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
                    <Link className={styles.watch} to={`${href}?${new URLSearchParams({ episode: publishedEpisode.id })}`}
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
