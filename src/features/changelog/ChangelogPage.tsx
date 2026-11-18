import { Badge, Card, Group, Stack, Title, Typography } from '@mantine/core';
import Markdown from 'react-markdown';
import changelog from '../../../changelog.md?raw';
import { version } from '../../../package.json';

export function ChangelogPage() {
  return (
    <Stack>
      <Group>
        <Title order={1}>Что изменилось</Title>
        <Badge variant="light">v{version}</Badge>
      </Group>
      <Card withBorder padding="xl">
        <Typography>
          <Markdown skipHtml>{changelog}</Markdown>
        </Typography>
      </Card>
    </Stack>
  );
}
