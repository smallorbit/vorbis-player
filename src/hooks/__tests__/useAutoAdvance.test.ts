import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// The ended-detection heuristics (near-end threshold, paused-at-zero with
// buffering cooldown) live in playbackStore and are covered by
// src/stores/__tests__/playbackStore.test.ts. These tests cover the hook's
// POLICY: what happens after the store reports a track ended.
const mockSubscribeTrackEnded = vi.fn();

vi.mock('@/stores/playbackStore', () => ({
  playbackStore: {
    subscribeTrackEnded: (cb: () => void) => mockSubscribeTrackEnded(cb),
    // Called by the global test setup's per-test reset.
    __resetForTests: vi.fn(),
  },
}));

import { useAutoAdvance } from '../useAutoAdvance';
import { queueStore } from '@/stores/queueStore';
import { makeMediaTrack } from '@/test/fixtures';
import { AUTO_ADVANCE_DELAY_MS } from '@/constants/timing';

describe('useAutoAdvance', () => {
  let playTrack: ReturnType<typeof vi.fn>;
  let emitTrackEnded: (() => void) | null;
  const tracks = [
    makeMediaTrack({ id: 't1' }),
    makeMediaTrack({ id: 't2' }),
    makeMediaTrack({ id: 't3' }),
  ];

  beforeEach(() => {
    playTrack = vi.fn();
    emitTrackEnded = null;
    vi.clearAllMocks();
    vi.useFakeTimers();
    queueStore.__resetForTests();

    mockSubscribeTrackEnded.mockImplementation((cb: () => void) => {
      emitTrackEnded = cb;
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not subscribe to track-ended events when enabled=false', () => {
    // #given / #when
    renderHook(() => useAutoAdvance({ playTrack, enabled: false }));

    // #then
    expect(mockSubscribeTrackEnded).not.toHaveBeenCalled();
  });

  it('advances to the next track after the delay when a track ends', () => {
    // #given
    queueStore.replaceQueue(tracks, { currentIndex: 0 });
    renderHook(() => useAutoAdvance({ playTrack }));

    // #when — the store reports the current track ended
    emitTrackEnded?.();
    expect(playTrack).not.toHaveBeenCalled();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    // #then — skipOnError=true so unplayable tracks are skipped
    expect(playTrack).toHaveBeenCalledWith(1, true);
  });

  it('stops at the end of the queue instead of wrapping', () => {
    // #given — playing the last track
    queueStore.replaceQueue(tracks, { currentIndex: 2 });
    renderHook(() => useAutoAdvance({ playTrack }));

    // #when
    emitTrackEnded?.();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    // #then
    expect(playTrack).not.toHaveBeenCalled();
  });

  it('computes the next index at fire time, not at scheduling time', () => {
    // #given — an advance is scheduled from index 0
    queueStore.replaceQueue(tracks, { currentIndex: 0 });
    renderHook(() => useAutoAdvance({ playTrack }));
    emitTrackEnded?.();

    // #when — before the delay elapses, the index moves (provider index sync)
    // and a new ended event arrives; the timer that fires reads the live queue
    queueStore.setCurrentIndex(1);
    emitTrackEnded?.();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    // #then — advanced from the live index (1 → 2), never from the stale 0
    expect(playTrack).toHaveBeenCalledTimes(1);
    expect(playTrack).toHaveBeenCalledWith(2, true);
  });

  it('cancels a pending advance when the queue changes under it (e.g. shuffle toggle)', () => {
    // #given — an advance is pending
    queueStore.replaceQueue(tracks, { currentIndex: 0 });
    renderHook(() => useAutoAdvance({ playTrack }));
    emitTrackEnded?.();

    // #when — the queue is replaced before the delay elapses
    queueStore.replaceQueue([makeMediaTrack({ id: 'x1' }), makeMediaTrack({ id: 'x2' })], { currentIndex: 0 });
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    // #then — the stale-index advance never fires
    expect(playTrack).not.toHaveBeenCalled();
  });

  it('cancels a pending advance when the current index changes (manual skip)', () => {
    // #given
    queueStore.replaceQueue(tracks, { currentIndex: 0 });
    renderHook(() => useAutoAdvance({ playTrack }));
    emitTrackEnded?.();

    // #when — the user manually skips before the delay elapses
    queueStore.setCurrentIndex(2);
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    // #then
    expect(playTrack).not.toHaveBeenCalled();
  });

  it('cancels a pending advance on unmount', () => {
    // #given
    queueStore.replaceQueue(tracks, { currentIndex: 0 });
    const { unmount } = renderHook(() => useAutoAdvance({ playTrack }));
    emitTrackEnded?.();

    // #when
    unmount();
    vi.advanceTimersByTime(AUTO_ADVANCE_DELAY_MS);

    // #then
    expect(playTrack).not.toHaveBeenCalled();
  });
});
