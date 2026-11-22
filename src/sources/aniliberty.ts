import { catalogEntries } from './catalogEntries.ts';
import { catalogFilterValues, normalizeCatalogYears } from './catalogFilterValues.ts';
import type { IndexScan, ReadIndexJson } from './indexSource.ts';
import type { AnimeSource, AnimeTitle, CatalogEntry, CatalogOption, Episode, Franchise, ScheduleEntry } from './source';
import { positiveInteger, record, text, titleText } from './values.ts';

const ORIGIN = 'https://anilibria.top';
const API = `${ORIGIN}/api/v1/anime`;
const PAGE_SIZE = 24;
const QUALITY_LEVELS = [480, 720, 1080] as const;
const IMAGE_SIZES = ['preview', 'src', 'thumbnail'] as const;
const ALIAS = /^[a-z0-9_-]+$/i;
const TYPE_NAMES: Readonly<Record<string, string>> = {
  tv: 'ТВ',
  ona: 'ONA',
  web: 'WEB',
  ova: 'OVA',
  oad: 'OAD',
  movie: 'Фильм',
  dorama: 'Дорама',
  special: 'Спешл',
};
const SEASON_NAMES: Readonly<Record<string, string>> = {
  winter: 'Зима',
  spring: 'Весна',
  summer: 'Лето',
  autumn: 'Осень',
  fall: 'Осень',
};

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

function localized(value: unknown, names: Readonly<Record<string, string>>): string | undefined {
  const row = record(value);
  const label = text(row?.description) ?? text(row?.name);
  if (label) return label;
  const raw = text(row?.value) ?? text(value);
  if (!raw) return;
  const key = raw.toLowerCase();
  return Object.hasOwn(names, key) ? names[key] : raw;
}

function genresFrom(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return;
  const genres: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const name = text(record(item)?.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    genres.push(name);
  }
  return genres.length > 0 ? genres : undefined;
}

function ageRatingFrom(value: unknown): string | undefined {
  const row = record(value);
  const label = text(row?.label) ?? text(row?.description) ?? text(value);
  if (label && /^\d+\+$/.test(label)) return label;
  const age = /^R(0|6|12|16|18)_PLUS$/i.exec(text(row?.value) ?? text(value) ?? '')?.[1];
  if (age) return `${age}+`;
}

function publishStatusFrom(release: Record<string, unknown>): string | undefined {
  const status = release.publish_status;
  const code = (text(record(status)?.value) ?? text(status))?.toUpperCase();
  const ongoing = code === 'IS_ONGOING' ? true
    : code === 'IS_NOT_ONGOING' ? false
      : release.is_ongoing;
  if (typeof ongoing === 'boolean') return ongoing ? 'Онгоинг' : 'Завершён';
}

function catalogEntry(release: Record<string, unknown>): CatalogEntry | undefined {
  const alias = text(release.alias);
  if (!alias || !ALIAS.test(alias)) return;
  const names = record(release.name);
  const english = titleText(names?.english);
  const alternative = titleText(names?.alternative);
  const name = titleText(names?.main) ?? english ?? alternative ?? alias;
  const alternateName = english === name ? alternative : english ?? alternative;
  return {
    alias,
    name,
    alternateName: alternateName === name ? undefined : alternateName,
    searchName: alternative !== name && alternative !== alternateName ? alternative : undefined,
    poster: imageUrl(release.poster),
    year: positiveInteger(release.year) ? release.year : undefined,
    id: positiveInteger(release.id) ? release.id : undefined,
    ageRating: ageRatingFrom(release.age_rating),
    publishStatus: publishStatusFrom(release),
    type: localized(release.type, TYPE_NAMES),
    season: localized(release.season, SEASON_NAMES),
    genres: genresFrom(release.genres),
    episodesTotal: positiveInteger(release.episodes_total) ? release.episodes_total : undefined,
    episodeDurationMinutes: positiveInteger(release.average_duration_of_episode)
      ? release.average_duration_of_episode : undefined,
  };
}

function catalogUrl(page: number): URL {
  const url = new URL(`${API}/catalog/releases`);
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));
  return url;
}

function readCatalogPage(value: unknown) {
  const body = record(value);
  const pagination = record(record(body?.meta)?.pagination);
  if (!body || !pagination || !Array.isArray(body.data)
    || !positiveInteger(pagination.current_page) || !positiveInteger(pagination.total_pages)) {
    throw new Error('AniLiberty: invalid catalog response');
  }
  const data: unknown[] = body.data;
  return {
    pagination,
    page: pagination.current_page,
    totalPages: pagination.total_pages,
    rawCount: data.length,
    items: catalogEntries(data, (row) => {
      const release = record(row);
      return release && catalogEntry(release);
    }),
  };
}

export function openAniLibertyIndex(readJson: ReadIndexJson): IndexScan {
  return {
    pageSize: PAGE_SIZE,
    async readPage(page, signal) {
      const { pagination, ...result } = readCatalogPage(await readJson(catalogUrl(page), signal));
      if (pagination.per_page !== PAGE_SIZE || pagination.count !== result.rawCount || !positiveInteger(pagination.total)) {
        throw new Error('AniLiberty: inconsistent pagination');
      }
      return { ...result, total: pagination.total };
    },
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

function knownValues(values: readonly string[] | undefined, allowed: Readonly<Record<string, true>>): string[] {
  return [...new Set(values?.filter((value) => Object.hasOwn(allowed, value)))];
}

function optionsFrom(items: unknown[], allowed: Readonly<Record<string, true>>): CatalogOption[] {
  const options = new Map<string, CatalogOption>();
  for (const item of items) {
    const row = record(item);
    const value = text(row?.value);
    if (!value || !Object.hasOwn(allowed, value) || options.has(value)) continue;
    const description = text(row?.description);
    const label = text(row?.label) ?? description ?? value;
    options.set(value, { value, label, description: description === label ? undefined : description });
  }
  return [...options.values()];
}

export function createAniLiberty(fetcher: typeof fetch = globalThis.fetch): AnimeSource {
  return {
    key: 'aniliberty',
    name: 'AniLiberty',

    async getCatalog(query, page, signal, filters) {
      const url = catalogUrl(page);
      if (query) url.searchParams.set('f[search]', query);
      const genreIds = (filters?.genres ?? []).filter(positiveInteger);
      if (genreIds.length) url.searchParams.set('f[genres]', genreIds.join(','));
      const types = knownValues(filters?.types, catalogFilterValues.types);
      if (types.length) url.searchParams.set('f[types]', types.join(','));
      const publishStatuses = knownValues(filters?.publishStatuses, catalogFilterValues.publishStatuses);
      if (publishStatuses.length) url.searchParams.set('f[publish_statuses]', publishStatuses.join(','));
      const sorting = filters?.sorting;
      if (sorting && Object.hasOwn(catalogFilterValues.sorting, sorting)) url.searchParams.set('f[sorting]', sorting);
      const seasons = knownValues(filters?.seasons, catalogFilterValues.seasons);
      if (seasons.length) url.searchParams.set('f[seasons]', seasons.join(','));
      const { yearFrom, yearTo } = normalizeCatalogYears(filters?.yearFrom, filters?.yearTo);
      if (yearFrom) url.searchParams.set('f[years][from_year]', String(yearFrom));
      if (yearTo) url.searchParams.set('f[years][to_year]', String(yearTo));
      const ageRatings = knownValues(filters?.ageRatings, catalogFilterValues.ageRatings);
      if (ageRatings.length) url.searchParams.set('f[age_ratings]', ageRatings.join(','));
      const result = readCatalogPage(await readJson(await fetcher(url, { signal, credentials: 'omit' })));
      return { items: result.items, page: result.page, totalPages: result.totalPages };
    },

    async getCatalogFilters(signal) {
      const fields = ['genres', 'years', 'types', 'publish-statuses', 'sorting', 'seasons', 'age-ratings'] as const;
      const results = await Promise.allSettled(
        fields.map(async (field) =>
          readList(await fetcher(`${API}/catalog/references/${field}`, { signal, credentials: 'omit' })),
        ),
      );
      signal.throwIfAborted();
      const failure = results.find((result) => result.status === 'rejected');
      if (failure && results.every((result) => result.status === 'rejected')) throw failure.reason;
      const [genres, years, types, publishStatuses, sorting, seasons, ageRatings] = results.map(
        (result) => result.status === 'fulfilled' ? result.value : [],
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
        types: optionsFrom(types, catalogFilterValues.types),
        publishStatuses: optionsFrom(publishStatuses, catalogFilterValues.publishStatuses),
        sorting: optionsFrom(sorting, catalogFilterValues.sorting),
        seasons: optionsFrom(seasons, catalogFilterValues.seasons),
        ageRatings: optionsFrom(ageRatings, catalogFilterValues.ageRatings),
        incomplete: failure ? true : undefined,
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
      const { alias, id } = title;
      if (!ALIAS.test(alias) || !positiveInteger(id)) return { similar: [] };

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

      let franchises: Franchise[] | undefined;
      if (franchiseResult.status === 'fulfilled') {
        const byId = new Map<string, Franchise>();
        for (const item of franchiseResult.value) {
          const franchise = franchiseFrom(item);
          if (franchise) byId.set(franchise.id, franchise);
        }
        franchises = [...byId.values()];
      }

      if (similarResult.status === 'rejected' && franchiseResult.status === 'rejected') {
        throw similarResult.reason;
      }

      return { similar: [...similar.values()].slice(0, 6), franchises };
    },
  };
}
