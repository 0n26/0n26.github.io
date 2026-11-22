import { describe, expect, it } from 'vitest';
import {
  addCardToAlbum, addCardToNewAlbum, albumsWithCard, cardPower, createAlbum, deleteAlbum,
  dustForRank, filterCards, formatCount, groupInventory, levelPercent, nextMeltRank, parseProfileTab,
  pluralCards, pluralPacks, profileTabs, rankName, rankOrder, removeCardFromAlbum, renameAlbum, rollPackRanks,
  sharpenCost, userRank,
} from './logic';
import type { Album, InventoryItem, ShopPack, WatchCard } from './types';

function item(id: string, slot: InventoryItem['slot'], rank: InventoryItem['rank'], name: string, level = 0): InventoryItem {
  return {
    id, name, slot, rank, level, quantity: 1, description: '', icon: '★', bonuses: [],
    value: 10, acquiredAt: '2026-01-01',
  };
}

function card(id: string, rank: WatchCard['rank'], overrides: Partial<WatchCard> = {}): WatchCard {
  const base: WatchCard = {
    id, title: `Карточка ${id}`, episode: 1, episodeLabel: 'Серия 1', image: '',
    watchedAt: '2026-11-20T12:00:00+03:00', progress: 50, rank, note: '', setId: 'archive',
    level: 0, copies: 1, frame: 'blue', animated: false, animationReady: false, special: false,
    power: 0, favorite: false, exchangeable: true, awakened: false, locked: false,
    potential: 'Обычная', dustValue: 10,
  };
  return { ...base, ...overrides };
}

const testPack: ShopPack = {
  id: 'test', name: 'Тестовый пак', description: '', price: 10, currency: 'diamonds', amount: 1,
  dropTable: [{ rank: 'W', weight: 100 }], accent: '#fff',
};

describe('profile tabs', () => {
  it('returns known tabs and falls back to overview', () => {
    expect(parseProfileTab('inventory')).toBe('inventory');
    expect(profileTabs).not.toContain('shop');
    expect(parseProfileTab('shop')).toBe('overview');
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

describe('ranks', () => {
  it('orders ranks from X to W and names them', () => {
    expect(rankOrder[0]).toBe('X');
    expect(rankOrder[rankOrder.length - 1]).toBe('W');
    expect(rankName('X')).toBe('Ранг X');
  });

  it('melts three cards into the next rank and never melts X', () => {
    expect(nextMeltRank('C')).toBe('B');
    expect(nextMeltRank('X')).toBeNull();
    expect(dustForRank('X')).toBeGreaterThan(dustForRank('W'));
  });

  it('increases sharpening cost slowly and counts power', () => {
    expect(sharpenCost(0)).toBe(2);
    expect(sharpenCost(9)).toBe(5);
    expect(cardPower(card('c1', 'S', { level: 3, copies: 2 })))
      .toBeGreaterThan(cardPower(card('c1', 'S')));
  });

  it('derives the profile rank from level', () => {
    expect(userRank(42)).toMatchObject({ short: 'Коллекционер', next: 50 });
    expect(userRank(90).short).toBe('Архивариус');
    expect(userRank(90).next).toBeNull();
  });
});

describe('groupInventory', () => {
  it('groups by slot and sorts by rank, level and name', () => {
    const groups = groupInventory([
      item('1', 'avatar', 'C', 'Лис'),
      item('2', 'cover', 'A', 'Город'),
      item('3', 'avatar', 'S', 'Сова'),
      item('4', 'avatar', 'C', 'Кофе', 4),
    ]);
    expect(groups.map((group) => group.slot)).toEqual(['avatar', 'cover']);
    expect(groups[0].items.map((entry) => entry.id)).toEqual(['3', '4', '1']);
  });
});

describe('card filters', () => {
  const cards = [
    card('c1', 'S', { title: 'Небо', favorite: true, level: 2, copies: 2 }),
    card('c2', 'C', { title: 'Земля', animated: true }),
    card('c3', 'W', { title: 'Море', animationReady: true }),
  ];

  it('filters by rank, query and special mode', () => {
    const base = { rank: 'all' as const, query: '', mode: 'all' as const, sort: 'rank' as const };
    expect(filterCards(cards, { ...base, rank: 'S' })).toHaveLength(1);
    expect(filterCards(cards, { ...base, query: 'море' })[0].id).toBe('c3');
    expect(filterCards(cards, { ...base, mode: 'favorites' })[0].id).toBe('c1');
    expect(filterCards(cards, { ...base, mode: 'copies' })[0].id).toBe('c1');
    expect(filterCards(cards, { ...base, mode: 'animation' })[0].id).toBe('c3');
    expect(filterCards(cards, { ...base, sort: 'power' })[0].id).toBe('c1');
  });
});

describe('packs', () => {
  it('rolls the configured amount of cards', () => {
    const result = rollPackRanks({ ...testPack, amount: 3 }, 2, { s: 0, x: 0, xl: 0 }, () => 0.5);
    expect(result.ranks).toEqual(['W', 'W', 'W', 'W', 'W', 'W']);
    expect(result.pity).toEqual({ s: 6, x: 6, xl: 6 });
  });

  it('grants S, X and XL guarantees and resets counters', () => {
    const nearS = rollPackRanks(testPack, 1, { s: 50, x: 10, xl: 10 }, () => 0.5);
    expect(nearS.ranks).toEqual(['S']);
    expect(nearS.bonuses).toEqual(['Гарантия 51 пака']);
    expect(nearS.pity.s).toBe(0);

    const nearX = rollPackRanks(testPack, 1, { s: 0, x: 199, xl: 499 }, () => 0.5);
    expect(nearX.ranks).toEqual(['X']);
    expect(nearX.bonuses).toEqual(['Гарантия XL']);
    expect(nearX.pity).toEqual({ s: 0, x: 0, xl: 0 });
  });

  it('respects the pack guarantee for the first card', () => {
    const result = rollPackRanks({ ...testPack, guarantee: 'A' }, 1, { s: 0, x: 0, xl: 0 }, () => 0.5);
    expect(result.ranks).toEqual(['A']);
    expect(result.bonuses).toEqual(['Гарантия A']);
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
    const created = createAlbum(initial, 'al3', '  Новая колода  ');
    expect(created[2]).toMatchObject({ id: 'al3', name: 'Новая колода', cardIds: [] });
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

describe('plural and number formatting', () => {
  it('uses Russian plural forms', () => {
    expect(pluralCards(1)).toBe('карточка');
    expect(pluralCards(3)).toBe('карточки');
    expect(pluralCards(11)).toBe('карточек');
    expect(pluralCards(21)).toBe('карточка');
    expect(pluralPacks(2)).toBe('пака');
    expect(pluralPacks(5)).toBe('паков');
  });

  it('uses Russian digit groups', () => {
    expect(formatCount(1842)).toMatch(/1.\d{3}/);
  });
});
