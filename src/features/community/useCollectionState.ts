import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { demoCollection } from './demoRepository';
import {
  cardPower, defaultCardFlags, dustForRank, emptyCollection, nextMeltRank, pickCardByRank,
  rankIndex, rollPackRanks, sharpenCost, itemUpgradeCost,
} from './logic';
import { communityRepository } from './repository';
import type {
  CardFlags, CollectionState, EquipSlot, InventoryItem, PackResult, ShopCosmetic, ShopPack,
  UserProfile, WatchCard,
} from './types';

const storageKey = (handle: string) => `night-session:collection:${handle}`;

function isNumberMap(value: unknown): value is Readonly<Record<string, number>> {
  return typeof value === 'object' && value !== null
    && Object.values(value).every((entry) => typeof entry === 'number' && Number.isFinite(entry));
}

function isCardFlagsMap(value: unknown): value is Readonly<Record<string, CardFlags>> {
  return typeof value === 'object' && value !== null && Object.values(value).every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const flags = entry as Partial<CardFlags>;
    return typeof flags.favorite === 'boolean' && typeof flags.exchangeable === 'boolean'
      && typeof flags.locked === 'boolean' && typeof flags.awakened === 'boolean';
  });
}

function isWatchCard(value: unknown): value is WatchCard {
  return typeof value === 'object' && value !== null
    && typeof (value as WatchCard).id === 'string'
    && typeof (value as WatchCard).title === 'string'
    && typeof (value as WatchCard).rank === 'string';
}

function isInventoryItem(value: unknown): value is InventoryItem {
  return typeof value === 'object' && value !== null
    && typeof (value as InventoryItem).id === 'string'
    && typeof (value as InventoryItem).slot === 'string';
}

function isPackResult(value: unknown): value is PackResult {
  return typeof value === 'object' && value !== null
    && typeof (value as PackResult).id === 'string'
    && typeof (value as PackResult).cardId === 'string';
}

function readCollection(handle: string): CollectionState {
  const fallback = demoCollection(handle);
  try {
    const raw = localStorage.getItem(storageKey(handle));
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const data = parsed as Partial<CollectionState>;
    return {
      diamonds: typeof data.diamonds === 'number' ? data.diamonds : fallback.diamonds,
      dust: typeof data.dust === 'number' ? data.dust : fallback.dust,
      cardLevels: isNumberMap(data.cardLevels) ? data.cardLevels : fallback.cardLevels,
      cardCopies: isNumberMap(data.cardCopies) ? data.cardCopies : fallback.cardCopies,
      cardFlags: isCardFlagsMap(data.cardFlags) ? data.cardFlags : fallback.cardFlags,
      extraCards: Array.isArray(data.extraCards) ? data.extraCards.filter(isWatchCard) : [],
      extraInventory: Array.isArray(data.extraInventory) ? data.extraInventory.filter(isInventoryItem) : [],
      equipped: typeof data.equipped === 'object' && data.equipped !== null
        ? data.equipped as Partial<Record<EquipSlot, string>>
        : {},
      itemLevels: isNumberMap(data.itemLevels) ? data.itemLevels : fallback.itemLevels,
      pity: {
        s: typeof data.pity?.s === 'number' ? data.pity.s : 0,
        x: typeof data.pity?.x === 'number' ? data.pity.x : 0,
        xl: typeof data.pity?.xl === 'number' ? data.pity.xl : 0,
      },
      packHistory: Array.isArray(data.packHistory) ? data.packHistory.filter(isPackResult) : [],
    };
  } catch {
    return fallback;
  }
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function spend(state: CollectionState, currency: ShopPack['currency'], amount: number): CollectionState {
  return currency === 'dust'
    ? { ...state, dust: state.dust - amount }
    : { ...state, diamonds: state.diamonds - amount };
}

export function canAfford(pack: ShopPack, quantity: number, state: CollectionState): boolean {
  const cost = pack.price * Math.max(1, quantity);
  return (pack.currency === 'dust' ? state.dust : state.diamonds) >= cost;
}

/** Коллекция профиля: карты, заточка, экипировка, валюты и история паков. */
export function useCollectionState(handle: string, profile: UserProfile) {
  const [state, setState] = useState<CollectionState>(() => readCollection(handle));
  const stateRef = useRef(state);
  const loadedHandle = useRef(handle);
  const controller = useRef<AbortController | null>(null);

  const commit = useCallback((updater: (current: CollectionState) => CollectionState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    if (loadedHandle.current !== handle) {
      loadedHandle.current = handle;
      const next = readCollection(handle);
      stateRef.current = next;
      setState(next);
      return;
    }
    stateRef.current = state;
    try {
      localStorage.setItem(storageKey(handle), JSON.stringify(state));
    } catch {
      // Приватный режим: коллекция живёт до перезагрузки страницы.
    }
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    void communityRepository.saveCollection?.(handle, state, active.signal).catch(() => undefined);
  }, [state, handle]);

  useEffect(() => () => controller.current?.abort(), []);

  const cards = useMemo<readonly WatchCard[]>(() => {
    const owned = [...profile.cards, ...state.extraCards];
    const seen = new Set<string>();
    return owned.filter((card) => {
      if (seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    }).map((card) => {
      const level = state.cardLevels[card.id] ?? card.level;
      const copies = state.cardCopies[card.id] ?? card.copies;
      const flags = state.cardFlags[card.id] ?? defaultCardFlags(card);
      return {
        ...card, ...flags, level, copies,
        power: cardPower(card, level, copies),
        dustValue: dustForRank(card.rank),
      };
    });
  }, [profile.cards, state.extraCards, state.cardLevels, state.cardCopies, state.cardFlags]);

  const inventory = useMemo<readonly InventoryItem[]>(() => {
    const owned = [...profile.inventory, ...state.extraInventory];
    const seen = new Set<string>();
    return owned.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).map((item) => ({
      ...item,
      level: state.itemLevels[item.id] ?? item.level,
      equipped: state.equipped[item.slot] === item.id,
    }));
  }, [profile.inventory, state.extraInventory, state.itemLevels, state.equipped]);

  const equip = useCallback((item: InventoryItem) => commit((current) => {
    const next = { ...current.equipped };
    if (next[item.slot] === item.id) delete next[item.slot];
    else next[item.slot] = item.id;
    return { ...current, equipped: next };
  }), [commit]);

  const sharpenCard = useCallback((card: WatchCard) => commit((current) => {
    const cost = sharpenCost(card.level);
    if (current.dust < cost) return current;
    return {
      ...current,
      dust: current.dust - cost,
      cardLevels: { ...current.cardLevels, [card.id]: (current.cardLevels[card.id] ?? card.level) + 1 },
    };
  }), [commit]);

  const upgradeItem = useCallback((item: InventoryItem) => commit((current) => {
    const cost = itemUpgradeCost(item.level);
    if (current.dust < cost) return current;
    return {
      ...current,
      dust: current.dust - cost,
      itemLevels: { ...current.itemLevels, [item.id]: (current.itemLevels[item.id] ?? item.level) + 1 },
    };
  }), [commit]);

  const meltCard = useCallback((card: WatchCard) => commit((current) => {
    const copies = current.cardCopies[card.id] ?? card.copies;
    if (copies < 3 || card.rank === 'X') return current;
    const higher = nextMeltRank(card.rank);
    const melted: WatchCard | null = higher ? {
      ...card,
      id: id('melt'),
      rank: higher,
      level: 0,
      copies: 1,
      special: false,
      animated: false,
      awakened: false,
      favorite: false,
      exchangeable: true,
      locked: false,
      power: 0,
      dustValue: dustForRank(higher),
    } : null;
    return {
      ...current,
      dust: current.dust + dustForRank(card.rank) * 2,
      cardCopies: { ...current.cardCopies, [card.id]: copies - 3 },
      extraCards: melted ? [...current.extraCards, melted] : current.extraCards,
    };
  }), [commit]);

  const awakenCard = useCallback((card: WatchCard) => commit((current) => {
    const copies = current.cardCopies[card.id] ?? card.copies;
    const flags = current.cardFlags[card.id] ?? defaultCardFlags(card);
    if (!card.animationReady || flags.awakened || copies < 3) return current;
    return {
      ...current,
      cardCopies: { ...current.cardCopies, [card.id]: copies - 3 },
      cardFlags: { ...current.cardFlags, [card.id]: { ...flags, awakened: true } },
    };
  }), [commit]);

  const toggleFlag = useCallback((card: WatchCard, key: keyof CardFlags) => commit((current) => {
    const flags = { ...(current.cardFlags[card.id] ?? defaultCardFlags(card)) };
    if (key === 'favorite' && !flags.favorite) {
      const favorites = cards.filter((entry) =>
        (current.cardFlags[entry.id] ?? defaultCardFlags(entry)).favorite).length;
      if (favorites >= 12) return current;
    }
    flags[key] = !flags[key];
    return { ...current, cardFlags: { ...current.cardFlags, [card.id]: flags } };
  }), [commit, cards]);

  const buyCosmetic = useCallback((cosmetic: ShopCosmetic): boolean => {
    const current = stateRef.current;
    const cost = cosmetic.price;
    const balance = cosmetic.currency === 'dust' ? current.dust : current.diamonds;
    if (balance < cost) return false;
    const slot = cosmetic.category as EquipSlot;
    const itemId = `owned-${cosmetic.id}`;
    if (current.extraInventory.some((entry) => entry.id === itemId)
      || profile.inventory.some((entry) => entry.id === itemId)) return false;

    const item: InventoryItem = {
      id: itemId,
      name: cosmetic.name,
      description: cosmetic.description,
      slot,
      rank: 'A',
      icon: cosmetic.icon,
      quantity: 1,
      level: 0,
      bonuses: [`оформление: ${slot}`],
      value: cost,
      acquiredAt: new Date().toISOString().slice(0, 10),
    };
    commit((value) => ({
      ...spend(value, cosmetic.currency, cost),
      extraInventory: [...value.extraInventory, item],
      equipped: { ...value.equipped, [slot]: itemId },
    }));
    return true;
  }, [commit, profile.inventory]);

  const openPacks = useCallback((pack: ShopPack, quantity: number, catalog: readonly WatchCard[]): readonly PackResult[] => {
    const current = stateRef.current;
    const count = Math.max(1, quantity);
    if (!canAfford(pack, count, current)) return [];

    const rolled = rollPackRanks(pack, count, current.pity);
    const at = new Date().toISOString();
    const ownedIds = new Set([...profile.cards, ...current.extraCards].map((entry) => entry.id));
    let next = spend(current, pack.currency, pack.price * count);
    next = { ...next, pity: rolled.pity };
    const results: PackResult[] = [];

    rolled.ranks.forEach((rank, index) => {
      const exact = catalog.filter((entry) => rankIndex(entry.rank) === rankIndex(rank));
      const fresh = exact.find((entry) => !ownedIds.has(entry.id));
      const selected = fresh ?? pickCardByRank(catalog, rank);
      if (!selected) return;
      const duplicate = ownedIds.has(selected.id);
      results.push({
        id: id('roll'), packId: pack.id, cardId: selected.id, rank, at,
        duplicate, bonus: rolled.bonuses[index],
      });
      if (duplicate) {
        next = {
          ...next,
          dust: next.dust + Math.ceil(selected.dustValue / 2),
          cardCopies: { ...next.cardCopies, [selected.id]: (next.cardCopies[selected.id] ?? selected.copies) + 1 },
        };
      } else {
        ownedIds.add(selected.id);
        next = { ...next, extraCards: [...next.extraCards, { ...selected, level: 0, copies: 1 }] };
      }
    });

    next = { ...next, packHistory: [...results, ...next.packHistory].slice(0, 40) };
    stateRef.current = next;
    setState(next);
    return results;
  }, [profile.cards]);

  const reset = useCallback(() => {
    const next = emptyCollection(profile.diamonds, profile.dust);
    stateRef.current = next;
    setState(next);
  }, [profile.diamonds, profile.dust]);

  return {
    state, cards, inventory, equip, sharpenCard, upgradeItem, meltCard, awakenCard, toggleFlag,
    buyCosmetic, openPacks, reset,
    diamonds: state.diamonds,
    dust: state.dust,
  };
}
