import { Alert, Anchor, Avatar, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { useRequest } from '../../hooks/useRequest';
import { loadContributors, REPOSITORY_URL } from './contributors';
import styles from './AboutPage.module.css';

function commitsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'коммит';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'коммита';
  return 'коммитов';
}

export function ContributorsSection() {
  const request = useRequest(loadContributors);
  const contributors = request.status === 'ready' ? request.data : undefined;

  return (
    <section className={styles.section} aria-labelledby="about-contributors">
      <Title id="about-contributors" order={2} size="h3">Участники</Title>
      <Text c="dimmed" size="sm">
        Участники с аккаунтом GitHub. Боты, отмеченные GitHub, скрыты.
      </Text>
      {request.status === 'loading' && (
        <Group role="status" gap="xs">
          <Loader size="xs" aria-hidden />
          <Text>Загружаем список участников…</Text>
        </Group>
      )}
      {request.status === 'error' && (
        <Alert color="red" title="Не удалось загрузить список участников">
          <Anchor href={`${REPOSITORY_URL}/graphs/contributors`} target="_blank" rel="noopener noreferrer">
            Посмотреть вклад в репозиторий на GitHub
          </Anchor>
        </Alert>
      )}
      {contributors && (contributors.length === 0 ? (
        <Text c="dimmed">Участники не найдены.</Text>
      ) : (
        <div className={styles.contributors}>
          {contributors.map((person) => (
            <Anchor
              key={person.login}
              href={`https://github.com/${person.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.contributor}
            >
              <Avatar src={person.avatar_url} alt="" radius="xl" size="md" />
              <Stack gap={0}>
                <Text fw={600} size="sm">{person.login}</Text>
                <Text size="xs" c="dimmed">{person.contributions} {commitsLabel(person.contributions)}</Text>
              </Stack>
            </Anchor>
          ))}
        </div>
      ))}
    </section>
  );
}
