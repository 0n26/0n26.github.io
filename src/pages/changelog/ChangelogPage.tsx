import { Badge, Group, Stack, Text, Title } from '@mantine/core';
import Markdown from 'react-markdown';
import changelog from '../../../changelog.md?raw';
import { version } from '../../../package.json';
import { releaseSections } from './releaseSections';
import styles from './ChangelogPage.module.css';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' });

export function ChangelogPage() {
  return (
    <Stack gap="lg" className={styles.journal}>
      <header>
        <Group justify="space-between" align="center" gap="xs">
          <Title order={1}>Изменения</Title>
          <Badge variant="light" aria-label={`Версия приложения ${version}`}>v{version}</Badge>
        </Group>
        <Text c="dimmed" mt={4}>Новые возможности и исправления «Ночного сеанса» по версиям.</Text>
      </header>
      <div className={styles.entries}>
        <Markdown skipHtml rehypePlugins={[releaseSections]} components={{
          section({ node, children }) {
            const number = node?.properties.dataVersion;
            if (typeof number !== 'string') return <section>{children}</section>;
            const date = String(node?.properties.dataDate);
            const current = number === version;
            return (
              <details className={styles.release} open={current} data-current={current || undefined}>
                <summary>
                  <h2>
                    <span className={styles.number}>v{number}</span>
                    {current && <span className={styles.current}>Текущая версия</span>}
                    <time dateTime={date}>{dateFormat.format(new Date(date))}</time>
                  </h2>
                </summary>
                <div className={styles.notes}>{children}</div>
              </details>
            );
          },
        }}>{changelog}</Markdown>
      </div>
    </Stack>
  );
}
