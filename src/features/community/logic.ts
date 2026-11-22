import type {
  Album, CardFlags, CardFrame, CollectionState, EquipSlot, InventoryItem, Presence, Rank,
  ShopPack, WatchCard,
} from './types';

export const profileTabs = [
  'overview', 'cards', 'albums', 'badges', 'inventory', 'friends', 'history', 'shop', 'settings',
] as const;
export type ProfileTab = typeof profileTabs[number];

export const tabTitles: Record<ProfileTab, string> = {
  overview: 'Обзор',
  cards: 'Карточки',
  albums: 'Колоды',
  badges: 'Достижения',
  inventory: 'Инвентарь',
  friends: 'Друзья',
  history: 'История',
  shop: 'Магазин',
  settings: 'Настройки',
};

export function parseProfileTab(value: string | null | undefined): ProfileTab {
  return profileTabs.find((tab) => tab === value) ?? 'overview';
}

export function levelPercent(xp: number, xpToNext: number): number {
  if (xpToNext <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((xp / xpToNext) * 100)));
}

/* ---------- Ранги карточек ---------- */

/** От самого желанного к младшему — как вкладки рангов в MangaBuff. */
export const rankOrder: readonly Rank[] = [
  'X', 'S', 'A', 'P', 'G', 'B', 'C', 'D', 'E', 'H', 'N', 'V', 'Q', 'L', 'K', 'W',
];

/** Порядок переплавки: младшие ранги идут первыми. */
export const rankUpgradeOrder: readonly Rank[] = [...rankOrder].reverse();

export const rankTitles: Record<Rank, string> = {
  X: 'Ранг X', S: 'Ранг S', A: 'Ранг A', P: 'Ранг P', G: 'Ранг G', B: 'Ранг B',
  C: 'Ранг C', D: 'Ранг D', E: 'Ранг E', H: 'Ранг H', N: 'Ранг N', V: 'Ранг V',
  Q: 'Ранг Q', L: 'Ранг L', K: 'Ранг K', W: 'Ранг W',
};

export function rankName(rank: Rank): string {
  return rankTitles[rank];
}

export const rankFlavor: Record<Rank, string> = {
  X: 'Икона', S: 'Легенда', A: 'Элита', P: 'Мастер', G: 'Избранное', B: 'Яркое',
  C: 'Достойное', D: 'Обычное', E: 'Начальное', H: 'Редкое', N: 'Тёмное',
  V: 'Сияющее', Q: 'Секрет', L: 'Светлое', K: 'Клубное', W: 'Архивное',
};

export const rankColors: Record<Rank, string> = {
  X: '#4984b2', S: '#f54972', A: '#fc4a49', P: '#2375c9', G: '#22a05b',
  B: '#d75aa7', C: '#df9300', D: '#718b99', E: '#a26a4c', H: '#6b5250',
  N: '#cd5757', V: '#9658e4', Q: '#7d6bff', L: '#347dc6', K: '#b99548', W: '#9aa6b2',
};

export const potentials: readonly WatchCard['potential'][] = [
  'Обычная', 'Редкая', 'Эпическая', 'Легендарная', 'Мифическая',
];

export const frameTitles: Record<CardFrame, string> = {
  blue: 'Синяя рамка',
  white: 'Белая рамка',
  green: 'Зелёная рамка',
  brown: 'Коричневая рамка',
  violet: 'Фиолетовая рамка',
  step: 'Ступенчатая рамка',
};

export const presenceTitles: Record<Presence, string> = {
  online: 'В сети',
  away: 'Нет на месте',
  busy: 'Занят',
  offline: 'Не в сети',
};

export const slotTitles: Record<EquipSlot, string> = {
  avatar: 'Аватары',
  frame: 'Рамки',
  cover: 'Обложки',
  status: 'Статусы',
  aura: 'Ауры',
  boost: 'Бустеры',
};

export const equipSlots: readonly EquipSlot[] = ['avatar', 'frame', 'cover', 'status', 'aura', 'boost'];

export function rankIndex(rank: Rank): number {
  const index = rankOrder.indexOf(rank);
  return index < 0 ? rankOrder.length - 1 : index;
}

export function isBetterRank(candidate: Rank, than: Rank): boolean {
  return rankIndex(candidate) < rankIndex(than);
}

/* ---------- Ранг профиля ---------- */

const userRanks: readonly { level: number; title: string; short: string; perks: string }[] = [
  { level: 85, title: 'Архивариус ночного сеанса', short: 'Архивариус', perks: 'Редкие рамки и приоритет в подборках' },
  { level: 70, title: 'Легенда каталога', short: 'Легенда', perks: 'Золотой статус и клубные паки' },
  { level: 60, title: 'Мастер коллекции', short: 'Мастер', perks: 'Дополнительный слот колоды' },
  { level: 50, title: 'Куратор сообщества', short: 'Куратор', perks: 'Особая рамка профиля' },
  { level: 40, title: 'Коллекционер серий', short: 'Коллекционер', perks: '+5% пыли за переплавку' },
  { level: 30, title: 'Знаток жанров', short: 'Знаток', perks: 'Доступ к темам сообщества' },
  { level: 20, title: 'Постоянный зритель', short: 'Зритель', perks: 'Статус «В марафоне»' },
  { level: 10, title: 'Любитель аниме', short: 'Любитель', perks: 'Первые значки' },
  { level: 1, title: 'Новичок', short: 'Новичок', perks: 'Добро пожаловать' },
];

/** Ранг пользователя считается по уровню, а не по XP внутри уровня. */
export function userRank(level: number): { title: string; short: string; perks: string; next: number | null; progress: number } {
  const tier = userRanks.find((entry) => level >= entry.level) ?? userRanks[userRanks.length - 1];
  const higher = userRanks.filter((entry) => entry.level > level).map((entry) => entry.level);
  const next = higher.length > 0 ? Math.min(...higher) : null;
  const start = tier.level;
  const end = next ?? tier.level + 1;
  const progress = next === null
    ? 100
    : Math.max(0, Math.min(100, Math.round(((level - start) / (end - start)) * 100)));
  return { title: tier.title, short: tier.short, perks: tier.perks, next, progress };
}

/* ---------- Карточки ---------- */

const rankPower: Record<Rank, number> = {
  X: 900, S: 760, A: 640, P: 530, G: 440, B: 360, C: 290, D: 230, E: 180,
  H: 150, N: 125, V: 105, Q: 90, L: 75, K: 60, W: 45,
};

export function cardPower(card: WatchCard, level = card.level, copies = card.copies): number {
  return Math.round(rankPower[card.rank] + level * 24 + copies * 8
    + (card.animated ? 70 : 0) + (card.awakened ? 90 : 0) + (card.special ? 110 : 0) + card.progress / 4);
}

export function dustForRank(rank: Rank): number {
  return Math.max(5, 50 - rankIndex(rank) * 3);
}

export function sharpenCost(level: number): number {
  return 2 + Math.floor(Math.max(0, level) / 3);
}

export function awakenCost(): number {
  return 3;
}

export function nextMeltRank(rank: Rank): Rank | null {
  if (rank === 'X') return null;
  const index = rankUpgradeOrder.indexOf(rank);
  return index < 0 || index + 1 >= rankUpgradeOrder.length ? null : rankUpgradeOrder[index + 1];
}

export function defaultCardFlags(card: WatchCard): CardFlags {
  return {
    favorite: card.favorite,
    exchangeable: card.exchangeable,
    locked: card.locked,
    awakened: card.awakened,
  };
}

export type CardFilterMode = 'all' | 'animated' | 'animation' | 'sharpened' | 'special' | 'recent' | 'copies' | 'favorites';
export type CardSort = 'rank' | 'newest' | 'power' | 'level';

export interface CardFilters {
  rank: Rank | 'all';
  query: string;
  mode: CardFilterMode;
  sort: CardSort;
}

export const cardFilterModes: readonly { id: CardFilterMode; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'favorites', label: 'Избранные' },
  { id: 'animated', label: 'Анимация' },
  { id: 'animation', label: 'Осколок A+' },
  { id: 'sharpened', label: 'Заточенные' },
  { id: 'special', label: 'Особые' },
  { id: 'recent', label: 'Недавние' },
  { id: 'copies', label: 'Дубли' },
];

export const cardSortTitles: Record<CardSort, string> = {
  rank: 'По рангу',
  power: 'По силе',
  newest: 'По новизне',
  level: 'По заточке',
};

export function filterCards(cards: readonly WatchCard[], filters: CardFilters, now = Date.now()): readonly WatchCard[] {
  const query = filters.query.trim().toLocaleLowerCase('ru-RU');
  const recentFrom = now - 7 * 24 * 60 * 60 * 1000;
  const list = cards.filter((card) => {
    if (filters.rank !== 'all' && card.rank !== filters.rank) return false;
    if (query && !`${card.title} ${card.note} ${card.episodeLabel}`.toLocaleLowerCase('ru-RU').includes(query)) return false;
    switch (filters.mode) {
      case 'favorites': return card.favorite;
      case 'animated': return card.animated || card.awakened;
      case 'animation': return card.animationReady && !card.animated && !card.awakened;
      case 'sharpened': return card.level > 0;
      case 'special': return card.special;
      case 'recent': return new Date(card.watchedAt).getTime() >= recentFrom;
      case 'copies': return card.copies > 1;
      default: return true;
    }
  });
  return sortCards(list, filters.sort);
}

export function sortCards(cards: readonly WatchCard[], sort: CardSort): readonly WatchCard[] {
  return [...cards].sort((a, b) => {
    switch (sort) {
      case 'newest': return new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime();
      case 'power': return cardPower(b) - cardPower(a) || rankIndex(a.rank) - rankIndex(b.rank);
      case 'level': return b.level - a.level || rankIndex(a.rank) - rankIndex(b.rank);
      default: return rankIndex(a.rank) - rankIndex(b.rank)
        || cardPower(b) - cardPower(a) || a.title.localeCompare(b.title, 'ru');
    }
  });
}

/* ---------- Инвентарь ---------- */

export function groupInventory(items: readonly InventoryItem[]): readonly { slot: EquipSlot; items: readonly InventoryItem[] }[] {
  const groups = new Map<EquipSlot, InventoryItem[]>();
  for (const item of items) {
    const group = groups.get(item.slot);
    if (group) group.push(item);
    else groups.set(item.slot, [item]);
  }
  return equipSlots
    .filter((slot) => groups.has(slot))
    .map((slot) => ({
      slot,
      items: [...(groups.get(slot) ?? [])].sort((a, b) =>
        rankIndex(a.rank) - rankIndex(b.rank) || b.level - a.level || a.name.localeCompare(b.name, 'ru')),
    }));
}

export function toggleEquip(
  equipped: Readonly<Partial<Record<EquipSlot, string>>>,
  item: InventoryItem,
): Readonly<Partial<Record<EquipSlot, string>>> {
  const next = { ...equipped };
  if (next[item.slot] === item.id) delete next[item.slot];
  else next[item.slot] = item.id;
  return next;
}

export function equippedBonus(items: readonly InventoryItem[], equipped: Readonly<Partial<Record<EquipSlot, string>>>): readonly string[] {
  return items
    .filter((item) => equipped[item.slot] === item.id)
    .flatMap((item) => item.bonuses);
}

export function itemUpgradeCost(level: number): number {
  return 20 + level * 10;
}

/* ---------- Альбомы / колоды карточек ---------- */

export function createAlbum(albums: readonly Album[], id: string, name: string): readonly Album[] {
  const clean = name.trim().slice(0, 48);
  if (!clean) return albums;
  return [...albums, { id, name: clean, description: '', cardIds: [] }];
}

export function addCardToAlbum(albums: readonly Album[], albumId: string, cardId: string): readonly Album[] {
  return albums.map((album) => album.id === albumId && !album.cardIds.includes(cardId)
    ? { ...album, cardIds: [...album.cardIds, cardId] }
    : album);
}

export function addCardToNewAlbum(albums: readonly Album[], id: string, name: string, cardId: string): readonly Album[] {
  return addCardToAlbum(createAlbum(albums, id, name), id, cardId);
}

export function removeCardFromAlbum(albums: readonly Album[], albumId: string, cardId: string): readonly Album[] {
  return albums.map((album) => album.id === albumId
    ? { ...album, cardIds: album.cardIds.filter((entry) => entry !== cardId) }
    : album);
}

export function renameAlbum(albums: readonly Album[], albumId: string, name: string): readonly Album[] {
  const clean = name.trim().slice(0, 48);
  if (!clean) return albums;
  return albums.map((album) => album.id === albumId ? { ...album, name: clean } : album);
}

export function deleteAlbum(albums: readonly Album[], albumId: string): readonly Album[] {
  return albums.filter((album) => album.id !== albumId);
}

export function albumsWithCard(albums: readonly Album[], cardId: string): readonly string[] {
  return albums.filter((album) => album.cardIds.includes(cardId)).map((album) => album.id);
}

/* ---------- Паки ---------- */

export interface PityState {
  s: number;
  x: number;
  xl: number;
}

export const pityLimits: PityState = { s: 51, x: 200, xl: 500 };

export function rollRank(dropTable: ShopPack['dropTable'], random: () => number = Math.random): Rank {
  const total = dropTable.reduce((sum, drop) => sum + Math.max(0, drop.weight), 0);
  if (total <= 0) return 'W';
  const value = Math.min(0.999999, Math.max(0, random())) * total;
  let cursor = 0;
  for (const drop of dropTable) {
    cursor += Math.max(0, drop.weight);
    if (value < cursor) return drop.rank;
  }
  return dropTable[dropTable.length - 1].rank;
}

/**
 * Гарантии как в MangaBuff: S не позже 51-го пака, X — на 200-м, XL — на 500-м.
 * `quantity` — число паков, `pack.amount` — число карточек внутри одного пака.
 */
export function rollPackRanks(
  pack: ShopPack,
  quantity: number,
  pity: PityState,
  random: () => number = Math.random,
): { ranks: readonly Rank[]; pity: PityState; bonuses: readonly string[] } {
  let s = pity.s;
  let x = pity.x;
  let xl = pity.xl;
  const ranks: Rank[] = [];
  const bonuses: string[] = [];
  const packs = Math.max(1, quantity);

  for (let packIndex = 0; packIndex < packs; packIndex += 1) {
    for (let cardIndex = 0; cardIndex < pack.amount; cardIndex += 1) {
      s += 1; x += 1; xl += 1;
      let rank = rollRank(pack.dropTable, random);
      let bonus: string | undefined;

      if (xl >= pityLimits.xl || x >= pityLimits.x) {
        rank = 'X';
        bonus = xl >= pityLimits.xl ? 'Гарантия XL' : 'Гарантия 200 паков';
      } else if (s >= pityLimits.s) {
        rank = 'S';
        bonus = 'Гарантия 51 пака';
      }
      if (cardIndex === 0 && pack.guarantee && !isBetterRank(rank, pack.guarantee)) {
        rank = pack.guarantee;
        bonus ??= `Гарантия ${pack.guarantee}`;
      }

      if (rank === 'X') { s = 0; x = 0; xl = 0; }
      else if (rank === 'S') { s = 0; }

      ranks.push(rank);
      if (bonus) bonuses.push(bonus);
    }
  }

  return { ranks, pity: { s, x, xl }, bonuses };
}

export function pickCardByRank(
  cards: readonly WatchCard[],
  rank: Rank,
  random: () => number = Math.random,
): WatchCard | null {
  if (cards.length === 0) return null;
  const exact = cards.filter((card) => card.rank === rank);
  if (exact.length > 0) return exact[Math.floor(random() * exact.length) % exact.length];
  const ordered = [...cards].sort((a, b) =>
    Math.abs(rankIndex(a.rank) - rankIndex(rank)) - Math.abs(rankIndex(b.rank) - rankIndex(rank)));
  return ordered[0];
}

export function emptyCollection(diamonds: number, dust: number): CollectionState {
  return {
    diamonds, dust,
    cardLevels: {}, cardCopies: {}, cardFlags: {}, extraCards: [], extraInventory: [],
    equipped: {}, itemLevels: {}, pity: { s: 0, x: 0, xl: 0 }, packHistory: [],
  };
}

/* ---------- Склонения и форматирование ---------- */

export function pluralCards(count: number): string {
  return plural(count, 'карточка', 'карточки', 'карточек');
}

export function pluralPacks(count: number): string {
  return plural(count, 'пак', 'пака', 'паков');
}

export function pluralCopies(count: number): string {
  return plural(count, 'копия', 'копии', 'копий');
}

function plural(count: number, one: string, few: string, many: string): string {
  const last = count % 10;
  const lastTwo = count % 100;
  if (last === 1 && lastTwo !== 11) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

const numberFormat = new Intl.NumberFormat('ru-RU');
const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

export function formatCount(value: number): string {
  return numberFormat.format(value);
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : shortDateFormat.format(date);
}
