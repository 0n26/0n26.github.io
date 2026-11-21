export interface EpisodeRange {
  first: number;
  count: number;
}

export interface VoiceOption {
  source: string;
  alias: string;
  episodeRange?: EpisodeRange;
}

export interface CatalogEntry {
  alias: string;
  name: string;
  alternateName?: string;
  searchName?: string;
  poster?: string;
  year?: number;
  id?: number;
}

export interface CatalogResult {
  items: readonly CatalogEntry[];
  page: number;
  totalPages: number;
  incomplete?: boolean;
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
  getVoices?(alias: string, signal: AbortSignal): Promise<readonly VoiceOption[]>;
  getRelated?(title: AnimeTitle, signal: AbortSignal): Promise<RelatedInfo>;
}
