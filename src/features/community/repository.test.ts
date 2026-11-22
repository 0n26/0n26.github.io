import { describe, expect, it } from 'vitest';
import { demoHandleDefault } from './demoRepository';
import { createDemoCommunityRepository, createHttpCommunityRepository, parseCommunityOverview, parseUserProfile } from './repository';

describe('community repository', () => {
  it('returns demo profile and overview', async () => {
    const repository = createDemoCommunityRepository();
    const profile = await repository.getProfile(demoHandleDefault, new AbortController().signal);
    expect(profile?.name).toBe('Ночной Фонарь');
    expect(profile?.inventory.length).toBeGreaterThan(0);
    expect((await repository.getOverview(new AbortController().signal)).online).toBeGreaterThan(0);
  });

  it('returns null for unknown handle', async () => {
    const repository = createDemoCommunityRepository();
    const profile = await repository.getProfile('nobody', new AbortController().signal);
    expect(profile?.handle).toBe('nobody');
    expect(profile?.inventory).toEqual([]);
  });

  it('rejects invalid backend payloads and fills optional fields', () => {
    expect(parseUserProfile(null)).toBeNull();
    expect(parseUserProfile({ id: '1' })).toBeNull();
    const profile = parseUserProfile({ id: '1', handle: 'hero', name: 'Герой', level: 5 });
    expect(profile).toMatchObject({ level: 5, xp: 0, xpToNext: 1, presence: 'offline' });
    expect(profile?.inventory).toEqual([]);
    expect(parseCommunityOverview({ online: 12 })).toMatchObject({ online: 12, members: 0 });
  });

  it('loads profile and overview from HTTP backend', async () => {
    const urls: string[] = [];
    const fetcher = async (input: RequestInfo | URL) => {
      urls.push(String(input));
      if (String(input).endsWith('/overview')) {
        return Response.json({ online: 3, members: 10, discussionsToday: 1, events: [], discussions: [], topProfiles: [] });
      }
      return Response.json({ id: '7', handle: 'http-user', name: 'HTTP', level: 9, xp: 10, xpToNext: 100 });
    };
    const repository = createHttpCommunityRepository('https://example.test/api/', fetcher as typeof fetch);
    const signal = new AbortController().signal;
    expect((await repository.getProfile('http user', signal))?.handle).toBe('http-user');
    expect((await repository.getOverview(signal)).online).toBe(3);
    expect(urls).toEqual([
      'https://example.test/api/profiles/http%20user',
      'https://example.test/api/overview',
    ]);
  });

  it('throws on failed backend response', async () => {
    const repository = createHttpCommunityRepository('https://example.test', async () => new Response('', { status: 503 }));
    await expect(repository.getOverview(new AbortController().signal)).rejects.toThrow('503');
  });
});
