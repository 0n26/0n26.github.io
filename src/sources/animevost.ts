import type { AnimeSource, CatalogEntry, Episode } from './source';
import { positiveInteger, record, text } from './values';

const API = 'https://api.animetop.info/v1';
const PAGE_SIZE = 24;
const posters = ['animevost.org', 'static.openni.ru'];
const previews = ['media.animetop.info'];
const videos = ['video.animetop.info'];

function asset(value: unknown, hosts: readonly string[], path: RegExp): URL | undefined {
  if (typeof value !== 'string') return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port
    || !hosts.includes(url.hostname) || !path.test(url.pathname)) return;
  url.protocol = 'https:';
  return url;
}

function splitTitle(value: string | undefined): { name: string; alternateName?: string } {
  const title = text(value);
  if (!title) return { name: '' };
  const [russianPart, rest] = title.split(/\s*\/\s*/, 2);
  const name = text(russianPart) ?? title;
  const english = rest ? text(rest.replace(/\s*\[[\s\S]*$/, '')) : undefined;
  return { name, alternateName: english && english !== name ? english : undefined };
}

function catalogEntry(value: unknown): CatalogEntry | undefined {
  const row = record(value);
  const { name, alternateName } = splitTitle(text(row?.title));
  if (!positiveInteger(row?.id) || !name) return;
  const year = Number(row.year);
  return {
    alias: String(row.id), name, alternateName,
    poster: asset(row.urlImagePreview, posters, /^\/uploads\/posts\//)?.href,
    year: positiveInteger(year) ? year : undefined,
    id: positiveInteger(row?.id) ? row.id : undefined,
  };
}

function readPage(body: unknown) {
  const row = record(body);
  const state = record(row?.state);
  const data: unknown = row?.data;
  if (!state || !Array.isArray(data) || !(state.status === 'ok' || (state.status === 'fail' && !data.length))) {
    throw new Error('AnimeVost: invalid title list');
  }
  return { data: data as unknown[], count: state.count };
}

function episodes(body: unknown): Episode[] {
  if (!Array.isArray(body)) throw new Error('AnimeVost: invalid playlist');
  const items = new Map<string, Episode>();
  for (const [index, item] of body.entries()) {
    const row = record(item);
    const name = text(row?.name);
    if (!row || !name) continue;
    const hd = asset(row.hd, videos, /\.mp4$/i);
    const sd = asset(row.std, videos, /\.mp4$/i);
    const streams = [];
    if (hd) streams.push({ quality: 720, url: hd.href });
    if (sd && sd.href !== hd?.href) streams.push({ quality: 480, url: sd.href });
    const file = (hd ?? sd)?.pathname.split('/').pop();
    const id = file ? file.slice(0, -4) : name;
    const ordinal = /^(\d+(?:\.\d+)?)\s+серия$/i.exec(name);
    items.set(id, {
      id, number: ordinal ? Number(ordinal[1]) : index + 1, name: ordinal ? undefined : name,
      preview: asset(row.preview, previews, /^\/img\//)?.href, streams,
    });
  }
  return [...items.values()];
}

export function createAnimeVost(fetcher: typeof fetch = globalThis.fetch): AnimeSource {
  async function request(path: string, signal: AbortSignal, form?: Record<string, string>): Promise<unknown> {
    const res = await fetcher(`${API}/${path}`, {
      signal, credentials: 'omit', ...(form && { method: 'POST', body: new URLSearchParams(form) }),
    });
    if (res.status === 404 && (path === 'search' || path === 'info')) return null;
    if (!res.ok) throw new Error(`AnimeVost: HTTP ${res.status}`);
    return res.json();
  }

  return {
    key: 'animevost', name: 'AnimeVost',
    async getCatalog(query, page, signal) {
      const body = query ? await request('search', signal, { name: query })
        : await request(`last?page=${page}&quantity=${PAGE_SIZE}`, signal);
      if (query && body === null) return { items: [], page, totalPages: 1 };
      const { data, count } = readPage(body);
      // Search returns all matches and ignores page/quantity.
      const total = query ? data.length : count;
      if (typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) throw new Error('AnimeVost: invalid count');
      const rows = query ? data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : data;
      const items = new Map<string, CatalogEntry>();
      for (const row of rows) {
        const entry = catalogEntry(row);
        if (entry) items.set(entry.alias, entry);
      }
      return { items: [...items.values()], page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
    },
    async getTitle(alias, signal) {
      if (!/^[1-9]\d*$/.test(alias)) return null;
      const body = await request('info', signal, { id: alias });
      if (body === null) return null;
      const { data } = readPage(body);
      if (!data.length) return null;
      const row = record(data[0]);
      const entry = catalogEntry(row);
      if (!entry || entry.alias !== alias) throw new Error('AnimeVost: invalid title');
      return { ...entry, description: text(row?.description), episodes: episodes(await request('playlist', signal, { id: alias })) };
    },
  };
}
