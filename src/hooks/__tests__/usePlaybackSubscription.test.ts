import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PlaybackState } from '@/types/domain';

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
  },
}));

vi.mock('@/lib/debugLog', () => ({
  logQueue: vi.fn(),
  logArtRace: vi.fn(),
}));

import { usePlaybackSubscription } from '../usePlaybackSubscription';
import { queueStore } from '@/stores/queueStore';
import { makeMediaTrack, makeProviderDescriptor } from '@/test/fixtures';

describe('usePlaybackSubscription — expectedTrackIdRef guard', () => {
  let emit: (state: PlaybackState | null) => void;
  let setIsPlaying: ReturnType<typeof vi.fn>;
  let setPlaybackPosition: ReturnType<typeof vi.fn>;

  const trackA = makeMediaTrack({ id: 'track-a', provider: 'spotify' });
  const trackB = makeMediaTrack({ id: 'track-b', provider: 'spotify' });
  const tracks = [trackA, trackB];

  function makeState(currentTrackId: string): PlaybackState {
    return {
      isPlaying: true,
      positionMs: 1000,
      durationMs: 210000,
      currentTrackId,
      currentPlaybackRef: { provider: 'spotify', ref: `spotify:track:${currentTrackId}` },
    };
  }

  beforeEach(() => {
    emit = () => {};
    setIsPlaying = vi.fn();
    setPlaybackPosition = vi.fn();
    queueStore.__resetForTests();
  });

  function makeProps(
    expectedTrackId: string | null,
    currentIndex = 0
  ) {
    const descriptor = makeProviderDescriptor({
      playback: {
        ...makeProviderDescriptor().playback,
        subscribe: vi.fn().mockImplementation((cb: (s: PlaybackState | null) => void) => {
          emit = cb;
          return vi.fn();
        }),
        getState: vi.fn().mockResolvedValue(null),
      },
    });

    queueStore.replaceQueue(tracks, { currentIndex });

    const drivingProviderRef = { current: null as string | null };
    const expectedTrackIdRef = { current: expectedTrackId };

    return {
      activeDescriptor: descriptor,
      drivingProviderRef,
      expectedTrackIdRef,
      setIsPlaying,
      setPlaybackPosition,
    };
  }

  it('accepts a state update when expectedTrackIdRef matches the incoming trackId', () => {
    // #given — expectedTrackIdRef is set to track-b (the expected next track)
    const props = makeProps('track-b', 0);

    renderHook(() => usePlaybackSubscription(props));

    // #when — provider emits state for track-b (the one we're waiting for)
    act(() => {
      emit(makeState('track-b'));
    });

    // #then — expectedTrackIdRef is cleared (match consumed) and index is NOT updated
    // because the guard branch clears the ref without syncing the index
    expect(props.expectedTrackIdRef.current).toBeNull();
    expect(queueStore.getCurrentIndex()).toBe(0);
  });

  it('ignores a state update when expectedTrackIdRef is non-null and does not match', () => {
    // #given — expectedTrackIdRef is waiting for track-b; provider emits track-a
    const props = makeProps('track-b', 0);

    renderHook(() => usePlaybackSubscription(props));

    // #when — provider emits a stale event for track-a (the old track)
    act(() => {
      emit(makeState('track-a'));
    });

    // #then — ref is unchanged and no index update is applied
    expect(props.expectedTrackIdRef.current).toBe('track-b');
    expect(queueStore.getCurrentIndex()).toBe(0);
  });

  it('falls back to accepting any state update when expectedTrackIdRef is null', () => {
    // #given — expectedTrackIdRef is null (no in-flight play, initial-mount state)
    const props = makeProps(null, 0);

    renderHook(() => usePlaybackSubscription(props));

    // #when — provider emits state for track-b (index 1 in the queue)
    act(() => {
      emit(makeState('track-b'));
    });

    // #then — index sync runs: the queue's current index is updated to 1
    expect(queueStore.getCurrentIndex()).toBe(1);
    expect(props.expectedTrackIdRef.current).toBeNull();
  });
});
