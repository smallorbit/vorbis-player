import { describe, it, expect } from 'vitest';
import { makeTrack } from '@/test/fixtures';
import { formatQueueRowAriaLabel, isQueueRowActivationKey } from '../queueRowA11y';

describe('queueRowA11y', () => {
  it('formats aria labels with artist and now-playing state', () => {
    const track = makeTrack({ name: 'Track', artists: 'Band' });
    expect(formatQueueRowAriaLabel(track, false)).toBe('Track, Band');
    expect(formatQueueRowAriaLabel(track, true)).toBe('Track, Band, now playing');
  });

  it('recognizes Enter and Space as activation keys', () => {
    expect(isQueueRowActivationKey('Enter')).toBe(true);
    expect(isQueueRowActivationKey(' ')).toBe(true);
    expect(isQueueRowActivationKey('ArrowDown')).toBe(false);
  });
});
