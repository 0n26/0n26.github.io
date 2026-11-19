import { Alert, Anchor, Card, Group, List, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import { defaultSource } from '../../sources';
import type { AnimeSource, ScheduleEntry } from '../../sources/source';
import { useSourceRequest } from './useSourceRequest';

const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export function SchedulePage() {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1}>Расписание аниме</Title>
        <Text c="dimmed">Неделя по данным {defaultSource.name}. Дни выхода могут меняться.</Text>
      </Stack>
      {defaultSource.getSchedule ? (
        <WeeklySchedule load={defaultSource.getSchedule} sourceKey={defaultSource.key} />
      ) : <Text c="dimmed">Источник не предоставляет расписание.</Text>}
    </Stack>
  );
}

function WeeklySchedule({ load, sourceKey }: { load: NonNullable<AnimeSource['getSchedule']>; sourceKey: string }) {
  const request = useSourceRequest(load);
  if (request.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем расписание…</Text></Group>;
  }
  if (request.status === 'error') {
    return <Alert role="alert" color="red" title="Не удалось загрузить расписание">Проверьте подключение и обновите страницу.</Alert>;
  }
  if (request.data.length === 0) return <Text role="status" c="dimmed">На этой неделе нет релизов в расписании.</Text>;

  const byDay = days.map((): ScheduleEntry[] => []);
  for (const entry of request.data) byDay[entry.day - 1]?.push(entry);
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {days.map((day, index) => (
        <Card key={day} component="section" aria-labelledby={`schedule-day-${index}`} withBorder>
          <Title order={2} size="h4" id={`schedule-day-${index}`} mb="sm">{day}</Title>
          {byDay[index].length ? (
            <List listStyleType="none" spacing="sm">
              {byDay[index].map(({ alias, name, seasonComplete, publishedEpisode, nextEpisodeNumber }) => {
                const href = `/anime/${encodeURIComponent(sourceKey)}/${encodeURIComponent(alias)}`;
                return (
                  <List.Item key={alias}>
                    <Anchor component={Link} to={href} fw={650}>{name}</Anchor>
                    {publishedEpisode && (
                      <div>
                        <Anchor component={Link} to={`${href}?${new URLSearchParams({ episode: publishedEpisode.id })}`} size="sm">
                          Вышел эпизод {publishedEpisode.number}
                        </Anchor>
                      </div>
                    )}
                    {seasonComplete && <Text size="sm" c="dimmed">Сезон вышел полностью</Text>}
                    {nextEpisodeNumber && <Text size="sm" c="dimmed">Следующий эпизод: {nextEpisodeNumber}</Text>}
                  </List.Item>
                );
              })}
            </List>
          ) : <Text size="sm" c="dimmed">Нет релизов</Text>}
        </Card>
      ))}
    </SimpleGrid>
  );
}
