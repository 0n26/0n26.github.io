import { expect, it } from 'vitest';
import { playbackPoint } from '../../../src/components/player/media';

it('preserves playback when switching again before the replacement stream loads', () => {
  const active = { currentTime: 128.5, paused: false, ended: false };
  const saved = playbackPoint(active, undefined);
  const unloaded = { currentTime: 0, paused: true, ended: false };
  expect(playbackPoint(unloaded, saved)).toEqual({ time: 128.5, playing: true });
  expect(playbackPoint({ ...active, ended: true }, undefined)).toEqual({ time: 128.5, playing: false });
});
