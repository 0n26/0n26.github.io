import { describe, expect, it } from 'vitest';
import { demoHandleDefault } from './demoRepository';
import {
  createDemoCommunityRepository, createHttpCommunityRepository, parseCommunityOverview,
  parseShopCatalog, parseUserProfile,
} from './repository';

describe('community repository', () => {
  it('returns demo profile, overview, shop and card catalog', async () => {
    const repository = createDemoCommunityRepository();
    const signal = new AbortController().signal;
    const profile = await repository.getProfile(demoHandleDefault, signal);
    expect(profile?.name).toBe('Ночной Фонарь');
    expect(profile?.inventory.length).toBeGreaterThan(0);
    expect(profile?.cards.length).toBeGreaterThan(0);
    expect((await repository.getOverview(signal)).online).toBeGreaterThan(0);
    const shop = await repository.getShop(signal);
    expect(shop.packs.length).toBeGreaterThan(0);
    expect(shop.packs[0].dropTable.length).toBeGreaterThan(0);
    expect((await repository.getCardCatalog(signal)).length).toBeGreaterThan(profile?.cards.length ?? 0);
  });

  it('keeps saved albums and collection per handle', async () => {
    const repository = createDemoCommunityRepository();
    const signal = new AbortController().signal;
    const albums = [{ id: 'custom', name: 'Моя колода', description: '', cardIds: ['c1'] }];
    await repository.saveAlbums?.(demoHandleDefault, albums, signal);
    expect((await repository.getProfile(demoHandleDefault, signal))?.albums).toEqual(albums);
    expect((await repository.getProfile('other', signal))?.albums).not.toEqual(albums);
  });

  it('returns null for unknown handle payloads', () => {
    expect(parseUserProfile(null)).toBeNull();
    expect(parseUserProfile({ id: '1' })).toBeNull();
  });

  it('returns a stub profile for an unknown demo handle', async () => {
    const repository = createDemoCommunityRepository();
    const profile = await repository.getProfile('nobody', new AbortController().signal);
    expect(profile?.handle).toBe('nobody');
    expect(profile?.inventory).toEqual([]);
    expect(profile?.cards).toEqual([]);
    expect(profile?.diamonds).toBe(0);
  });

  it('rejects invalid backend payloads and fills optional fields', () => {
    const profile = parseUserProfile({ id: '1', handle: 'hero', name: 'Герой', level: 5 });
    expect(profile).toMatchObject({ level: 5, xp: 0, xpToNext: 1, presence: 'offline' });
    expect(profile?.inventory).toEqual([]);
    expect(profile?.cards).toEqual([]);
    expect(parseCommunityOverview({ online: 12 })).toMatchObject({ online: 12, members: 0 });
  });

  it('parses rank flags and nested card fields', () => {
    const profile = parseUserProfile({
      id: '1', handle: 'hero', name: 'Герой', level: 5,
      cards: [{
        id: 'c1', title: 'Карточка', rank: 'S', level: 3, copies: 2, frame: 'violet',
        favorite: true, exchangeable: false, locked: true, awakened: true, potential: 'Мифическая',
        flags: { favorite: false, exchangeable: true, locked: false, awakened: false },
      }],
    });
    expect(profile?.cards[0]).toMatchObject({
      rank: 'S', frame: 'violet', level: 3, copies: 2, potential: 'Мифическая',
      favorite: false, exchangeable: true, locked: false, awakened: false,
    });
  });

  it('parses shop catalog and drops', () => {
    expect(parseShopCatalog(null)).toBeNull();
    const shop = parseShopCatalog({
      packs: [{
        id: 'p1', name: 'Пак', price: 100, currency: 'diamonds', amount: 2, guarantee: 'A',
        dropTable: [{ rank: 'C', weight: 2 }, { rank: 'S', weight: 1 }],
      }],
      cosmetics: [{ id: 'k1', name: 'Рамка', price: 50, currency: 'dust', category: 'frame' }],
    });
    expect(shop?.packs[0]).toMatchObject({ amount: 2, guarantee: 'A', currency: 'diamonds' });
    expect(shop?.packs[0].dropTable).toHaveLength(2);
    expect(shop?.cosmetics[0].category).toBe('frame');
    expect(parseShopCatalog({ packs: [{ id: 'p' }] })?.packs).toEqual([]);
  });

  it('loads profile, overview, shop and catalog from HTTP backend', async () => {
    const urls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      urls.push(String(input));
      if (String(input).endsWith('/overview')) {
        return Response.json({ online: 3, members: 10, discussionsToday: 1, events: [], discussions: [], topProfiles: [] });
      }
      if (String(input).endsWith('/shop')) {
        return Response.json({
          packs: [{ id: 'p1', name: 'Пак', price: 10, currency: 'diamonds', amount: 1, dropTable: [{ rank: 'W', weight: 1 }] }],
          cosmetics: [],
        });
      }
      if (String(input).endsWith('/cards/catalog')) {
        return Response.json([{ id: 'c1', title: 'Карточка', rank: 'C' }]);
      }
      return Response.json({ id: '7', handle: 'http-user', name: 'HTTP', level: 9, xp: 10, xpToNext: 100 });
    };
    const repository = createHttpCommunityRepository('https://example.test/api/', fetcher as typeof fetch);
    const signal = new AbortController().signal;
    expect((await repository.getProfile('http user', signal))?.handle).toBe('http-user');
    expect((await repository.getOverview(signal)).online).toBe(3);
    expect((await repository.getShop(signal)).packs).toHaveLength(1);
    expect(await repository.getCardCatalog(signal)).toHaveLength(1);
    expect(urls).toEqual([
      'https://example.test/api/profiles/http%20user',
      'https://example.test/api/overview',
      'https://example.test/api/shop',
      'https://example.test/api/cards/catalog',
    ]);
  });

  it('throws on failed backend response', async () => {
    const repository = createHttpCommunityRepository('https://example.test', async () => new Response('', { status: 503 }));
    await expect(repository.getOverview(new AbortController().signal)).rejects.toThrow('503');
  });
});
