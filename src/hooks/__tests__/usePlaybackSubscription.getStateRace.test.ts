import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { PlaybackState } from '@/types/domain';
import { createDeferredFn } from '@/test/asyncRace';

// The effect resolves the driving provider's initial state via
// providerRegistry.get(id).getState(). We make that a deferred fn so the test
// controls when — and after which lifecycle events — it settles.
const getState = createDeferredFn<[], PlaybackState | null>();

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn(() => ({ playback: { getState: getState.fn } })),
  },
}));

vi.mock('@/lib/debugLog', () => ({
  logQueue: vi.fn(),
  logArtRace: vi.fn(),
}));

import { usePlaybackSubscription } from '../usePlaybackSubscription';
import { makeMediaTrack, makeProviderDescriptor } from '@/test/fixtures';

describe('usePlaybackSubscription — initial getState stale-write race', () => {
  let setIsPlaying: ReturnType<typeof vi.fn>;
  let setPlaybackPosition: ReturnType<typeof vi.fn>;

  const tracks = [makeMediaTrack({ id: 'track-a', provider: 'spotify' })];

  beforeEach(() => {
    vi.clearAllMocks();
    setIsPlaying = vi.fn();
    setPlaybackPosition = vi.fn();
  });

  function makeProps() {
    const descriptor = makeProviderDescriptor({
      playback: {
        ...makeProviderDescriptor().playback,
        subscribe: vi.fn().mockReturnValue(vi.fn()),
        getState: getState.fn,
      },
    });
    return {
      activeDescriptor: descriptor,
      drivingProviderRef: { current: null as string | null },
      tracksRef: { current: tracks },
      currentTrackIndexRef: { current: 0 },
      expectedTrackIdRef: { current: null as string | null },
      setIsPlaying,
      setPlaybackPosition,
      setCurrentTrackIndex: vi.fn(),
      setTracks: vi.fn(),
    };
  }

  it('does not commit playback state from a getState that resolves after unmount', async () => {
    // #given a mounted subscription whose initial getState() is in flight
    const { unmount } = renderHook(() => usePlaybackSubscription(makeProps()));
    await waitFor(() => expect(getState.callCount).toBeGreaterThanOrEqual(1));

    // #when the hook unmounts (provider switch / teardown) before getState settles,
    // then the stale getState resolves
    unmount();
    await act(async () => {
      getState.resolve(0, {
        isPlaying: true,
        positionMs: 4000,
        durationMs: 210000,
        currentTrackId: 'track-a',
        currentPlaybackRef: { provider: 'spotify', ref: 'spotify:track:track-a' },
      });
      await Promise.resolve();
    });

    // #then the superseded getState must not write playback state into the
    // torn-down subscription.
    expect(setIsPlaying).not.toHaveBeenCalled();
    expect(setPlaybackPosition).not.toHaveBeenCalled();
  });
});
