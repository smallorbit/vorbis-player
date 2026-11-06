import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { createDeferredFn } from '@/test/asyncRace';
import { queueStore } from '@/stores/queueStore';
import { SKIP_ON_ERROR_DELAY_MS } from '@/constants/timing';

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
import { makeTrack as makeFixtureTrack } from '@/test/fixtures';

function makeTrack(id: string, provider: ProviderId = 'spotify'): MediaTrack {
  return makeFixtureTrack({
    id,
    provider,
    playbackRef: { provider, ref: `spotify:track:${id}` },
    name: `Track ${id}`,
    durationMs: 180000,
    image: '',
  });
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
    queueStore.replaceQueue(tracks, { currentIndex: 0 });
    const committed: number[] = [];
    queueStore.subscribe(() => { committed.push(queueStore.getCurrentIndex()); });

    const { result } = renderHook(() => useProviderPlayback({}));

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
    expect(committed).toContain(2);
    expect(committed.at(-1)).toBe(2);
    expect(committed).not.toContain(1);
    expect(queueStore.getCurrentIndex()).toBe(2);
    expect(mockPause).not.toHaveBeenCalled();
  });

  async function supersedeSpotifyStartWithDropbox(result: { current: ReturnType<typeof useProviderPlayback> }) {
    const callsBefore = play.callCount;
    let pSpotify!: Promise<void>;
    await act(async () => {
      pSpotify = result.current.playTrack(0, true);
      await waitFor(() => expect(play.callCount).toBe(callsBefore + 1));
      void result.current.playTrack(1);
      await waitFor(() => expect(play.callCount).toBe(callsBefore + 2));
    });
    return { spotifyCall: callsBefore, pSpotify };
  }

  it('does not skip ahead when a superseded start fails', async () => {
    // #given
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queueStore.replaceQueue([makeTrack('t0'), makeTrack('t1', 'dropbox'), makeTrack('t2')], { currentIndex: 0 });
    const { result } = renderHook(() => useProviderPlayback({}));
    const { spotifyCall, pSpotify } = await supersedeSpotifyStartWithDropbox(result);
    const callsAfterHandoff = play.callCount;

    // #when the cancelled Spotify start fails (e.g. interrupted by the handoff pause)
    await act(async () => {
      play.reject(spotifyCall, new Error('play() interrupted by pause()'));
      await pSpotify;
      await vi.advanceTimersByTimeAsync(SKIP_ON_ERROR_DELAY_MS * 2);
    });

    // #then no retry of the old queue is scheduled
    expect(play.callCount).toBe(callsAfterHandoff);
    vi.useRealTimers();
  });

  it('does not skip ahead when the re-pause of a superseded start fails', async () => {
    // #given
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queueStore.replaceQueue([makeTrack('t0'), makeTrack('t1', 'dropbox'), makeTrack('t2')], { currentIndex: 0 });
    const { result } = renderHook(() => useProviderPlayback({}));
    const { spotifyCall, pSpotify } = await supersedeSpotifyStartWithDropbox(result);
    const callsAfterHandoff = play.callCount;
    mockPause.mockRejectedValueOnce(new Error('sdk gone'));

    // #when the cancelled start lands and its re-pause rejects
    await act(async () => {
      play.resolve(spotifyCall, undefined);
      await pSpotify;
      await vi.advanceTimersByTimeAsync(SKIP_ON_ERROR_DELAY_MS * 2);
    });

    // #then
    expect(play.callCount).toBe(callsAfterHandoff);
    vi.useRealTimers();
  });

  it('re-pauses the outgoing provider when its superseded start lands after the handoff', async () => {
    // #given a Spotify start still in flight when a Dropbox track takes over
    const callsBefore = play.callCount;
    queueStore.replaceQueue([makeTrack('t0'), makeTrack('t1', 'dropbox')], { currentIndex: 0 });
    const { result } = renderHook(() => useProviderPlayback({}));
    let pSpotify!: Promise<void>;
    let pDropbox!: Promise<void>;
    await act(async () => {
      pSpotify = result.current.playTrack(0);
      await waitFor(() => expect(play.callCount).toBe(callsBefore + 1));
      pDropbox = result.current.playTrack(1);
      await waitFor(() => expect(play.callCount).toBe(callsBefore + 2));
    });
    const pausesAtHandoff = mockPause.mock.calls.length;

    // #when the Spotify start finally lands
    await act(async () => {
      play.resolve(callsBefore, undefined);
      await pSpotify;
    });

    // #then it is silenced again, and Dropbox's result still commits
    expect(mockPause.mock.calls.length).toBe(pausesAtHandoff + 1);
    await act(async () => {
      play.resolve(callsBefore + 1, undefined);
      await pDropbox;
    });
    expect(queueStore.getCurrentIndex()).toBe(1);
  });
});
