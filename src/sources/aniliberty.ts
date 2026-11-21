import type { AnimeSource, AnimeTitle, CatalogEntry, CatalogOption, Episode, Franchise, ScheduleEntry } from './source';
import { positiveInteger, record, text } from './values.ts';

const ORIGIN = 'https://anilibria.top';
const API = `${ORIGIN}/api/v1/anime`;
const QUALITY_LEVELS = [480, 720, 1080] as const;
const IMAGE_SIZES = ['preview', 'src', 'thumbnail'] as const;
const ALIAS = /^[a-z0-9_-]+$/i;
const RELEASE_TYPES = ['TV', 'ONA', 'WEB', 'OVA', 'OAD', 'MOVIE', 'DORAMA', 'SPECIAL'] as const;
const PUBLISH_STATUSES = ['IS_ONGOING', 'IS_NOT_ONGOING'] as const;
const SORTINGS = ['FRESH_AT_DESC', 'FRESH_AT_ASC', 'RATING_DESC', 'RATING_ASC', 'YEAR_DESC', 'YEAR_ASC'] as const;
const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
const AGE_RATINGS = ['R0_PLUS', 'R6_PLUS', 'R12_PLUS', 'R16_PLUS', 'R18_PLUS'] as const;

function knownValues<T extends string>(values: readonly string[] | undefined, allowed: readonly T[]): T[] {
  const valid = new Set<string>(allowed);
  const result: T[] = [];
  for (const value of values ?? []) {
    if (valid.has(value) && !result.includes(value as T)) result.push(value as T);
  }
  return result;
}

function optionsFrom(items: unknown[], allowed: readonly string[]): CatalogOption[] {
  const valid = new Set<string>(allowed);
  const options = new Map<string, CatalogOption>();
  for (const item of items) {
    const row = record(item);
    const value = text(row?.value);
    if (!value || !valid.has(value) || options.has(value)) continue;
    const description = text(row?.description);
    const label = text(row?.label) ?? description ?? value;
    options.set(value, { value, label, description: description === label ? undefined : description });
  }
  return [...options.values()];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function httpsUrl(value: unknown, allowRelative = false): string | undefined {
  const raw = text(value);
  if (!raw) return;
  const relative = allowRelative && raw.startsWith('/') && !raw.startsWith('//');
  if (!relative && !/^https:\/\//i.test(raw)) return;

  try {
    const url = relative ? new URL(raw, ORIGIN) : new URL(raw);
    if (url.protocol === 'https:' && !url.username && !url.password && (!relative || url.origin === ORIGIN)) {
      return url.href;
    }
  } catch {
    return;
  }
}

function imageUrl(value: unknown): string | undefined {
  const image = record(value);
  const optimized = record(image?.optimized);
  for (const size of IMAGE_SIZES) {
    const url = httpsUrl(optimized?.[size], true) ?? httpsUrl(image?.[size], true);
    if (url) return url;
  }
}

function catalogEntry(release: Record<string, unknown>): CatalogEntry | undefined {
  const alias = text(release.alias);
  if (!alias || !ALIAS.test(alias)) return;
  const names = record(release.name);
  const english = text(names?.english);
  const alternative = text(names?.alternative);
  const name = text(names?.main) ?? english ?? alternative ?? alias;
  const alternateName = english === name ? alternative : english ?? alternative;
  return {
    alias,
    name,
    alternateName: alternateName === name ? undefined : alternateName,
    poster: imageUrl(release.poster),
    year: positiveInteger(release.year) ? release.year : undefined,
    id: positiveInteger(release.id) ? release.id : undefined,
  };
}

function franchiseFrom(value: unknown): Franchise | undefined {
  const raw = record(value);
  const id = text(raw?.id);
  const name = text(raw?.name);
  if (!raw || !id || !name) return;
  const releases = (Array.isArray(raw.franchise_releases) ? raw.franchise_releases : [])
    .flatMap((item) => {
      const row = record(item);
      const release = record(row?.release);
      const entry = release && catalogEntry(release);
      return entry ? [{ ...entry, order: isFiniteNumber(row?.sort_order) ? row.sort_order : Number.MAX_SAFE_INTEGER }] : [];
    })
    .sort((a, b) => a.order - b.order);
  return releases.length > 0 ? { id, name, releases } : undefined;
}

function restrictionFor(release: Record<string, unknown>): AnimeTitle['restriction'] {
  if (release.is_blocked_by_copyrights === true) return 'copyright';
  if (release.is_blocked_by_geo === true) return 'geo';
  // Do not publish streams when the provider has not confirmed both permissions.
  if (release.is_blocked_by_copyrights !== false || release.is_blocked_by_geo !== false) return 'unknown';
}

function episodesFrom(items: unknown[], restricted: boolean): Episode[] {
  const episodes = new Map<string, { order: number; episode: Episode }>();
  for (const item of items) {
    const raw = record(item);
    if (!raw) continue;
    const id = text(raw.id);
    const number = raw.ordinal;
    if (!id || !isFiniteNumber(number) || episodes.has(id)) continue;

    const streams: { quality: number; url: string }[] = [];
    if (!restricted) {
      for (const quality of QUALITY_LEVELS) {
        const url = httpsUrl(raw[`hls_${quality}`]);
        if (url) streams.push({ quality, url });
      }
    }

    episodes.set(id, {
      order: isFiniteNumber(raw.sort_order) ? raw.sort_order : number,
      episode: { id, number, streams, name: text(raw.name) ?? text(raw.name_english), preview: imageUrl(raw.preview) },
    });
  }
  return [...episodes.values()].sort((a, b) => a.order - b.order).map(({ episode }) => episode);
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`AniLiberty: HTTP ${response.status}`);
  return response.json();
}

async function readList(response: Response): Promise<unknown[]> {
  const body = await readJson(response);
  const items = Array.isArray(body) ? body : record(body)?.data;
  if (!Array.isArray(items)) throw new Error('AniLiberty: invalid list response');
  return items;
}

export function createAniLiberty(fetcher: typeof fetch = globalThis.fetch): AnimeSource {
  return {
    key: 'aniliberty',
    name: 'AniLiberty',

    async getCatalog(query, page, signal, filters) {
      const url = new URL(`${API}/catalog/releases`);
      if (query) url.searchParams.set('f[search]', query);
      const genreIds = (filters?.genres ?? []).filter(positiveInteger);
      if (genreIds.length) url.searchParams.set('f[genres]', genreIds.join(','));
      const types = knownValues(filters?.types, RELEASE_TYPES);
      if (types.length) url.searchParams.set('f[types]', types.join(','));
      const publishStatuses = knownValues(filters?.publishStatuses, PUBLISH_STATUSES);
      if (publishStatuses.length) url.searchParams.set('f[publish_statuses]', publishStatuses.join(','));
      const sorting = knownValues(filters?.sorting ? [filters.sorting] : [], SORTINGS)[0];
      if (sorting) url.searchParams.set('f[sorting]', sorting);
      const seasons = knownValues(filters?.seasons, SEASONS);
      if (seasons.length) url.searchParams.set('f[seasons]', seasons.join(','));
      let yearFrom = positiveInteger(filters?.yearFrom) ? filters.yearFrom : undefined;
      let yearTo = positiveInteger(filters?.yearTo) ? filters.yearTo : undefined;
      if (yearFrom && yearTo && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
      if (yearFrom) url.searchParams.set('f[years][from_year]', String(yearFrom));
      if (yearTo) url.searchParams.set('f[years][to_year]', String(yearTo));
      const ageRatings = knownValues(filters?.ageRatings, AGE_RATINGS);
      if (ageRatings.length) url.searchParams.set('f[age_ratings]', ageRatings.join(','));
      url.searchParams.set('limit', '24');
      url.searchParams.set('page', String(page));

      const body = record(await readJson(await fetcher(url, { signal, credentials: 'omit' })));
      const pagination = record(record(body?.meta)?.pagination);
      if (!body || !pagination || !Array.isArray(body.data)
        || !positiveInteger(pagination.current_page) || !positiveInteger(pagination.total_pages)) {
        throw new Error('AniLiberty: invalid catalog response');
      }

      const items = new Map<string, CatalogEntry>();
      const releases: unknown[] = body.data;
      for (const item of releases) {
        const release = record(item);
        const entry = release && catalogEntry(release);
        if (entry) items.set(entry.alias, entry);
      }
      return { items: [...items.values()], page: pagination.current_page, totalPages: pagination.total_pages };
    },

    async getCatalogFilters(signal) {
      const fields = ['genres', 'years', 'types', 'publish-statuses', 'sorting', 'seasons', 'age-ratings'] as const;
      const [genres, years, types, publishStatuses, sorting, seasons, ageRatings] = await Promise.all(
        fields.map(async (field) =>
          readList(await fetcher(`${API}/catalog/references/${field}`, { signal, credentials: 'omit' })),
        ),
      );
      const names = new Map<number, string>();
      for (const item of genres) {
        const genre = record(item);
        const name = text(genre?.name);
        if (positiveInteger(genre?.id) && name) names.set(genre.id, name);
      }
      return {
        genres: [...names].map(([id, name]) => ({ id, name })),
        years: [...new Set(years.filter(positiveInteger))].sort((a, b) => b - a),
        types: optionsFrom(types, RELEASE_TYPES),
        publishStatuses: optionsFrom(publishStatuses, PUBLISH_STATUSES),
        sorting: optionsFrom(sorting, SORTINGS),
        seasons: optionsFrom(seasons, SEASONS),
        ageRatings: optionsFrom(ageRatings, AGE_RATINGS),
      };
    },

    async getSchedule(signal) {
      const items = await readList(await fetcher(`${API}/schedule/week`, { signal, credentials: 'omit' }));
      const entries = new Map<string, ScheduleEntry>();
      for (const item of items) {
        const row = record(item);
        const release = record(row?.release);
        const day = record(release?.publish_day)?.value;
        const entry = release && catalogEntry(release);
        if (!entry || !positiveInteger(day) || day > 7) continue;

        const seasonComplete = row?.full_season_is_released === true;
        const episode = record(row?.published_release_episode);
        const id = text(episode?.id);
        const number = episode?.ordinal;
        const next = row?.next_release_episode_number;
        entries.set(`${day}:${entry.alias}`, {
          day,
          alias: entry.alias,
          name: entry.name,
          poster: entry.poster,
          seasonComplete,
          publishedEpisode: id && isFiniteNumber(number) && number > 0 ? { id, number } : undefined,
          nextEpisodeNumber: !seasonComplete && positiveInteger(next) ? next : undefined,
        });
      }
      return [...entries.values()];
    },

    async getTitle(alias, signal) {
      if (!ALIAS.test(alias)) return null;
      const response = await fetcher(new URL(`${API}/releases/${alias}`), { signal, credentials: 'omit' });
      if (response.status === 404) return null;

      const release = record(await readJson(response));
      const entry = release && catalogEntry(release);
      if (!release || !entry || (release.episodes != null && !Array.isArray(release.episodes))) {
        throw new Error('AniLiberty: invalid release response');
      }
      const restriction = restrictionFor(release);
      return {
        ...entry,
        description: text(release.description),
        restriction,
        episodes: episodesFrom(release.episodes ?? [], restriction !== undefined),
      };
    },

    async getRelated(title, signal) {
      const alias = title.alias;
      if (!ALIAS.test(alias)) return { similar: [], franchises: [] };
      const id = positiveInteger(title.id) ? title.id : undefined;
      if (!id) return { similar: [], franchises: [] };

      const [similarResult, franchiseResult] = await Promise.allSettled([
        fetcher(`${API}/releases/recommended?release_id=${id}&limit=6`, { signal, credentials: 'omit' }).then(readList),
        fetcher(`${API}/franchises/release/${id}`, { signal, credentials: 'omit' }).then(readList),
      ]);

      const similar = new Map<string, CatalogEntry>();
      if (similarResult.status === 'fulfilled') {
        for (const item of similarResult.value) {
          const raw = record(item);
          const entry = raw && catalogEntry(raw);
          if (entry && entry.alias !== alias && !similar.has(entry.alias)) similar.set(entry.alias, entry);
        }
      }

      const franchises = new Map<string, Franchise>();
      if (franchiseResult.status === 'fulfilled') {
        for (const item of franchiseResult.value) {
          const franchise = franchiseFrom(item);
          if (franchise) franchises.set(franchise.id, franchise);
        }
      }

      if (similarResult.status === 'rejected' && franchiseResult.status === 'rejected') {
        throw similarResult.reason;
      }

      return { similar: [...similar.values()].slice(0, 6), franchises: [...franchises.values()] };
    },
  };
}
