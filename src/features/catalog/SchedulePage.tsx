import { Alert, Badge, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useSearchParams } from 'react-router';
import { catalog } from '../../catalog';
import { catalogSourceKey } from '../../catalog/titleRef';
import { episodeQuery, titleHref } from './titleLinks';
import { useRequest } from '../../hooks/useRequest';
import styles from './SchedulePage.module.css';

export function SchedulePage() {
  return (
    <Stack gap="lg" className={styles.guide}>
      <Stack gap={4}>
        <Group justify="space-between" gap="xs">
          <Title order={1}>Расписание</Title>
          <Badge variant="outline" color="gray">{catalog.name}</Badge>
        </Group>
        <Text c="dimmed">Выход серий по дням недели. Дни выхода могут меняться.</Text>
      </Stack>
      <WeeklySchedule />
    </Stack>
  );
}

function WeeklySchedule() {
  const request = useRequest(catalog.getSchedule);
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
  return <ScheduleWeek today={today} selected={selected} entries={entries} />;
}
