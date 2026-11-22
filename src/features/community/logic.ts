import type { InventoryItem, Presence, Rarity } from './types';

export const profileTabs = ['overview', 'inventory', 'badges', 'friends', 'history', 'settings'] as const;
export type ProfileTab = typeof profileTabs[number];

export const tabTitles: Record<ProfileTab, string> = {
  overview: 'Обзор',
  inventory: 'Инвентарь',
  badges: 'Значки',
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
