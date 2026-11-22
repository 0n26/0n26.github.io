import { positiveInteger, record, text } from '../../sources/values';
import { cardCatalog, demoShopCatalog, getDemoOverview, getDemoProfile } from './demoRepository';
import { defaultCardFlags, frameTitles, potentials, rankOrder, slotTitles } from './logic';
import type {
  Album, CardFlags, CardFrame, CardSet, CollectionState, CommunityOverview, Currency, EquipSlot,
  InventoryItem, Rank, ShopCatalog, UserProfile, WatchCard,
} from './types';

/**
 * Граница будущего backend. UI зависит только от этого контракта:
 * подмена `communityRepository` API-адаптером не меняет страницы и механику.
 */
export interface CommunityRepository {
  getProfile(handle: string, signal: AbortSignal): Promise<UserProfile | null>;
  getOverview(signal: AbortSignal): Promise<CommunityOverview>;
  getShop(signal: AbortSignal): Promise<ShopCatalog>;
  /** Каталог карточек нужен магазину, чтобы показать, какие карты могут выпасть из пака. */
  getCardCatalog(signal: AbortSignal): Promise<readonly WatchCard[]>;
  /** Необязательная запись пользовательских данных. Без backend работает localStorage. */
  saveAlbums?(handle: string, albums: readonly Album[], signal: AbortSignal): Promise<void>;
  saveCollection?(handle: string, collection: CollectionState, signal: AbortSignal): Promise<void>;
}

export function createDemoCommunityRepository(): CommunityRepository {
  const savedAlbums = new Map<string, readonly Album[]>();
  const savedCollections = new Map<string, CollectionState>();
  return {
    async getProfile(handle, signal) {
      if (signal.aborted) return null;
      const profile = getDemoProfile(handle);
      const albums = savedAlbums.get(handle);
      return albums ? { ...profile, albums } : profile;
    },
    async getOverview(signal) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return getDemoOverview();
    },
    async getShop(signal) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return demoShopCatalog;
    },
    async getCardCatalog(signal) {
      if (signal.aborted) return [];
      return cardCatalog;
    },
    async saveAlbums(handle, albums, signal) {
      if (signal.aborted) return;
      savedAlbums.set(handle, albums);
    },
    async saveCollection(handle, collection, signal) {
      if (signal.aborted) return;
      savedCollections.set(handle, collection);
    },
  };
}

function asTuple(value: unknown, fallback: readonly [string, string]): readonly [string, string] {
  if (!Array.isArray(value) || value.length < 2) return fallback;
  const from = text(value[0]);
  const to = text(value[1]);
  return from && to ? [from, to] : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function flag(value: unknown): boolean {
  return value === true;
}

function asRank(value: unknown): Rank {
  return typeof value === 'string' && rankOrder.includes(value as Rank) ? value as Rank : 'W';
}

function asFrame(value: unknown): CardFrame {
  return typeof value === 'string' && value in frameTitles ? value as CardFrame : 'blue';
}

function asSlot(value: unknown): EquipSlot {
  return typeof value === 'string' && value in slotTitles ? value as EquipSlot : 'avatar';
}

function asCurrency(value: unknown): Currency {
  return value === 'dust' ? 'dust' : 'diamonds';
}

function asPotential(value: unknown): WatchCard['potential'] {
  return typeof value === 'string' && potentials.includes(value as WatchCard['potential'])
    ? value as WatchCard['potential']
    : 'Обычная';
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function parseFlags(value: unknown, card: WatchCard): CardFlags {
  const data = record(value);
  const defaults = defaultCardFlags(card);
  if (!data) return defaults;
  return {
    favorite: typeof data.favorite === 'boolean' ? data.favorite : defaults.favorite,
    exchangeable: typeof data.exchangeable === 'boolean' ? data.exchangeable : defaults.exchangeable,
    locked: typeof data.locked === 'boolean' ? data.locked : defaults.locked,
    awakened: typeof data.awakened === 'boolean' ? data.awakened : defaults.awakened,
  };
}

function parseBadge(value: unknown): UserProfile['badges'][number] | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  return {
    id, name,
    description: text(data.description) ?? '',
    icon: text(data.icon) ?? '★',
    level: number(data.level),
    xp: number(data.xp),
    progress: number(data.progress),
    rare: flag(data.rare),
  };
}

function parseFavorite(value: unknown): UserProfile['favorites'][number] | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  return {
    id, name,
    poster: text(data.poster), href: text(data.href),
    progress: typeof data.progress === 'number' ? data.progress : undefined,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    note: text(data.note),
  };
}

function parseFriend(value: unknown): UserProfile['friends'][number] | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  const presence = data.presence;
  return {
    id, name,
    icon: text(data.icon) ?? '👤',
    presence: presence === 'online' || presence === 'away' || presence === 'busy' ? presence : 'offline',
    status: text(data.status) ?? '',
  };
}

function parseGroup(value: unknown): UserProfile['groups'][number] | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  return { id, name, icon: text(data.icon) ?? '◈', members: number(data.members), role: text(data.role) };
}

function parseActivity(value: unknown): UserProfile['activity'][number] | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const title = text(data.title);
  if (!id || !title) return null;
  const kind = String(data.kind);
  const kinds = ['watched', 'review', 'badge', 'inventory', 'friend', 'card', 'pack'];
  return {
    id, title,
    kind: kinds.includes(kind) ? kind as UserProfile['activity'][number]['kind'] : 'watched',
    detail: text(data.detail) ?? '', at: text(data.at) ?? '',
    href: text(data.href), poster: text(data.poster),
  };
}

function parseHistory(value: unknown): UserProfile['history'][number] | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  return { id, name, episode: text(data.episode) ?? '', at: text(data.at) ?? '', href: text(data.href), poster: text(data.poster) };
}

function parseCard(value: unknown): WatchCard | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const title = text(data.title);
  if (!id || !title) return null;
  const base: WatchCard = {
    id, title,
    episode: number(data.episode),
    episodeLabel: text(data.episodeLabel) ?? `Серия ${number(data.episode)}`,
    image: text(data.image) ?? '',
    watchedAt: text(data.watchedAt) ?? '',
    progress: number(data.progress),
    rank: asRank(data.rank),
    note: text(data.note) ?? '',
    href: text(data.href),
    setId: text(data.setId) ?? 'archive',
    level: number(data.level),
    copies: Math.max(1, number(data.copies, 1)),
    frame: asFrame(data.frame),
    animated: flag(data.animated),
    animationReady: flag(data.animationReady),
    special: flag(data.special),
    power: number(data.power),
    favorite: flag(data.favorite),
    exchangeable: data.exchangeable === undefined ? true : flag(data.exchangeable),
    awakened: flag(data.awakened),
    locked: flag(data.locked),
    potential: asPotential(data.potential),
    dustValue: Math.max(0, number(data.dustValue)),
  };
  return { ...base, ...parseFlags(data.flags, base) };
}

function parseCardSet(value: unknown): CardSet | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  return {
    id, name,
    series: text(data.series) ?? '',
    description: text(data.description) ?? '',
    cover: text(data.cover) ?? '',
    bonus: text(data.bonus) ?? '',
  };
}

function parseInventoryItem(value: unknown): InventoryItem | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  return {
    id, name,
    description: text(data.description) ?? '',
    slot: asSlot(data.slot),
    rank: asRank(data.rank),
    icon: text(data.icon) ?? '◈',
    quantity: Math.max(1, number(data.quantity, 1)),
    level: number(data.level),
    bonuses: isStringArray(data.bonuses) ? data.bonuses : [],
    setId: text(data.setId),
    value: number(data.value),
    equipped: flag(data.equipped),
    acquiredAt: text(data.acquiredAt) ?? '',
  };
}

function parseAlbum(value: unknown): Album | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  return { id, name, description: text(data.description) ?? '', cardIds: isStringArray(data.cardIds) ? data.cardIds : [] };
}

function parseList<T>(value: unknown, guard: (entry: unknown) => T | null): readonly T[] {
  if (!Array.isArray(value)) return [];
  return value.map(guard).filter((entry): entry is T => entry !== null);
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
  const presence = String(data.presence);
  return {
    id,
    handle,
    name,
    presence: presence === 'online' || presence === 'away' || presence === 'busy' ? presence : 'offline',
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
    badges: parseList(data.badges, parseBadge),
    favorites: parseList(data.favorites, parseFavorite),
    friends: parseList(data.friends, parseFriend),
    groups: parseList(data.groups, parseGroup),
    activity: parseList(data.activity, parseActivity),
    inventory: parseList(data.inventory, parseInventoryItem),
    history: parseList(data.history, parseHistory),
    cards: parseList(data.cards, parseCard),
    cardSets: parseList(data.cardSets, parseCardSet),
    albums: parseList(data.albums, parseAlbum),
    diamonds: number(data.diamonds),
    dust: number(data.dust),
  };
}

function parsePack(value: unknown): ShopCatalog['packs'][number] | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  const drops = Array.isArray(data.dropTable)
    ? data.dropTable.map((entry) => {
      const drop = record(entry);
      const rank = drop && text(drop.rank);
      if (!rank) return null;
      return { rank: asRank(rank), weight: Math.max(0, number(drop?.weight)) };
    }).filter((entry): entry is { rank: Rank; weight: number } => entry !== null)
    : [];
  if (drops.length === 0) return null;
  const guarantee = text(data.guarantee);
  return {
    id, name,
    description: text(data.description) ?? '',
    price: Math.max(0, number(data.price)),
    currency: asCurrency(data.currency),
    amount: Math.max(1, number(data.amount, 1)),
    guarantee: guarantee ? asRank(guarantee) : undefined,
    dropTable: drops,
    accent: text(data.accent) ?? '#8b00ff',
    image: text(data.image),
    featured: flag(data.featured),
    note: text(data.note),
  };
}

function parseCosmetic(value: unknown): ShopCatalog['cosmetics'][number] | null {
  const data = record(value);
  if (!data) return null;
  const id = text(data.id);
  const name = text(data.name);
  if (!id || !name) return null;
  const category = String(data.category);
  const categories = ['avatar', 'frame', 'cover', 'status', 'boost'];
  return {
    id, name,
    description: text(data.description) ?? '',
    price: Math.max(0, number(data.price)),
    currency: asCurrency(data.currency),
    category: categories.includes(category) ? category as ShopCatalog['cosmetics'][number]['category'] : 'avatar',
    icon: text(data.icon) ?? '◈',
    accent: text(data.accent) ?? '#8b00ff',
    discount: typeof data.discount === 'number' ? data.discount : undefined,
  };
}

export function parseShopCatalog(value: unknown): ShopCatalog | null {
  const data = record(value);
  if (!data) return null;
  return {
    packs: parseList(data.packs, parsePack),
    cosmetics: parseList(data.cosmetics, parseCosmetic),
  };
}

function parseCommunityEvent(value: unknown): CommunityOverview['events'][number] | null {
  const data = record(value);
  const id = data && text(data.id);
  const name = data && text(data.name);
  if (!id || !name) return null;
  return {
    id, name,
    when: data ? text(data.when) ?? '' : '',
    participants: data ? number(data.participants) : 0,
    icon: data ? text(data.icon) ?? '◈' : '◈',
  };
}

function parseDiscussion(value: unknown): CommunityOverview['discussions'][number] | null {
  const data = record(value);
  const id = data && text(data.id);
  const title = data && text(data.title);
  if (!id || !title) return null;
  return {
    id, title,
    section: data ? text(data.section) ?? '' : '',
    author: data ? text(data.author) ?? '' : '',
    replies: data ? number(data.replies) : 0,
    at: data ? text(data.at) ?? '' : '',
  };
}

export function parseCommunityOverview(value: unknown): CommunityOverview | null {
  const data = record(value);
  if (!data) return null;
  return {
    online: positiveInteger(data.online) ? data.online : 0,
    members: positiveInteger(data.members) ? data.members : 0,
    discussionsToday: positiveInteger(data.discussionsToday) ? data.discussionsToday : 0,
    events: parseList(data.events, parseCommunityEvent),
    discussions: parseList(data.discussions, parseDiscussion),
    topProfiles: parseList(data.topProfiles, (entry) => record(entry) as CommunityOverview['topProfiles'][number] | null),
  };
}

/** Пример адаптера: GET /profiles/:handle, /overview, /shop и /cards/catalog. */
export function createHttpCommunityRepository(
  baseUrl: string,
  fetcher: typeof fetch = globalThis.fetch,
): CommunityRepository {
  const root = baseUrl.replace(/\/$/, '');
  async function json(path: string, signal: AbortSignal): Promise<unknown> {
    const response = await fetcher(`${root}${path}`, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Community API: ${response.status}`);
    return response.json();
  }
  async function write(path: string, body: unknown, signal: AbortSignal): Promise<void> {
    const response = await fetcher(`${root}${path}`, {
      method: 'PUT',
      signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Community API: ${response.status}`);
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
    async getShop(signal) {
      const parsed = parseShopCatalog(await json('/shop', signal));
      if (!parsed) throw new Error('Community API: некорректный магазин');
      return parsed;
    },
    async getCardCatalog(signal) {
      return parseList(await json('/cards/catalog', signal), parseCard);
    },
    async saveAlbums(handle, albums, signal) {
      await write(`/profiles/${encodeURIComponent(handle)}/albums`, { albums }, signal);
    },
    async saveCollection(handle, collection, signal) {
      await write(`/profiles/${encodeURIComponent(handle)}/collection`, { collection }, signal);
    },
  };
}

export const communityRepository: CommunityRepository = createDemoCommunityRepository();
