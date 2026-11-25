import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { qualifyTitle } from '../src/catalog/titleRef.ts';
import { catalogIndexVersion, parseCatalogIndex } from '../src/sources/catalogIndex.ts';
import { indexedSources } from '../src/sources/index.ts';
import { positiveInteger } from '../src/sources/values.ts';
import { refreshCatalogAvailability } from './catalog-availability.mjs';
import { enrichShikimoriMetadata } from './shikimori-metadata.mjs';

const requestTimeout = 15_000;

// Matched by provider IDs where the release names, years, or episode boundaries disagree.
const curatedReleases = [
  [['aniliberty:ao-no-hako-2nd-season'], ['animevost:3996']],
  [['aniliberty:aoashi'], ['animevost:2780']],
  [['aniliberty:aoashi-season-2'], ['animevost:4010']],
  [['aniliberty:sakura-sou-no-pet-na-kanojo'], ['animevost:252']],
  // AniLiberty has both TV seasons (26 episodes); AnimeVost 143 has only the first (13).
  [['aniliberty:senyuu-istinno-geroyskiy-fayt']],
  [['aniliberty:fatestrange-fake'], ['animevost:3410']],
  [['aniliberty:jujutsu-kaisen-0-movie'], ['animevost:2879']],
  [['aniliberty:jujutsu-kaisen-season-2'], ['animevost:3014']],
  [['aniliberty:sword-art-online-ii'], ['animevost:854']],
  [['aniliberty:sword-art-online-movie-ordinal-scale'], ['animevost:1852']],
  [['aniliberty:dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-no-darou-ka-ii'], ['animevost:2285']],
  [['aniliberty:dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-no-darou-ka-iii'], ['animevost:2499']],
  [['aniliberty:dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-darou-ka-gaiden-sword-oratoria'], ['animevost:1856']],
  [
    ['aniliberty:sword-art-online-alicization', 1, 36],
    ['aniliberty:sword-art-online-alicization---war-of-underworld-part-2', 37, 11],
    ['animevost:1987', 1, 47],
  ],
  [
    ['aniliberty:dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-no-darou-ka-iv', 1, 11],
    ['aniliberty:dungeon-ni-deai-wo-motomeru-no-wa-machigatteiru-no-darou-ka-iv-part-2', 12, 11],
    ['animevost:2822', 1, 22],
  ],
];

async function readPage(url, fetcher, signal) {
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(requestTimeout);
    try {
      const response = await fetcher(url, { credentials: 'omit', signal: AbortSignal.any([signal, timeout]) });
      if (attempt === 0 && response.status >= 500) {
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt || signal.aborted || !(timeout.aborted || error instanceof TypeError)) throw error;
    }
  }
}

async function sweep({ source, openIndex }, readJson, signal) {
  const { pageSize, readPage, confirmEnd } = openIndex(readJson);
  if (!positiveInteger(pageSize)) throw new Error(`${source.key}: invalid index page size`);

  const entries = [];
  const aliases = new Set();
  const ids = new Set();
  let total, totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const label = `${source.key} page ${page}`;
    signal.throwIfAborted();
    let result;
    try {
      result = await readPage(page, signal);
    } catch (error) {
      throw new Error(`${label}: ${error instanceof SyntaxError ? 'invalid JSON' : error.message}`);
    }
    if (page === 1) {
      total = result.total;
      totalPages = result.totalPages;
    }
    const expectedCount = Math.min(pageSize, total - entries.length);
    if (!positiveInteger(total) || result.total !== total || Math.ceil(total / pageSize) !== totalPages
      || result.page !== page || result.totalPages !== totalPages
      || !Number.isInteger(result.rawCount) || result.rawCount > expectedCount || result.items.length !== result.rawCount) {
      throw new Error(`${label}: inconsistent pagination or incomplete rows`);
    }
    const shortPage = result.rawCount < expectedCount;
    if (shortPage && !(await confirmEnd?.(entries.length + result.rawCount, total, signal))) {
      throw new Error(`${label}: unexpectedly short page`);
    }
    for (const { alias, name, alternateName, searchName, year, poster, id, shikimoriId,
      ageRating, publishStatus, type, season, genres, episodesTotal, episodeDurationMinutes } of result.items) {
      if (aliases.has(alias) || (id !== undefined && ids.has(id))) throw new Error(`${label}: duplicate release`);
      aliases.add(alias);
      if (id !== undefined) ids.add(id);
      entries.push({
        alias: qualifyTitle(source.key, alias), name, alternateName, searchName, year, poster, shikimoriId,
        ageRating, publishStatus, type, season, genres, episodesTotal, episodeDurationMinutes,
      });
    }
    if (shortPage) break;
  }
  return entries;
}

function nameKeys({ year, name, alternateName }) {
  if (!year) return [];
  return [name, alternateName].flatMap((value) => {
    const normalized = value?.normalize('NFKC').toLowerCase().replace(/ё/g, 'е')
      .replace(/['’]/g, '').replace(/[\s\p{Pd}()[\]{}:;,.!?«»"“”]+/gu, ' ').trim();
    return normalized ? [`${year}:${normalized}`] : [];
  });
}

function indexNames(entries) {
  const index = new Map();
  for (const entry of entries) {
    for (const key of nameKeys(entry)) {
      const current = index.get(key);
      if (current !== entry) index.set(key, current === undefined ? entry : null);
    }
  }
  return index;
}

function uniqueMatch(entry, indexes, provider) {
  let match;
  const keys = nameKeys(entry);
  for (const [other, index] of indexes.entries()) {
    if (other === provider) continue;
    for (const key of keys) {
      const candidate = index.get(key);
      if (candidate === undefined) continue;
      if (candidate === null || (match && match.entry !== candidate)) return;
      match ??= { entry: candidate, provider: other };
    }
  }
  return match;
}

function groupReleases(catalogs) {
  const byAlias = new Map();
  for (const entries of catalogs) {
    for (const entry of entries) byAlias.set(entry.alias, entry);
  }
  const curated = new Map();
  for (const members of curatedReleases) {
    const group = members.map(([alias, first, count]) => {
      const entry = byAlias.get(alias);
      return entry && (first === undefined ? entry : { ...entry, episodeRange: { first, count } });
    });
    const complete = group.every(Boolean);
    for (const [alias] of members) curated.set(alias, complete ? group : null);
  }

  const indexes = catalogs.map(indexNames);
  const releases = [];
  const emitted = new Set();
  const maxLength = Math.max(...catalogs.map((entries) => entries.length));
  for (let position = 0; position < maxLength; position++) {
    for (let provider = 0; provider < catalogs.length; provider++) {
      const entry = catalogs[provider][position];
      if (!entry || emitted.has(entry.alias)) continue;
      const group = curated.get(entry.alias);
      if (group !== undefined) {
        releases.push(group ?? [entry]);
        if (group) {
          for (const member of group) emitted.add(member.alias);
        }
        continue;
      }
      const match = uniqueMatch(entry, indexes, provider);
      // The v2 snapshot allows pairs or manually verified split seasons, not automatic groups of 3+.
      if (match && !curated.has(match.entry.alias) && uniqueMatch(match.entry, indexes, match.provider)?.entry === entry) {
        releases.push([entry, match.entry]);
        emitted.add(match.entry.alias);
      } else {
        releases.push([entry]);
      }
    }
  }
  return releases;
}

async function createIndex(fetcher, sources, previous) {
  const controller = new AbortController();
  try {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(240_000)]);
    const readJson = (url, signal) => readPage(url, fetcher, signal);
    const catalogs = await Promise.all(sources.map((source) => sweep(source, readJson, signal)));
    const availability = await refreshCatalogAvailability(catalogs, {
      previous, sources: sources.map(({ source }) => source),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25 * 60_000)]),
      limit: catalogs.reduce((total, entries) => total + entries.length, 0),
    });
    if (catalogs.some(entries => entries.some(({ alias }) => typeof availability[alias]?.playable !== 'boolean'))) {
      throw new Error('Playback verification incomplete; keep the previous snapshot');
    }
    const groups = groupReleases(catalogs.map(entries => entries.filter(({ alias }) => availability[alias].playable)));
    if (!groups.length) throw new Error('No playable releases verified; keep the previous snapshot');
    const releases = await enrichShikimoriMetadata(groups, fetcher,
      AbortSignal.any([controller.signal, AbortSignal.timeout(12 * 60_000)]));
    const index = { version: catalogIndexVersion, generatedAt: Date.now(), releases, availability };
    if (!parseCatalogIndex(index)) throw new Error('invalid generated catalog index');
    return index;
  } finally {
    controller.abort();
  }
}

export async function publishCatalogIndex(output, fetcher = globalThis.fetch, sources = indexedSources, previous) {
  const index = await createIndex(fetcher, sources, previous);

  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(index), { flag: 'wx' });
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
}

if (import.meta.main) {
  const [, , output, previousPath] = process.argv;
  if (!output) throw new Error('Usage: node scripts/catalog-index.mjs <output> [previous-index.json]');
  const previous = previousPath ? (JSON.parse(await readFile(previousPath, 'utf8')).availability ?? {}) : undefined;
  await publishCatalogIndex(output, undefined, undefined, previous);
}
