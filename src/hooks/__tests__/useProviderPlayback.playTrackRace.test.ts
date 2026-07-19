import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { createDeferredFn } from '@/test/asyncRace';

// The adapter's playTrack is the awaited async dependency whose two invocations
// we settle out of order. Each render of the descriptor shares this deferred fn.
const play = createDeferredFn<[MediaTrack, unknown], void>();
const mockPause = vi.fn().mockResolvedValue(undefined);
const mockPrepareTrack = vi.fn();

const mockRegistryGet = vi.fn();

vi.mock('@/providers/registry', () => ({
  providerRegistry: { get: (...args: unknown[]) => mockRegistryGet(...args) },
}));

vi.mock('@/services/sessionPersistence', () => ({
  loadSession: () => null,
}));

import { useProviderPlayback } from '../useProviderPlayback';

function makeTrack(id: string, provider: ProviderId = 'spotify' as ProviderId): MediaTrack {
  return {
    id,
    provider,
    playbackRef: { provider, ref: `spotify:track:${id}` },
    name: `Track ${id}`,
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 180000,
    image: '',
  };
}

function makeDescriptor() {
  return {
    id: 'spotify' as ProviderId,
    capabilities: { hasNativeQueueSync: false, hasExternalLink: false },
    playback: {
      providerId: 'spotify' as ProviderId,
      playTrack: play.fn,
      pause: mockPause,
      resume: vi.fn().mockResolvedValue(undefined),
      prepareTrack: mockPrepareTrack,
      seek: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      setVolume: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
    },
  };
}

describe('useProviderPlayback — playTrack stale-write race', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistryGet.mockReturnValue(makeDescriptor());
  });

  it('newer playTrack wins when an older adapter call resolves later', async () => {
    // #given a queue and two overlapping playTrack invocations
    const tracks = [makeTrack('t0'), makeTrack('t1'), makeTrack('t2')];
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: tracks };
    const setCurrentTrackIndex = vi.fn();

    const { result } = renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex, mediaTracksRef }),
    );

    // #when playTrack(1) then playTrack(2) both reach the awaited adapter call,
    // pinning adapter call index 0 → index 1 (older), index 1 → index 2 (newer).
    let pOld!: Promise<void>;
    let pNew!: Promise<void>;
    await act(async () => {
      pOld = result.current.playTrack(1);
      await waitFor(() => expect(play.callCount).toBe(1));
      pNew = result.current.playTrack(2);
      await waitFor(() => expect(play.callCount).toBe(2));
    });

    // ...and the newer (index 2) adapter call resolves BEFORE the stale (index 1).
    await act(async () => {
      play.resolve(1, undefined);
      play.resolve(0, undefined);
      await Promise.all([pOld, pNew]);
    });

    // #then the committed current-track index must reflect the newer call (2),
    // and the stale older call (1) must not clobber it after resolving last.
    const committed = setCurrentTrackIndex.mock.calls.map((c: [number]) => c[0]);
    expect(committed).toContain(2);
    expect(committed.at(-1)).toBe(2);
    expect(setCurrentTrackIndex).not.toHaveBeenCalledWith(1);
  });
});
