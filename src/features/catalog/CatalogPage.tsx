import { ActionIcon, Group, Stack, TextInput, Title } from '@mantine/core';
import type { SubmitEvent } from 'react';
import { hasCatalogFilters } from '../../sources/source';
import { CatalogFilterControls } from './CatalogFilterControls';
import { CatalogResults } from './CatalogResults';
import { useCatalogSearch } from './useCatalogSearch';
import styles from './Catalog.module.css';

export function CatalogPage() {
  const search = useCatalogSearch();

  function submitSearch(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    search.search(String(form.get('q') ?? ''));
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" gap="xs">
        <Title order={1}>Каталог</Title>
      </Group>
      <div className={styles.searchRow}>
        <form role="search" aria-label="Поиск аниме" onSubmit={submitSearch} className={styles.search}>
          <TextInput key={search.query} type="search" name="q" aria-label="Название аниме" defaultValue={search.query}
            placeholder="Название аниме" size="md" leftSectionWidth={44} leftSectionPointerEvents="auto"
            leftSection={<ActionIcon type="submit" size={44} variant="subtle" color="gray" aria-label="Найти">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6" />
              </svg>
            </ActionIcon>}
          />
        </form>
        <CatalogFilterControls key={search.filtersKey} filters={search.filters}
          request={search.references} apply={search.applyFilters} />
      </div>
      <CatalogResults query={search.query} filtered={hasCatalogFilters(search.filters)}
        request={search.results} changePage={search.changePage} />
    </Stack>
  );
}
