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
  ageRating?: string;
  publishStatus?: string;
  type?: string;
  season?: string;
  genres?: readonly string[];
  episodesTotal?: number;
  episodeDurationMinutes?: number;
}

export interface CatalogResult {
  items: readonly CatalogEntry[];
  page: number;
  totalPages: number;
  incomplete?: boolean;
}

export interface CatalogOption {
  value: string;
  label: string;
  description?: string;
}

export interface CatalogFilters {
  genres?: readonly number[];
  types?: readonly string[];
  publishStatuses?: readonly string[];
  sorting?: string;
  seasons?: readonly string[];
  yearFrom?: number;
  yearTo?: number;
  ageRatings?: readonly string[];
}

export interface CatalogFilterOptions {
  genres: readonly { id: number; name: string }[];
  types: readonly CatalogOption[];
  publishStatuses: readonly CatalogOption[];
  sorting: readonly CatalogOption[];
  seasons: readonly CatalogOption[];
  years: readonly number[];
  ageRatings: readonly CatalogOption[];
  incomplete?: boolean;
}

export function hasCatalogFilters(filters?: CatalogFilters): boolean {
  return Boolean(
    filters?.genres?.length || filters?.types?.length || filters?.publishStatuses?.length
    || filters?.sorting || filters?.seasons?.length || filters?.yearFrom || filters?.yearTo
    || filters?.ageRatings?.length,
  );
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
  /** Omitted when franchise data is unavailable; empty after a successful lookup with no matches. */
  franchises?: readonly Franchise[];
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
