import { positiveInteger, record, text } from '../../sources/values';
import { getDemoOverview, getDemoProfile } from './demoRepository';
import type { Album, CommunityOverview, UserProfile } from './types';

/**
 * Граница будущего backend. UI зависит только от этого контракта:
 * достаточно подменить `communityRepository` реализацией API — страницы не меняются.
 */
export interface CommunityRepository {
  getProfile(handle: string, signal: AbortSignal): Promise<UserProfile | null>;
  getOverview(signal: AbortSignal): Promise<CommunityOverview>;
  /** Необязательно: запись альбомов в backend. Пока достаточен localStorage. */
  saveAlbums?(handle: string, albums: readonly Album[], signal: AbortSignal): Promise<void>;
}

function aborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

export function createDemoCommunityRepository(): CommunityRepository {
  const savedAlbums = new Map<string, readonly Album[]>();
  return {
    async getProfile(handle, signal) {
      if (aborted(signal)) return null;
      const profile = getDemoProfile(handle);
      const albums = savedAlbums.get(handle);
      return albums && profile ? { ...profile, albums } : profile;
    },
    async getOverview(signal) {
      if (aborted(signal)) throw new DOMException('Aborted', 'AbortError');
      return getDemoOverview();
    },
    async saveAlbums(handle, albums, signal) {
      if (aborted(signal)) return;
      savedAlbums.set(handle, albums);
    },
  };
}

function asTuple(value: unknown, fallback: readonly [string, string]): readonly [string, string] {
  if (!Array.isArray(value) || value.length < 2) return fallback;
  const from = text(value[0]);
  const to = text(value[1]);
  return from && to ? [from, to] : fallback;
}

function asArray<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? value as readonly T[] : [];
}

/** Проверка ответа backend до передачи данных в UI. */
export function parseUserProfile(value: unknown): UserProfile | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const handle = text(data.handle);
  const name = text(data.name);
  if (!id || !handle || !name || !positiveInteger(data.level)) return null;

  const stats = record(data.stats) ?? {};
  return {
    id,
    handle,
    name,
    presence: ['online', 'away', 'busy', 'offline'].includes(String(data.presence)) ? data.presence as UserProfile['presence'] : 'offline',
    status: text(data.status) ?? '',
    country: text(data.country) ?? '',
    joinedAt: text(data.joinedAt) ?? '',
    bio: text(data.bio) ?? '',
    level: data.level,
    xp: positiveInteger(data.xp) ? data.xp : 0,
    xpToNext: positiveInteger(data.xpToNext) ? data.xpToNext : 1,
    banner: asTuple(data.banner, ['#123b57', '#6b3a8c']),
    avatar: asTuple(data.avatar, ['#f6b64d', '#e05f85']),
    avatarIcon: text(data.avatarIcon) ?? '👤',
    avatarImage: text(data.avatarImage),
    bannerImage: text(data.bannerImage),
    stats: {
      episodes: positiveInteger(stats.episodes) ? stats.episodes : 0,
      watchHours: positiveInteger(stats.watchHours) ? stats.watchHours : 0,
      titles: positiveInteger(stats.titles) ? stats.titles : 0,
      reviews: positiveInteger(stats.reviews) ? stats.reviews : 0,
      friends: positiveInteger(stats.friends) ? stats.friends : 0,
      reputation: positiveInteger(stats.reputation) ? stats.reputation : 0,
    },
    badges: asArray<UserProfile['badges'][number]>(data.badges),
    favorites: asArray<UserProfile['favorites'][number]>(data.favorites),
    friends: asArray<UserProfile['friends'][number]>(data.friends),
    groups: asArray<UserProfile['groups'][number]>(data.groups),
    activity: asArray<UserProfile['activity'][number]>(data.activity),
    inventory: asArray<UserProfile['inventory'][number]>(data.inventory),
    history: asArray<UserProfile['history'][number]>(data.history),
    cards: asArray<UserProfile['cards'][number]>(data.cards),
    albums: asArray<UserProfile['albums'][number]>(data.albums),
  };
}

export function parseCommunityOverview(value: unknown): CommunityOverview | null {
  const data = record(value);
  if (!data) return null;
  return {
    online: positiveInteger(data.online) ? data.online : 0,
    members: positiveInteger(data.members) ? data.members : 0,
    discussionsToday: positiveInteger(data.discussionsToday) ? data.discussionsToday : 0,
    events: asArray<CommunityOverview['events'][number]>(data.events),
    discussions: asArray<CommunityOverview['discussions'][number]>(data.discussions),
    topProfiles: asArray<CommunityOverview['topProfiles'][number]>(data.topProfiles),
  };
}

/** Пример адаптера: GET {baseUrl}/profiles/:handle и GET {baseUrl}/overview. */
export function createHttpCommunityRepository(baseUrl: string, fetcher: typeof fetch = globalThis.fetch): CommunityRepository {
  const root = baseUrl.replace(/\/$/, '');
  async function json(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await fetcher(`${root}${path}`, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Community API: ${response.status}`);
    return response.json();
  }
  return {
    async getProfile(handle, signal) {
      return parseUserProfile(await json(`/profiles/${encodeURIComponent(handle)}`, signal));
    },
    async getOverview(signal) {
      const parsed = parseCommunityOverview(await json('/overview', signal));
      if (!parsed) throw new Error('Community API: некорректный ответ');
      return parsed;
    },
    async saveAlbums(handle, albums, signal) {
      const response = await fetcher(`${root}/profiles/${encodeURIComponent(handle)}/albums`, {
        method: 'PUT',
        signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ albums }),
      });
      if (!response.ok) throw new Error(`Community API: ${response.status}`);
    },
  };
}

export const communityRepository: CommunityRepository = createDemoCommunityRepository();
