export interface CatalogEntry {
  alias: string;
  name: string;
  alternateName?: string;
  poster?: string;
  year?: number;
}

export interface CatalogResult {
  items: readonly CatalogEntry[];
  page: number;
  totalPages: number;
}

export interface Episode {
  id: string;
  number: number;
  name?: string;
  preview?: string;
  streams: readonly { quality: number; url: string }[];
}

export interface AnimeTitle extends CatalogEntry {
  description?: string;
  episodes: readonly Episode[];
  restriction?: 'geo' | 'copyright' | 'unknown';
}

export interface AnimeSource {
  key: string;
  name: string;
  getCatalog(query: string, page: number, signal: AbortSignal): Promise<CatalogResult>;
  getTitle(alias: string, signal: AbortSignal): Promise<AnimeTitle | null>;
}
