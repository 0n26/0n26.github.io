import { ActionIcon, Alert, Button, Chip, Drawer, Group, Loader, MultiSelect, NumberInput, Pagination, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useSearchParams } from 'react-router';
import { catalog } from '../../catalog';
import { catalogSourceKey } from '../../catalog/titleRef';
import { hasCatalogFilters } from '../../sources/source';
import type { CatalogFilters, CatalogOption } from '../../sources/source';
import { MAX_GENRES, catalogParams, filterKey, parseCatalogFilters } from './catalogFilters';
import { ReleaseCard } from './ReleaseCard';
import { titleHref } from './titleLinks';
import { useSourceRequest } from './useSourceRequest';
import styles from './Catalog.module.css';

type MultiField = 'types' | 'publishStatuses' | 'seasons' | 'ageRatings';

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const page = positivePage(params.get('page'));
  const filtersKey = filterKey(params);
  const filters = useMemo(() => parseCatalogFilters(new URLSearchParams(filtersKey)), [filtersKey]);

  function changeCatalog(nextQuery: string, nextPage: number, nextFilters: CatalogFilters = filters) {
    setParams(catalogParams(nextQuery, nextPage, nextFilters));
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
        <CatalogFilterFields key={filtersKey} filters={filters}
          apply={(next) => changeCatalog(query, 1, next)} />
      </div>
      <CatalogResults query={query} page={page} filters={filters} changePage={(next) => changeCatalog(query, next)} />
    </Stack>
  );
}

function positivePage(value: string | null): number {
  const number = Number(value);
  return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(number) ? number : 1;
}

function CatalogFilterFields({ filters, apply }: {
  filters: CatalogFilters;
  apply: (filters: CatalogFilters) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<CatalogFilters>(filters);
  const request = useSourceRequest(catalog.getCatalogFilters);
  const options = request.status === 'ready' ? request.data : undefined;
  const genreNames = new Map<number, string>(options?.genres.map(({ id, name }) => [id, name] as const) ?? []);
  const optionNames = useMemo(() => ({
    types: new Map(options?.types.map(({ value, label }) => [value, label] as const) ?? []),
    publishStatuses: new Map(options?.publishStatuses.map(({ value, label }) => [value, label] as const) ?? []),
    sorting: new Map(options?.sorting.map(({ value, label }) => [value, label] as const) ?? []),
    seasons: new Map(options?.seasons.map(({ value, label }) => [value, label] as const) ?? []),
    ageRatings: new Map(options?.ageRatings.map(({ value, label }) => [value, label] as const) ?? []),
  }), [options]);
  const genreData = options?.genres.map(({ id, name }) => ({ value: String(id), label: name })) ?? [];
  for (const id of filters.genres ?? []) {
    if (!genreNames.has(id)) genreData.push({ value: String(id), label: `Жанр ${id}` });
  }

  function setValues(field: MultiField, values: readonly string[]) {
    setSelected((current) => ({ ...current, [field]: values.length ? values : undefined }));
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(selected);
    setOpened(false);
  }

  const activeChips: { key: string; label: string; remove: () => void }[] = [];
  for (const id of filters.genres ?? []) {
    activeChips.push({
      key: `genre:${id}`,
      label: genreNames.get(id) ?? `Жанр ${id}`,
      remove: () => apply({ ...filters, genres: filters.genres?.filter((item) => item !== id) }),
    });
  }
  for (const field of ['types', 'publishStatuses', 'seasons', 'ageRatings'] as const) {
    for (const value of filters[field] ?? []) {
      activeChips.push({
        key: `${field}:${value}`,
        label: optionNames[field].get(value) ?? value,
        remove: () => apply({ ...filters, [field]: filters[field]?.filter((item) => item !== value) }),
      });
    }
  }
  if (filters.sorting) {
    activeChips.push({
      key: 'sorting',
      label: optionNames.sorting.get(filters.sorting) ?? filters.sorting,
      remove: () => apply({ ...filters, sorting: undefined }),
    });
  }
  if (filters.yearFrom || filters.yearTo) {
    if (filters.yearFrom === filters.yearTo) {
      activeChips.push({
        key: 'year',
        label: String(filters.yearFrom),
        remove: () => apply({ ...filters, yearFrom: undefined, yearTo: undefined }),
      });
    } else {
      if (filters.yearFrom) activeChips.push({
        key: 'yearFrom',
        label: `От ${filters.yearFrom}`,
        remove: () => apply({ ...filters, yearFrom: undefined }),
      });
      if (filters.yearTo) activeChips.push({
        key: 'yearTo',
        label: `До ${filters.yearTo}`,
        remove: () => apply({ ...filters, yearTo: undefined }),
      });
    }
  }

  const years = options?.years ?? [];
  const minYear = years.length ? Math.min(...years) : undefined;
  const maxYear = years.length ? Math.max(...years) : undefined;

  return (
    <>
      <ActionIcon size={44} variant="default" aria-label="Фильтры" title="Фильтры" aria-haspopup="dialog"
        aria-expanded={opened} onClick={() => {
          setSelected(filters);
          setOpened(true);
        }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M2 7h5m6 0h9M2 17h11m6 0h3" /><circle cx="10" cy="7" r="3" /><circle cx="16" cy="17" r="3" />
        </svg>
      </ActionIcon>
      {activeChips.length > 0 && (
        <Group gap="xs" w="100%" aria-label="Выбранные фильтры" role="group">
          {activeChips.map(({ key, label, remove }) => (
            <Button key={key} variant="light" radius="xl" size="xs" aria-label={`Снять фильтр: ${label}`}
              onClick={remove}>{label} ×</Button>
          ))}
        </Group>
      )}
      <Drawer opened={opened} onClose={() => setOpened(false)} title="Фильтры" position="right" size="sm"
        closeButtonProps={{ 'aria-label': 'Закрыть фильтры' }}>
        {request.status === 'loading' && <Text role="status">Загружаем фильтры…</Text>}
        {request.status === 'error' && <Text role="alert">Не удалось загрузить фильтры.</Text>}
        {options?.incomplete && <Text role="status">Не удалось загрузить часть фильтров.</Text>}
        {opened && options && (
          <form onSubmit={submit}>
            <Stack gap="md">
              <MultiSelect
                label="Жанры"
                description="В выдаче будут тайтлы со всеми выбранными жанрами"
                placeholder="Все жанры"
                data={genreData}
                disabled={genreData.length === 0}
                value={(selected.genres ?? []).map(String)}
                onChange={(values) => setSelected((current) => ({
                  ...current, genres: values.length ? values.map(Number) : undefined,
                }))}
                searchable
                clearable
                maxValues={MAX_GENRES}
                nothingFoundMessage="Ничего не найдено"
              />
              <OptionChips label="Тип" description="Укажите типы релизов, по которым будут отфильтрованы все релизы"
                options={options.types} value={selected.types} onChange={(values) => setValues('types', values)} />
              <OptionChips label="Статус выхода"
                description="Укажите желаемые статусы выхода релиза, по которым будут отфильтрованы все тайтлы в каталоге"
                options={options.publishStatuses} value={selected.publishStatuses}
                onChange={(values) => setValues('publishStatuses', values)} />
              <Select label="Сортировка"
                description="Укажите способ сортировки для отображения всех тайтлов в каталоге"
                placeholder="По обновлению"
                data={options.sorting.map(({ value, label }) => ({ value, label }))}
                disabled={options.sorting.length === 0}
                value={selected.sorting ?? null}
                onChange={(value) => setSelected((current) => ({ ...current, sorting: value ?? undefined }))}
                searchable clearable nothingFoundMessage="Ничего не найдено" />
              <OptionChips label="Сезоны"
                description="Укажите желаемые сезоны выхода релизов, по которым будут отфильтрованы все тайтлы в каталоге"
                options={options.seasons} value={selected.seasons} onChange={(values) => setValues('seasons', values)} />
              <Stack gap="xs">
                <Text size="sm" fw={500} component="span">Период выхода</Text>
                <Text size="xs" c="dimmed" component="span">
                  Укажите года выхода релиза, по которым будут отфильтрованы все тайтлы в каталоге
                </Text>
                <Group grow gap="xs">
                  <NumberInput aria-label="Год выхода от" placeholder={String(minYear ?? 1995)} hideControls
                    allowNegative={false} decimalScale={0} min={minYear} max={maxYear}
                    value={selected.yearFrom ?? ''}
                    onChange={(value) => setSelected((current) => ({
                      ...current, yearFrom: typeof value === 'number' ? value : undefined,
                    }))} />
                  <NumberInput aria-label="Год выхода до" placeholder={String(maxYear ?? 2026)} hideControls
                    allowNegative={false} decimalScale={0} min={minYear} max={maxYear}
                    value={selected.yearTo ?? ''}
                    onChange={(value) => setSelected((current) => ({
                      ...current, yearTo: typeof value === 'number' ? value : undefined,
                    }))} />
                </Group>
              </Stack>
              <OptionChips label="Возрастной рейтинг"
                description="Укажите допустимый возрастной рейтинг релизов, по которым будут отфильтрованы все тайтлы"
                options={options.ageRatings} value={selected.ageRatings}
                onChange={(values) => setValues('ageRatings', values)} />
              <Button type="submit">Применить</Button>
            </Stack>
          </form>
        )}
      </Drawer>
    </>
  );
}

function OptionChips({ label, description, options, value, onChange }: {
  label: string;
  description: string;
  options: readonly CatalogOption[];
  value: readonly string[] | undefined;
  onChange: (value: readonly string[]) => void;
}) {
  if (options.length === 0) return null;
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500} component="span">{label}</Text>
      <Text size="xs" c="dimmed" component="span">{description}</Text>
      <Chip.Group multiple value={[...value ?? []]} onChange={onChange}>
        <Group gap="xs">
          {options.map((option) => (
            <Chip key={option.value} value={option.value} size="sm" radius="xl" title={option.description}>
              {option.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
    </Stack>
  );
}

function CatalogResults({ query, page, filters, changePage }: {
  query: string;
  page: number;
  filters: CatalogFilters;
  changePage: (page: number) => void;
}) {
  const load = useCallback((signal: AbortSignal) => catalog.getCatalog(query, page, signal, filters), [query, page, filters]);
  const request = useSourceRequest(load);

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
          {request.data.incomplete && (
            <Alert color="yellow" title="Неполная выдача">
              Не все источники ответили. Часть результатов может отсутствовать.
            </Alert>
          )}
          {request.data.page > request.data.totalPages ? (
            <Alert color="gray" title="Страница не найдена">
              <Button variant="light" size="xs" onClick={() => changePage(1)}>К первой странице</Button>
            </Alert>
          ) : request.data.items.length === 0 ? (
            <Text role="status" c="dimmed">
              {request.data.page > 1 ? 'На этой странице нет новых тайтлов.'
                : query || hasCatalogFilters(filters) ? 'Ничего не найдено. Измените запрос или фильтры.' : 'Каталог пуст.'}
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} spacing={{ base: 'sm', sm: 'md' }} verticalSpacing="lg">
              {request.data.items.map((entry) => (
                <ReleaseCard key={entry.alias} to={titleHref(catalogSourceKey, entry.alias)} entry={entry} />
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
