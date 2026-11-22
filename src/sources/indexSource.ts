import type { AnimeSource, CatalogEntry } from './source.ts';

export type ReadIndexJson = (url: URL, signal: AbortSignal) => Promise<unknown>;

export interface IndexScan {
  pageSize: number;
  readPage(page: number, signal: AbortSignal): Promise<{
    page: number;
    total: number;
    totalPages: number;
    rawCount: number;
    items: readonly CatalogEntry[];
  }>;
  confirmEnd?(offset: number, total: number, signal: AbortSignal): Promise<boolean>;
}

export interface IndexedSource {
  source: AnimeSource;
  openIndex(readJson: ReadIndexJson): IndexScan;
}
