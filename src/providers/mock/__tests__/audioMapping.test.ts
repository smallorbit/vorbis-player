import { describe, it, expect } from 'vitest';
import { clipUrlForTrack, clipIndexForTrack, AUDIO_CLIP_COUNT } from '../audioMapping';

describe('audioMapping', () => {
  it('returns a valid clip URL', () => {
    const url = clipUrlForTrack('some-track-id');
    expect(url).toMatch(/^\/playwright-fixtures\/audio\/clip-\d{2}\.ogg$/);
  });

  it('clip index is within range', () => {
    const idx = clipIndexForTrack('some-track-id');
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(AUDIO_CLIP_COUNT);
  });

  it('is deterministic for the same track id', () => {
    expect(clipUrlForTrack('abc')).toBe(clipUrlForTrack('abc'));
    expect(clipIndexForTrack('xyz')).toBe(clipIndexForTrack('xyz'));
  });

  it('different IDs can map to different clips', () => {
    const urls = new Set(['a', 'b', 'c', 'd', 'e'].map(clipUrlForTrack));
    expect(urls.size).toBeGreaterThan(1);
  });

  it('distributes 1000 IDs reasonably across clips', () => {
    const counts = new Array<number>(AUDIO_CLIP_COUNT).fill(0);
    for (let i = 0; i < 1000; i++) {
      const idx = clipIndexForTrack(`track-${i}`);
      counts[idx]++;
    }
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    expect(min).toBeGreaterThan(0);
    expect(max).toBeLessThan(250);
  });
});
