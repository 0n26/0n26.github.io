import { setTimeout as delay } from 'node:timers/promises';
import { positiveInteger, record, text } from '../src/sources/values.ts';

const endpoint = 'https://shikimori.io/api/graphql';
const pageSize = 50;
const requestBudget = 900;
// Shikimori allows 5 requests per second and 90 per minute.
const requestInterval = 750;
const byIdsQuery = `query CatalogByIds($ids: String!) {
  animes(ids: $ids, limit: ${pageSize}) {
    id airedOn { year } poster { mainUrl } description genres { name russian }
    kind status rating season episodes duration
  }
}`;
const byYearQuery = `query CatalogByYear($season: SeasonString!, $page: PositiveInt!) {
  animes(season: $season, page: $page, limit: ${pageSize}, order: id, censored: false) {
    id airedOn { year } name russian english japanese synonyms
  }
}`;

const kinds = new Map(Object.entries({
  tv: 'ТВ', movie: 'Фильм', ova: 'OVA', ona: 'ONA', special: 'Спешл', tv_special: 'Спешл',
  music: 'Музыка', pv: 'PV', cm: 'CM',
}));
const statuses = new Map(Object.entries({ anons: 'Анонс', ongoing: 'Онгоинг', released: 'Завершён' }));
const ratings = new Map(Object.entries({ g: 'G', pg: 'PG', pg_13: 'PG-13', r: 'R-17', r_plus: 'R+', rx: 'Rx' }));
const seasons = new Map(Object.entries({ winter: 'Зима', spring: 'Весна', summer: 'Лето', fall: 'Осень', autumn: 'Осень' }));

export function normalizeShikimoriTitle(value) {
  return text(value)?.normalize('NFKC').toLowerCase().replace(/ё/g, 'е')
    .replace(/['’]/g, '').replace(/[\s\p{Pd}()[\]{}:;,.!?«»"“”]+/gu, ' ').trim();
}

function airingYear(value) {
  return positiveInteger(value) && value >= 1000 && value <= 9999 ? value : undefined;
}

function shikimoriId(value) {
  const id = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (!positiveInteger(id)) throw new Error('Shikimori: invalid anime ID');
  return id;
}

function posterUrl(value) {
  const raw = text(value);
  if (!raw || !/^https:\/\//i.test(raw)) return;
  try {
    const url = new URL(raw);
    if (!url.username && !url.password) return url.href;
  } catch {
    return undefined;
  }
}

function metadataFrom(row) {
  const genres = new Set();
  if (Array.isArray(row.genres)) {
    for (const value of row.genres) {
      const genre = record(value);
      const name = text(genre?.russian) ?? text(genre?.name);
      if (name) genres.add(name);
    }
  }
  return {
    year: airingYear(record(row.airedOn)?.year),
    poster: posterUrl(record(row.poster)?.mainUrl),
    description: text(row.description),
    genres: genres.size ? [...genres] : undefined,
    type: kinds.get(row.kind),
    publishStatus: statuses.get(row.status),
    ageRating: ratings.get(row.rating),
    season: seasons.get(/^(winter|spring|summer|fall|autumn)(?:_\d{4})?$/.exec(text(row.season) ?? '')?.[1]),
    episodesTotal: positiveInteger(row.episodes) ? row.episodes : undefined,
    episodeDurationMinutes: positiveInteger(row.duration) ? row.duration : undefined,
  };
}

function graphqlReader(fetcher, signal) {
  let requests = 0, nextRequest = 0;
  return async (query, variables) => {
    signal.throwIfAborted();
    if (++requests > requestBudget) throw new Error('Shikimori: catalog request budget exceeded');
    const wait = nextRequest - performance.now();
    if (wait > 0) await delay(wait, undefined, { signal });
    signal.throwIfAborted();
    nextRequest = performance.now() + requestInterval;
    const response = await fetcher(endpoint, {
      method: 'POST', credentials: 'omit', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': '0n26' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
    if (!response.ok) throw new Error(`Shikimori: HTTP ${response.status}`);
    const body = record(await response.json());
    if (body?.errors !== undefined && (!Array.isArray(body.errors) || body.errors.length > 0)) {
      throw new Error('Shikimori: GraphQL errors');
    }
    const animes = record(body?.data)?.animes;
    if (!Array.isArray(animes) || animes.length > pageSize) throw new Error('Shikimori: invalid anime list');
    return animes;
  };
}

async function loadByIds(ids, read, metadata) {
  const requested = [...ids];
  for (let offset = 0; offset < requested.length; offset += pageSize) {
    const batch = requested.slice(offset, offset + pageSize);
    const pending = new Set(batch);
    for (const row of await read(byIdsQuery, { ids: batch.join(',') })) {
      const id = shikimoriId(record(row)?.id);
      if (!pending.delete(id)) throw new Error('Shikimori: unexpected or duplicate anime ID');
      metadata.set(id, metadataFrom(row));
    }
  }
}

async function scanYear(year, names, read) {
  let lastId = 0;
  for (let page = 1; ; page++) {
    const rows = await read(byYearQuery, { season: String(year), page });
    for (const row of rows) {
      const id = shikimoriId(record(row)?.id);
      if (id <= lastId || record(row.airedOn)?.year !== year || !text(row.name)) {
        throw new Error('Shikimori: inconsistent airing-year results');
      }
      lastId = id;
      for (const name of [row.name, row.russian, row.english, row.japanese, ...(Array.isArray(row.synonyms) ? row.synonyms : [])]) {
        const key = normalizeShikimoriTitle(name);
        if (!names.has(key)) continue;
        const match = names.get(key);
        names.set(key, match === undefined || match === id ? id : null);
      }
    }
    if (rows.length < pageSize) return;
  }
}

function uniqueId(lookups, byYear) {
  let id;
  for (const [year, name] of lookups) {
    const match = byYear.get(year).get(name);
    if (match === null || (match !== undefined && id !== undefined && match !== id)) return;
    id ??= match;
  }
  return id;
}

function applyMetadata(entry, id, metadata) {
  return {
    ...entry,
    shikimoriId: id,
    year: entry.year ?? metadata.year,
    poster: metadata.poster ?? entry.poster,
    description: metadata.description ?? entry.description,
    genres: metadata.genres ?? entry.genres,
    type: entry.type ?? metadata.type,
    publishStatus: entry.publishStatus ?? metadata.publishStatus,
    ageRating: entry.ageRating ?? metadata.ageRating,
    season: entry.season ?? metadata.season,
    episodesTotal: entry.episodesTotal ?? (entry.episodeRange ? undefined : metadata.episodesTotal),
    episodeDurationMinutes: entry.episodeDurationMinutes ?? metadata.episodeDurationMinutes,
  };
}

export async function enrichShikimoriMetadata(releases, fetcher, signal) {
  const ids = new Set();
  const byYear = new Map();
  const targets = releases.map((release) => {
    const explicitIds = new Set(release.map(({ shikimoriId }) => shikimoriId).filter(positiveInteger));
    // Split seasons and disagreeing provider IDs must not share one metadata record.
    const groups = explicitIds.size > 1 || release.some((entry) => entry.episodeRange)
      ? release.map((entry) => [entry]) : [release];
    return groups.map((entries) => {
      const id = entries.find((entry) => positiveInteger(entry.shikimoriId))?.shikimoriId;
      const lookups = [];
      if (id !== undefined) {
        ids.add(id);
      } else {
        for (const entry of entries) {
          const year = airingYear(entry.year);
          if (!year) continue;
          for (const title of [entry.name, entry.alternateName, entry.searchName]) {
            const name = normalizeShikimoriTitle(title);
            if (!name) continue;
            if (!byYear.has(year)) byYear.set(year, new Map());
            byYear.get(year).set(name, undefined);
            lookups.push([year, name]);
          }
        }
      }
      return { entries, id, lookups };
    });
  });

  const read = graphqlReader(fetcher, signal);
  const metadata = new Map();
  await loadByIds(ids, read, metadata);
  // Scan only playback years, retaining just candidates that match a playback title and year.
  for (const [year, names] of byYear) await scanYear(year, names, read);

  const inferred = new Set();
  for (const groups of targets) {
    for (const target of groups) {
      if (target.id !== undefined) continue;
      target.id = uniqueId(target.lookups, byYear);
      if (target.id !== undefined && !metadata.has(target.id)) inferred.add(target.id);
    }
  }
  await loadByIds(inferred, read, metadata);

  return targets.map((groups) => groups.flatMap(({ id, entries }) => {
    const row = metadata.get(id);
    return row ? entries.map((entry) => applyMetadata(entry, id, row)) : entries;
  }));
}
