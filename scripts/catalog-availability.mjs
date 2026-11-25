import { parseVoiceAlias } from '../src/catalog/titleRef.ts';
import { createAniLiberty } from '../src/sources/aniliberty/index.ts';
import { createAnimeVost } from '../src/sources/animevost/index.ts';

const concurrency = 4;
const titleTimeout = 10_000;

export async function refreshCatalogAvailability(catalogs, {
  previous = {}, fetcher = globalThis.fetch, signal = AbortSignal.timeout(240_000), limit = 1000,
  sources = [createAniLiberty(fetcher), createAnimeVost(fetcher)],
} = {}) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('Invalid catalog availability check limit');

  const byKey = new Map(sources.map((source) => [source.key, source]));
  const now = Date.now();
  const availability = {};
  const checks = [];
  for (const entries of catalogs) {
    for (const [position, { alias }] of entries.entries()) {
      const ref = parseVoiceAlias(alias);
      if (!ref) continue;
      const old = previous?.[alias];
      const checkedAt = Number.isSafeInteger(old?.checkedAt) && old.checkedAt >= 0 && old.checkedAt <= now
        ? old.checkedAt : -1;
      if (checkedAt >= 0) {
        availability[alias] = { checkedAt, ...(typeof old.playable === 'boolean' && { playable: old.playable }) };
      }
      const source = byKey.get(ref.sourceKey);
      if (source) checks.push({ alias, localAlias: ref.alias, source, checkedAt, position });
    }
  }
  // Rotate oldest attempts first and interleave the providers' unchecked rows.
  checks.sort((a, b) => a.checkedAt - b.checkedAt || a.position - b.position);
  const count = Math.min(checks.length, limit);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (!signal.aborted && next < count) {
      const { alias, localAlias, source } = checks[next++];
      let playable = availability[alias]?.playable;
      const probeSignal = AbortSignal.any([signal, AbortSignal.timeout(titleTimeout)]);
      try {
        const title = await source.getTitle(localAlias, probeSignal);
        probeSignal.throwIfAborted();
        if (title === null) playable = false;
        else if (title.alias === localAlias) {
          playable = title.restriction === undefined && title.episodes.some(({ streams }) => streams.length > 0);
        }
      } catch {
        // A failed lookup advances the rotation without changing the last known result.
      }
      if (!signal.aborted) availability[alias] = { checkedAt: now, ...(playable !== undefined && { playable }) };
    }
  }));
  return availability;
}
