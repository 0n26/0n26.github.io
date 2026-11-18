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

export interface CatalogFilters {
  genre?: number;
  year?: number;
}

export interface CatalogFilterOptions {
  genres: readonly { id: number; name: string }[];
  years: readonly number[];
}

export interface ScheduleEntry {
  day: number;
  alias: string;
  name: string;
  seasonComplete: boolean;
  publishedEpisode?: { id: string; number: number };
  nextEpisodeNumber?: number;
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
  getCatalog(query: string, page: number, signal: AbortSignal, filters?: CatalogFilters): Promise<CatalogResult>;
  getCatalogFilters?(signal: AbortSignal): Promise<CatalogFilterOptions>;
  getSchedule?(signal: AbortSignal): Promise<readonly ScheduleEntry[]>;
  getTitle(alias: string, signal: AbortSignal): Promise<AnimeTitle | null>;
}
