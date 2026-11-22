import type { CatalogEntry } from './source.ts';

export function catalogEntries(rows: readonly unknown[], parse: (row: unknown) => CatalogEntry | undefined): CatalogEntry[] {
  const items = new Map<string, CatalogEntry>();
  for (const row of rows) {
    const entry = parse(row);
    if (entry) items.set(entry.alias, entry);
  }
  return [...items.values()];
}
