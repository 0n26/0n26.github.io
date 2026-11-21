import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createAniLiberty } from '../src/sources/aniliberty.ts';
import { createAnimeVost } from '../src/sources/animevost.ts';
import { parseCatalogIndex } from '../src/sources/catalogIndex.ts';
import { positiveInteger } from '../src/sources/values.ts';

const pageSize = 24;
const requestTimeout = 15_000;
const hour = 60 * 60 * 1000;
const providers = {
  aniliberty: {
    create: createAniLiberty,
    total(body) {
      const pagination = body?.meta?.pagination;
      if (pagination?.per_page === pageSize && pagination.count === body.data?.length) return pagination.total;
    },
  },
  animevost: {
    create: createAnimeVost,
    total: (body, page) => body?.state?.page === page
      && (body.state.status === 'ok' || (body.state.status === 'fail' && body.data?.length === 0))
      ? body.state.count : undefined,
    async atEnd(url, offset, total, fetcher, signal) {
      // The API count can include entries absent from the public list. Check the first missing offset.
      url.searchParams.set('quantity', '1');
      const page = offset + 1;
      url.searchParams.set('page', String(page));
      const { body } = await readPage(url, fetcher, signal);
      return body?.state?.status === 'fail' && body.state.page === page
        && body.state.count === total && Array.isArray(body.data) && body.data.length === 0;
    },
  },
};

async function readPage(url, fetcher, signal) {
  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(requestTimeout);
    try {
      const response = await fetcher(url, { credentials: 'omit', signal: AbortSignal.any([signal, timeout]) });
      if (attempt === 0 && response.status >= 500) {
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) return { response };
      const body = await response.json();
      response.json = async () => body;
      return { response, body };
    } catch (error) {
      if (attempt || signal.aborted || !(timeout.aborted || error instanceof TypeError)) throw error;
    }
  }
}

async function sweep(provider, fetcher, signal) {
  let rawCount, rawTotal, rawUrl;
  // The browse adapters discard malformed and duplicate rows; compare their output with the raw pagination.
  const source = provider.create(async (url) => {
    rawUrl = new URL(url);
    const { response, body } = await readPage(url, fetcher, signal);
    rawCount = Array.isArray(body?.data) ? body.data.length : undefined;
    rawTotal = provider.total(body, Number(rawUrl.searchParams.get('page')));
    return response;
  });

  const entries = [];
  const aliases = new Set();
  const ids = new Set();
  let total, totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const label = `${source.key} page ${page}`;
    rawCount = rawTotal = rawUrl = undefined;
    let result;
    try {
      result = await source.getCatalog('', page, signal);
    } catch (error) {
      throw new Error(`${label}: ${error instanceof SyntaxError ? 'invalid JSON' : error.message}`);
    }
    if (page === 1) {
      total = rawTotal;
      totalPages = result.totalPages;
    }
    const expectedCount = Math.min(pageSize, total - entries.length);
    if (!positiveInteger(total) || rawTotal !== total || Math.ceil(total / pageSize) !== totalPages
      || result.page !== page || result.totalPages !== totalPages || result.incomplete
      || !Number.isInteger(rawCount) || rawCount > expectedCount || result.items.length !== rawCount) {
      throw new Error(`${label}: inconsistent pagination or incomplete rows`);
    }
    const shortPage = rawCount < expectedCount;
    if (shortPage && !(await provider.atEnd?.(rawUrl, entries.length + rawCount, total, fetcher, signal))) {
      throw new Error(`${label}: unexpectedly short page`);
    }
    for (const { alias, name, alternateName, year, poster, id } of result.items) {
      if (aliases.has(alias) || (id !== undefined && ids.has(id))) throw new Error(`${label}: duplicate release`);
      aliases.add(alias);
      if (id !== undefined) ids.add(id);
      entries.push({ alias: `${source.key}:${alias}`, name, alternateName, year, poster });
    }
    if (shortPage) break;
  }
  return entries;
}

function nameKeys({ year, name, alternateName }) {
  if (!year) return [];
  return [name, alternateName].flatMap((value) => {
    const normalized = value?.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
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

function uniqueMatch(entry, index) {
  let match;
  for (const key of nameKeys(entry)) {
    const candidate = index.get(key);
    if (candidate === undefined) continue;
    if (candidate === null || (match && match !== candidate)) return;
    match = candidate;
  }
  return match;
}

function groupReleases(catalogs) {
  const indexes = catalogs.map(indexNames);
  const releases = [];
  const emitted = new Set();
  const maxLength = Math.max(...catalogs.map((entries) => entries.length));
  for (let position = 0; position < maxLength; position++) {
    for (let provider = 0; provider < catalogs.length; provider++) {
      const entry = catalogs[provider][position];
      if (!entry || emitted.has(entry)) continue;
      const match = uniqueMatch(entry, indexes[1 - provider]);
      const group = [entry];
      if (match && uniqueMatch(match, indexes[provider]) === entry) {
        group.push(match);
        emitted.add(match);
      }
      releases.push(group);
    }
  }
  return releases;
}

async function createIndex(fetcher) {
  const controller = new AbortController();
  try {
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(240_000)]);
    const catalogs = await Promise.all(Object.values(providers).map((provider) => sweep(provider, fetcher, signal)));
    return { version: 1, generatedAt: Date.now(), releases: groupReleases(catalogs) };
  } finally {
    controller.abort();
  }
}

async function readPrevious(url, fetcher) {
  if (!url) return;
  try {
    const response = await fetcher(url, {
      cache: 'no-cache', credentials: 'omit', signal: AbortSignal.timeout(requestTimeout),
    });
    if (!response.ok) return;
    const index = parseCatalogIndex(await response.json());
    if (!index) return;
    const seen = new Set();
    for (const release of index.releases) {
      for (const { alias } of release) {
        const provider = alias.split(':', 1)[0];
        if (!Object.hasOwn(providers, provider)) return;
        seen.add(provider);
      }
    }
    if (seen.size === Object.keys(providers).length) {
      return { version: 1, generatedAt: index.generatedAt, releases: index.releases };
    }
  } catch {
    // Missing or unreadable history does not prevent a full fresh scan.
  }
}

export async function publishCatalogIndex(output, previousUrl, fetcher = globalThis.fetch) {
  const previous = await readPrevious(previousUrl, fetcher);
  let index = previous;
  if (!index || Date.now() - index.generatedAt >= 20 * hour) {
    try {
      index = await createIndex(fetcher);
    } catch (error) {
      if (!previous || Date.now() - previous.generatedAt >= 7 * 24 * hour) {
        await rm(output, { force: true });
        console.warn(`::warning::Catalog index sweep failed (${error.message}); publishing without an index.`);
        return;
      }
      console.warn(`::warning::Catalog index sweep failed (${error.message}); keeping the previous complete index.`);
    }
  }

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
  const [, , output, previousUrl] = process.argv;
  if (!output) throw new Error('Usage: node scripts/catalog-index.mjs <output> [previous-index-url]');
  await publishCatalogIndex(output, previousUrl);
}
