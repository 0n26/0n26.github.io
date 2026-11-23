import { ActionIcon, Button, Chip, Drawer, Group, MultiSelect, NumberInput, Select, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { SubmitEvent } from 'react';
import type { CatalogFilterOptions, CatalogFilters, CatalogOption } from '../../sources/source';
import { MAX_GENRES } from './catalogFilters';
import type { SourceRequest } from './useSourceRequest';

export function CatalogFilterControls({ filters, request, apply }: {
  filters: CatalogFilters;
  request: SourceRequest<CatalogFilterOptions>;
  apply: (filters: CatalogFilters) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<CatalogFilters>(filters);
  const options = request.status === 'ready' ? request.data : undefined;
  const { genreNames, genreData } = useMemo(() => {
    const genreNames = new Map<number, string>(options?.genres.map(({ id, name }) => [id, name]) ?? []);
    const genreData = options?.genres.map(({ id, name }) => ({ value: String(id), label: name })) ?? [];
    for (const id of filters.genres ?? []) {
      if (!genreNames.has(id)) genreData.push({ value: String(id), label: `Жанр ${id}` });
    }
    return { genreNames, genreData };
  }, [filters.genres, options]);

  function setField<K extends keyof CatalogFilters>(field: K, value: CatalogFilters[K]) {
    setSelected((current) => ({ ...current, [field]: value }));
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
        label: options?.[field].find((option) => option.value === value)?.label ?? value,
        remove: () => apply({ ...filters, [field]: filters[field]?.filter((item) => item !== value) }),
      });
    }
  }
  if (filters.sorting) {
    activeChips.push({
      key: 'sorting',
      label: options?.sorting.find((option) => option.value === filters.sorting)?.label ?? filters.sorting,
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
                onChange={(values) => setField('genres', values.length ? values.map(Number) : undefined)}
                searchable
                clearable
                maxValues={MAX_GENRES}
                nothingFoundMessage="Ничего не найдено"
              />
              <OptionChips label="Тип" description="Укажите типы релизов, по которым будут отфильтрованы все релизы"
                options={options.types} value={selected.types} onChange={(values) => setField('types', values)} />
              <OptionChips label="Статус выхода"
                description="Укажите желаемые статусы выхода релиза, по которым будут отфильтрованы все тайтлы в каталоге"
                options={options.publishStatuses} value={selected.publishStatuses}
                onChange={(values) => setField('publishStatuses', values)} />
              <Select label="Сортировка"
                description="Укажите способ сортировки для отображения всех тайтлов в каталоге"
                placeholder="По обновлению"
                data={options.sorting.map(({ value, label }) => ({ value, label }))}
                disabled={options.sorting.length === 0}
                value={selected.sorting ?? null}
                onChange={(value) => setField('sorting', value ?? undefined)}
                searchable clearable nothingFoundMessage="Ничего не найдено" />
              <OptionChips label="Сезоны"
                description="Укажите желаемые сезоны выхода релизов, по которым будут отфильтрованы все тайтлы в каталоге"
                options={options.seasons} value={selected.seasons} onChange={(values) => setField('seasons', values)} />
              <Stack gap="xs">
                <Text size="sm" fw={500} component="span">Период выхода</Text>
                <Text size="xs" c="dimmed" component="span">
                  Укажите года выхода релиза, по которым будут отфильтрованы все тайтлы в каталоге
                </Text>
                <Group grow gap="xs">
                  <NumberInput aria-label="Год выхода от" placeholder={String(minYear ?? 1995)} hideControls
                    allowNegative={false} decimalScale={0} min={minYear} max={maxYear}
                    value={selected.yearFrom ?? ''}
                    onChange={(value) => setField('yearFrom', typeof value === 'number' ? value : undefined)} />
                  <NumberInput aria-label="Год выхода до" placeholder={String(maxYear ?? 2026)} hideControls
                    allowNegative={false} decimalScale={0} min={minYear} max={maxYear}
                    value={selected.yearTo ?? ''}
                    onChange={(value) => setField('yearTo', typeof value === 'number' ? value : undefined)} />
                </Group>
              </Stack>
              <OptionChips label="Возрастной рейтинг"
                description="Укажите допустимый возрастной рейтинг релизов, по которым будут отфильтрованы все тайтлы"
                options={options.ageRatings} value={selected.ageRatings}
                onChange={(values) => setField('ageRatings', values)} />
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
