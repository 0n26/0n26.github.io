export interface VoiceOption {
  source: string;
  sourceKey?: string;
  alias: string;
  name?: string;
  label?: string;
  studio?: string;
  voice?: string;
}

export interface CatalogEntry {
  alias: string;
  name: string;
  alternateName?: string;
  poster?: string;
  year?: number;
  id?: number;
  variants?: readonly VoiceOption[];
  voices?: readonly VoiceOption[];
  dubs?: readonly VoiceOption[];
  studios?: readonly VoiceOption[];
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
  poster?: string;
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

export interface FranchiseRelease extends CatalogEntry {
  order: number;
}

export interface Franchise {
  id: string;
  name: string;
  releases: readonly FranchiseRelease[];
}

export interface RelatedInfo {
  similar: readonly CatalogEntry[];
  franchises: readonly Franchise[];
}

export interface AnimeSource {
  key: string;
  name: string;
  getCatalog(query: string, page: number, signal: AbortSignal, filters?: CatalogFilters): Promise<CatalogResult>;
  getCatalogFilters?(signal: AbortSignal): Promise<CatalogFilterOptions>;
  getSchedule?(signal: AbortSignal): Promise<readonly ScheduleEntry[]>;
  getTitle(alias: string, signal: AbortSignal): Promise<AnimeTitle | null>;
  getRelated?(title: AnimeTitle, signal: AbortSignal): Promise<RelatedInfo>;
}
