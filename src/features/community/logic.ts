import type { Album, InventoryItem, Presence, Rarity } from './types';

export const profileTabs = ['overview', 'cards', 'albums', 'badges', 'inventory', 'friends', 'history', 'settings'] as const;
export type ProfileTab = typeof profileTabs[number];

export const tabTitles: Record<ProfileTab, string> = {
  overview: 'Обзор',
  cards: 'Карточки',
  albums: 'Альбомы',
  badges: 'Значки',
  inventory: 'Инвентарь',
  friends: 'Друзья',
  history: 'История',
  settings: 'Настройки',
};

export function parseProfileTab(value: string | null | undefined): ProfileTab {
  return profileTabs.find((tab) => tab === value) ?? 'overview';
}

export function levelPercent(xp: number, xpToNext: number): number {
  if (xpToNext <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((xp / xpToNext) * 100)));
}

export const rarityOrder: readonly Rarity[] = ['mythic', 'legendary', 'epic', 'rare', 'common'];

export const rarityTitles: Record<Rarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
  mythic: 'Мифический',
};

export const presenceTitles: Record<Presence, string> = {
  online: 'В сети',
  away: 'Нет на месте',
  busy: 'Занят',
  offline: 'Не в сети',
};

/** Группирует предметы по типу, а внутри — по редкости и названию. */
export function groupInventory(items: readonly InventoryItem[]): readonly { kind: string; items: readonly InventoryItem[] }[] {
  const groups = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const group = groups.get(item.kind);
    if (group) group.push(item);
    else groups.set(item.kind, [item]);
  }
  return [...groups].map(([kind, group]) => ({
    kind,
    items: [...group].sort((a, b) =>
      rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity) || a.name.localeCompare(b.name, 'ru')),
  }));
}

/* ---------- Альбомы карточек ---------- */

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

export function pluralCards(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  if (last === 1 && lastTwo !== 11) return 'карточка';
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'карточки';
  return 'карточек';
}

/* ---------- Форматирование ---------- */

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
