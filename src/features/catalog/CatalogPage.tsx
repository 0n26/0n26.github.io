import { Alert, AspectRatio, Button, Card, Group, Image, Loader, NativeSelect, Pagination, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useCallback } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { defaultSource, getSource, sources } from '../../sources';
import type { AnimeSource, CatalogFilters } from '../../sources/source';
import { useSourceRequest } from './useSourceRequest';
import styles from './Catalog.module.css';

function positiveParam(value: string | null | undefined): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return;
  const number = Number(value);
  if (Number.isSafeInteger(number)) return number;
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const sourceKey = params.get('source');
  const source = sourceKey === null ? defaultSource : getSource(sourceKey);
  const query = params.get('q')?.trim() ?? '';
  const page = positiveParam(params.get('page')) ?? 1;
  const getFilters = source?.getCatalogFilters;
  const genre = getFilters ? positiveParam(params.get('genre')) : undefined;
  const year = getFilters ? positiveParam(params.get('year')) : undefined;

  function changeCatalog(nextQuery: string, nextPage: number, filters: CatalogFilters = { genre, year }, nextSource = sourceKey) {
    const next = new URLSearchParams();
    if (nextQuery) next.set('q', nextQuery);
    if (nextPage > 1) next.set('page', String(nextPage));
    if (filters.genre) next.set('genre', String(filters.genre));
    if (filters.year) next.set('year', String(filters.year));
    if (nextSource) next.set('source', nextSource);
    setParams(next);
  }

  function search(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get('q') ?? '').trim();
    changeCatalog(value, 1, getFilters ? {
      genre: form.has('genre') ? positiveParam(String(form.get('genre'))) : genre,
      year: form.has('year') ? positiveParam(String(form.get('year'))) : year,
    } : {});
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
          onChange={(event) => changeCatalog(query, 1, {}, event.currentTarget.value)}
        >
          {!source && <option value="" disabled>Выберите источник</option>}
          {sources.map(({ key, name }) => <option key={key} value={key}>{name}</option>)}
        </NativeSelect>
      )}
      <form role="search" aria-label="Поиск аниме" onSubmit={search} className={styles.search}>
        {source && getFilters && <CatalogFilterFields key={source.key} load={getFilters} genre={genre} year={year} />}
        <div className={styles.searchRow}>
          <TextInput key={query} type="search" name="q" label="Название аниме" defaultValue={query} placeholder="Например, Фрирен" />
          <Button type="submit">Найти</Button>
        </div>
        {(genre || year) && (
          <Button variant="subtle" size="compact-sm" w="fit-content" onClick={() => changeCatalog(query, 1, {})}>
            Сбросить фильтры
          </Button>
        )}
      </form>
      {source ? (
        <CatalogResults source={source} query={query} page={page} genre={genre} year={year} changePage={(next) => changeCatalog(query, next)} />
      ) : (
        <Alert color="red" title="Источник не найден">
          <Button variant="light" size="xs" onClick={() => changeCatalog(query, 1, {}, null)}>Открыть каталог {defaultSource.name}</Button>
        </Alert>
      )}
    </Stack>
  );
}

function CatalogFilterFields({ load, genre, year }: CatalogFilters & { load: NonNullable<AnimeSource['getCatalogFilters']> }) {
  const request = useSourceRequest(load);
  if (request.status === 'loading') return <Text size="sm" c="dimmed" role="status">Загружаем фильтры…</Text>;
  if (request.status === 'error') return <Text size="sm" c="dimmed" role="status">Не удалось загрузить фильтры.</Text>;
  const { genres, years } = request.data;
  return (
    <SimpleGrid cols={2} spacing="xs">
      <NativeSelect key={`genre:${genre ?? ''}`} name="genre" label="Жанр" defaultValue={genre ?? ''}>
        <option value="">Все жанры</option>
        {genre && !genres.some(({ id }) => id === genre) && <option value={genre}>Жанр недоступен</option>}
        {genres.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
      </NativeSelect>
      <NativeSelect key={`year:${year ?? ''}`} name="year" label="Год" defaultValue={year ?? ''}>
        <option value="">Все годы</option>
        {year && !years.includes(year) && <option value={year}>{year}</option>}
        {years.map((item) => <option key={item} value={item}>{item}</option>)}
      </NativeSelect>
    </SimpleGrid>
  );
}

function CatalogResults({ source, query, page, genre, year, changePage }: CatalogFilters & {
  source: AnimeSource;
  query: string;
  page: number;
  changePage: (page: number) => void;
}) {
  const load = useCallback((signal: AbortSignal) => source.getCatalog(query, page, signal, { genre, year }), [source, query, page, genre, year]);
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
            <Text role="status" c="dimmed">
              {query || genre || year ? 'Ничего не найдено. Измените запрос или фильтры.' : 'Каталог пуст.'}
            </Text>
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
