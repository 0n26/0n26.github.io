import { expect, it } from 'vitest';
import { episodeCaption } from '../../../src/pages/title/EpisodeNavigation';

it('uses the total only for matching episode positions and preserves special titles', () => {
  const episode = { id: 'vost:8&7', number: 87, streams: [] };
  expect(episodeCaption(episode, 86, 220)).toBe('Серия 87 из 220');
  expect(episodeCaption({ ...episode, number: 87.5, name: 'ОВА' }, 2, 20)).toBe('Серия 87.5 · ОВА');
});
