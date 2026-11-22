import { describe, expect, it } from 'vitest';
import { formatCount, groupInventory, levelPercent, parseProfileTab, rarityOrder } from './logic';
import type { InventoryItem } from './types';

function item(id: string, kind: string, rarity: InventoryItem['rarity'], name: string): InventoryItem {
  return { id, kind, rarity, name, description: '', icon: '★', quantity: 1, acquiredAt: '2026-01-01' };
}

describe('profile tabs', () => {
  it('returns known tabs and falls back to overview', () => {
    expect(parseProfileTab('inventory')).toBe('inventory');
    expect(parseProfileTab('badges')).toBe('badges');
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

describe('formatCount', () => {
  it('uses Russian digit groups', () => {
    expect(formatCount(1842)).toMatch(/1.\d{3}/);
  });
});
