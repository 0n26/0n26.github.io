import { Badge, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useCallback } from 'react';
import { Link } from 'react-router';
import type { AnimeSource, AnimeTitle, Franchise } from '../../sources/source';
import { ReleaseCard } from './ReleaseCard';
import { useSourceRequest } from './useSourceRequest';
import styles from './TitlePage.module.css';

function Chronology({ franchise, currentAlias, routePrefix }: {
  franchise: Franchise;
  currentAlias: string;
  routePrefix: string;
}) {
  return (
    <div>
      <Text fw={600} mb={6}>{franchise.name}</Text>
      <ol className={styles.chronology}>
        {franchise.releases.map((release) => (
          <li key={release.alias} aria-current={release.alias === currentAlias ? 'page' : undefined}>
            <Link to={`${routePrefix}/${encodeURIComponent(release.alias)}`} className={styles.chronologyLink}>
              {release.name}
            </Link>
            {release.year && <Text span size="sm" c="dimmed"> · {release.year}</Text>}
            {release.alias === currentAlias && <Badge size="xs" variant="light" ml="xs">Сейчас</Badge>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RelatedSections({ getRelated, title, routePrefix }: {
  getRelated: NonNullable<AnimeSource['getRelated']>;
  title: AnimeTitle;
  routePrefix: string;
}) {
  const load = useCallback((signal: AbortSignal) => getRelated(title, signal), [getRelated, title]);
  const request = useSourceRequest(load);

  if (request.status === 'loading') {
    return <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text c="dimmed">Загружаем связанные тайтлы…</Text></Group>;
  }
  if (request.status === 'error') return null;

  const { similar, franchises } = request.data;
  if (similar.length === 0 && !franchises) return null;

  return (
    <Stack gap="lg">
      {similar.length > 0 && (
        <section aria-labelledby="similar-heading">
          <Title order={2} size="h3" id="similar-heading" mb="sm">Похожее</Title>
          <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 6 }} spacing="md">
            {similar.map((entry) => <ReleaseCard key={entry.alias} to={`${routePrefix}/${encodeURIComponent(entry.alias)}`} entry={entry} />)}
          </SimpleGrid>
        </section>
      )}
      {franchises && (
        <section aria-labelledby="franchise-heading">
          <Title order={2} size="h3" id="franchise-heading" mb="sm">
            {franchises.length > 0 ? 'Франшиза (Хронология)' : 'Ни одной связанной франшизы'}
          </Title>
          {franchises.length > 0 ? (
            <Stack gap="md">
              {franchises.map((franchise) => (
                <Chronology key={franchise.id} franchise={franchise} currentAlias={title.alias} routePrefix={routePrefix} />
              ))}
            </Stack>
          ) : (
            <Text c="dimmed">Данный релиз не связан ни с одной франшизой</Text>
          )}
        </section>
      )}
    </Stack>
  );
}
