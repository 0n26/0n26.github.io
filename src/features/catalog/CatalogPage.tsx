import { ActionIcon, Alert, AspectRatio, Button, Drawer, Group, Image, Loader, NativeSelect, Pagination, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useCallback, useState } from 'react';
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
    changeCatalog(String(form.get('q') ?? '').trim(), 1);
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" gap="xs">
        <Title order={1}>Каталог</Title>
        {sources.length > 1 && (
          <NativeSelect aria-label="Источник" size="md" radius="xl" value={source?.key ?? ''}
            onChange={(event) => changeCatalog(query, 1, {}, event.currentTarget.value)}>
            {!source && <option value="" disabled>Выберите источник</option>}
            {sources.map(({ key, name }) => <option key={key} value={key}>{name}</option>)}
          </NativeSelect>
        )}
      </Group>
      <div className={styles.searchRow}>
        <form role="search" aria-label="Поиск аниме" onSubmit={search} className={styles.search}>
          <TextInput key={query} type="search" name="q" aria-label="Название аниме" defaultValue={query}
            placeholder="Название аниме" size="md" leftSectionWidth={44} leftSectionPointerEvents="auto"
            leftSection={<ActionIcon type="submit" size={44} variant="subtle" color="gray" aria-label="Найти">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6" />
              </svg>
            </ActionIcon>}
          />
        </form>
        {source && getFilters && (
          <CatalogFilterFields key={source.key} load={getFilters} genre={genre} year={year}
            apply={(filters) => changeCatalog(query, 1, filters)} />
        )}
      </div>
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

function CatalogFilterFields({ load, genre, year, apply }: CatalogFilters & {
  load: NonNullable<AnimeSource['getCatalogFilters']>;
  apply: (filters: CatalogFilters) => void;
}) {
  const [opened, setOpened] = useState(false);
  const request = useSourceRequest(load);
  const options = request.status === 'ready' ? request.data : undefined;
  const genreName = options?.genres.find(({ id }) => id === genre)?.name ?? `Жанр ${genre}`;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    apply({ genre: positiveParam(String(form.get('genre'))), year: positiveParam(String(form.get('year'))) });
    setOpened(false);
  }

  return (
    <>
      <ActionIcon size={44} variant="default" aria-label="Фильтры" title="Фильтры" aria-haspopup="dialog"
        aria-expanded={opened} onClick={() => setOpened(true)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M2 7h5m6 0h9M2 17h11m6 0h3" /><circle cx="10" cy="7" r="3" /><circle cx="16" cy="17" r="3" />
        </svg>
      </ActionIcon>
      {(genre || year) && (
        <Group gap="xs" w="100%" aria-label="Выбранные фильтры" role="group">
          {genre && <Button variant="light" radius="xl" size="xs" aria-label={`Снять фильтр: ${genreName}`}
            onClick={() => apply({ year })}>{genreName} ×</Button>}
          {year && <Button variant="light" radius="xl" size="xs" aria-label={`Снять фильтр: ${year}`}
            onClick={() => apply({ genre })}>{year} ×</Button>}
        </Group>
      )}
      <Drawer opened={opened} onClose={() => setOpened(false)} title="Фильтры" position="right" size="sm"
        closeButtonProps={{ 'aria-label': 'Закрыть фильтры' }}>
        {request.status === 'loading' && <Text role="status">Загружаем фильтры…</Text>}
        {request.status === 'error' && <Text role="alert">Не удалось загрузить фильтры.</Text>}
        {opened && options && (
          <form onSubmit={submit}>
            <Stack>
              <NativeSelect key={`genre:${genre ?? ''}`} name="genre" label="Жанр" defaultValue={genre ?? ''}>
                <option value="">Все жанры</option>
                {genre && !options.genres.some(({ id }) => id === genre) && <option value={genre}>Жанр недоступен</option>}
                {options.genres.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </NativeSelect>
              <NativeSelect key={`year:${year ?? ''}`} name="year" label="Год" defaultValue={year ?? ''}>
                <option value="">Все годы</option>
                {year && !options.years.includes(year) && <option value={year}>{year}</option>}
                {options.years.map((item) => <option key={item} value={item}>{item}</option>)}
              </NativeSelect>
              <Button type="submit">Применить</Button>
            </Stack>
          </form>
        )}
      </Drawer>
    </>
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
      <Title order={2} size="h3">{query ? 'Результаты поиска' : 'В каталоге'}</Title>
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
            <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} spacing={{ base: 'sm', sm: 'md' }} verticalSpacing="lg">
              {request.data.items.map((entry) => (
                <Link key={entry.alias} to={`${routePrefix}/${encodeURIComponent(entry.alias)}`} className={styles.card}>
                  <AspectRatio ratio={2 / 3} className={styles.poster}>
                    {entry.poster ? <Image src={entry.poster} alt="" loading="lazy" decoding="async" /> : <div className={styles.placeholder}>Нет постера</div>}
                  </AspectRatio>
                  <Text fw={650} lineClamp={2} className={styles.cardTitle}>{entry.name}</Text>
                  {entry.year && <Text size="sm" c="dimmed">{entry.year}</Text>}
                </Link>
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
