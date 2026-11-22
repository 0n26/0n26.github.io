import { describe, expect, it } from 'vitest';
import {
  addCardToAlbum, addCardToNewAlbum, albumsWithCard, createAlbum, deleteAlbum, formatCount,
  groupInventory, levelPercent, parseProfileTab, pluralCards, rarityOrder, removeCardFromAlbum, renameAlbum,
} from './logic';
import type { Album, InventoryItem } from './types';

function item(id: string, kind: string, rarity: InventoryItem['rarity'], name: string): InventoryItem {
  return { id, kind, rarity, name, description: '', icon: '★', quantity: 1, acquiredAt: '2026-01-01' };
}

describe('profile tabs', () => {
  it('returns known tabs and falls back to overview', () => {
    expect(parseProfileTab('inventory')).toBe('inventory');
    expect(parseProfileTab('badges')).toBe('badges');
    expect(parseProfileTab('cards')).toBe('cards');
    expect(parseProfileTab('albums')).toBe('albums');
    expect(parseProfileTab('unknown')).toBe('overview');
    expect(parseProfileTab(null)).toBe('overview');
  });
});

describe('levelPercent', () => {
  it('calculates progress and clamps it', () => {
    expect(levelPercent(500, 1000)).toBe(50);
    expect(levelPercent(1500, 1000)).toBe(100);
    expect(levelPercent(-10, 1000)).toBe(0);
    expect(levelPercent(10, 0)).toBe(100);
  });
});

describe('groupInventory', () => {
  it('groups by kind and sorts by rarity then name', () => {
    const groups = groupInventory([
      item('1', 'Аватары', 'common', 'Кофе'),
      item('2', 'Обложки', 'epic', 'Город'),
      item('3', 'Аватары', 'legendary', 'Сова'),
      item('4', 'Аватары', 'common', 'Лис'),
    ]);
    expect(groups.map((group) => group.kind)).toEqual(['Аватары', 'Обложки']);
    expect(groups[0].items.map((entry) => entry.id)).toEqual(['3', '1', '4']);
    expect(groups[0].items[0].id).not.toBe('1');
  });

  it('keeps mythic items before common ones', () => {
    const rarityFirst = rarityOrder.indexOf('mythic') < rarityOrder.indexOf('common');
    expect(rarityFirst).toBe(true);
  });
});

describe('albums', () => {
  const initial: readonly Album[] = [
    { id: 'al1', name: 'Осенний марафон', description: '', cardIds: ['c1'] },
    { id: 'al2', name: 'Зима', description: '', cardIds: ['c2'] },
  ];

  it('adds a card only once and reports membership', () => {
    const next = addCardToAlbum(initial, 'al1', 'c1');
    expect(next[0].cardIds).toEqual(['c1']);
    expect(addCardToAlbum(next, 'al1', 'c3')[0].cardIds).toEqual(['c1', 'c3']);
    expect(albumsWithCard(next, 'c1')).toEqual(['al1']);
  });

  it('creates, renames and removes albums without mutating the source', () => {
    const created = createAlbum(initial, 'al3', '  Новый альбом  ');
    expect(created[2]).toMatchObject({ id: 'al3', name: 'Новый альбом', cardIds: [] });
    expect(createAlbum(initial, 'al3', '   ')).toBe(initial);
    expect(renameAlbum(created, 'al3', 'Весна')[2].name).toBe('Весна');
    expect(deleteAlbum(created, 'al3')).toEqual(initial);
    expect(initial).toHaveLength(2);
  });

  it('creates an album and puts a card there in one step', () => {
    const next = addCardToNewAlbum(initial, 'al4', 'Избранное', 'c7');
    expect(next[2].cardIds).toEqual(['c7']);
  });

  it('removes a card from one album only', () => {
    const next = removeCardFromAlbum(initial, 'al2', 'c2');
    expect(next[0].cardIds).toEqual(['c1']);
    expect(next[1].cardIds).toEqual([]);
  });
});

describe('pluralCards', () => {
  it('uses Russian plural forms', () => {
    expect(pluralCards(1)).toBe('карточка');
    expect(pluralCards(3)).toBe('карточки');
    expect(pluralCards(11)).toBe('карточек');
    expect(pluralCards(21)).toBe('карточка');
  });
});

describe('formatCount', () => {
  it('uses Russian digit groups', () => {
    expect(formatCount(1842)).toMatch(/1.\d{3}/);
  });
});
