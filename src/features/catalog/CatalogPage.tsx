import { Alert, AspectRatio, Button, Card, Group, Image, Loader, NativeSelect, Pagination, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useCallback } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { defaultSource, getSource, sources } from '../../sources';
import type { AnimeSource } from '../../sources/source';
import { useSourceRequest } from './useSourceRequest';
import styles from './Catalog.module.css';

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const sourceKey = params.get('source');
  const source = sourceKey === null ? defaultSource : getSource(sourceKey);
  const query = params.get('q')?.trim() ?? '';
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  function changeCatalog(nextQuery: string, nextPage: number, nextSource = sourceKey) {
    const next = new URLSearchParams();
    if (nextQuery) next.set('q', nextQuery);
    if (nextPage > 1) next.set('page', String(nextPage));
    if (nextSource) next.set('source', nextSource);
    setParams(next);
  }

  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    changeCatalog(value, 1);
  }

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1}>Каталог аниме</Title>
        <Text c="dimmed">{source ? `Поиск аниме в каталоге ${source.name}.` : 'Выберите источник аниме.'}</Text>
      </Stack>
      {sources.length > 1 && (
        <NativeSelect
          label="Источник"
          w={{ base: '100%', xs: 240 }}
          value={source?.key ?? ''}
          onChange={(event) => changeCatalog(query, 1, event.currentTarget.value)}
        >
          {!source && <option value="" disabled>Выберите источник</option>}
          {sources.map(({ key, name }) => <option key={key} value={key}>{name}</option>)}
        </NativeSelect>
      )}
      <form role="search" aria-label="Поиск аниме" onSubmit={search} className={styles.search}>
        <TextInput key={query} type="search" name="q" label="Название аниме" defaultValue={query} placeholder="Например, Фрирен" />
        <Button type="submit">Найти</Button>
      </form>
      {source ? (
        <CatalogResults source={source} query={query} page={page} changePage={(next) => changeCatalog(query, next)} />
      ) : (
        <Alert color="red" title="Источник не найден">
          <Button variant="light" size="xs" onClick={() => changeCatalog(query, 1, null)}>Открыть каталог {defaultSource.name}</Button>
        </Alert>
      )}
    </Stack>
  );
}

function CatalogResults({ source, query, page, changePage }: {
  source: AnimeSource;
  query: string;
  page: number;
  changePage: (page: number) => void;
}) {
  const load = useCallback((signal: AbortSignal) => source.getCatalog(query, page, signal), [source, query, page]);
  const request = useSourceRequest(load);
  const routePrefix = `/anime/${encodeURIComponent(source.key)}`;

  return (
    <>
      {request.status === 'loading' && (
        <Group role="status" gap="xs"><Loader size="xs" aria-hidden /> <Text>Загружаем каталог…</Text></Group>
      )}
      {request.status === 'error' && (
        <Alert role="alert" color="red" title="Не удалось загрузить каталог">Проверьте подключение и обновите страницу.</Alert>
      )}
      {request.status === 'ready' && (
        <>
          {request.data.page > request.data.totalPages ? (
            <Alert color="gray" title="Страница не найдена">
              <Button variant="light" size="xs" onClick={() => changePage(1)}>К первой странице</Button>
            </Alert>
          ) : request.data.items.length === 0 ? (
            <Text role="status" c="dimmed">{query ? 'Ничего не найдено. Попробуйте изменить запрос.' : 'Каталог пуст.'}</Text>
          ) : (
            <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} spacing={{ base: 'xs', sm: 'md' }}>
              {request.data.items.map((entry) => (
                <Card key={entry.alias} component={Link} to={`${routePrefix}/${encodeURIComponent(entry.alias)}`} withBorder p="xs" className={styles.card}>
                  <Card.Section mb="xs">
                    <AspectRatio ratio={2 / 3}>
                      {entry.poster ? <Image src={entry.poster} alt="" loading="lazy" decoding="async" /> : <div className={styles.placeholder}>Нет постера</div>}
                    </AspectRatio>
                  </Card.Section>
                  <Text fw={650} size="sm" className={styles.wrap}>{entry.name}</Text>
                  {entry.year && <Text size="xs" c="dimmed">{entry.year}</Text>}
                </Card>
              ))}
            </SimpleGrid>
          )}
          {request.data.page <= request.data.totalPages && request.data.totalPages > 1 && (
            <nav aria-label="Страницы каталога">
              <Pagination
                layout="responsive"
                size="sm"
                siblings={0}
                total={request.data.totalPages}
                value={request.data.page}
                onChange={changePage}
                formatLabel={({ page, totalPages }) => `Страница ${page} из ${totalPages}`}
                getControlProps={(control) => ({ 'aria-label': control === 'previous' ? 'Предыдущая страница' : 'Следующая страница' })}
                getItemProps={(number) => ({ 'aria-label': `Страница ${number}` })}
              />
            </nav>
          )}
        </>
      )}
    </>
  );
}
