/**
 * Tests for usePlayerLogic.handleHydrate fallback behavior — when the saved
 * track can't be loaded, the player should skip forward through the queue
 * until a playable track is found, or reset to the library if none is.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../usePlayerLogic';
import { TrackProvider } from '@/contexts/TrackContext';
import { VisualEffectsProvider } from '@/contexts/visualEffects';
import { ColorProvider } from '@/contexts/ColorContext';
import { ProviderProvider } from '@/contexts/ProviderContext';
import { makeMediaTrack } from '@/test/fixtures';
import { UnavailableTrackError } from '@/providers/errors';
import type { SessionSnapshot } from '@/services/sessionPersistence';

const playTrackSpy = vi.fn();
const mockPrepareTrack = vi.fn();
const mockProbePlayable = vi.fn();
const mockIsAuthenticated = vi.fn(() => true);

vi.mock('@/hooks/usePlaylistManager', () => ({
  usePlaylistManager: vi.fn(() => ({ handlePlaylistSelect: vi.fn() })),
}));

vi.mock('@/hooks/useProviderPlayback', () => ({
  useProviderPlayback: vi.fn(() => ({
    playTrack: playTrackSpy,
    currentPlaybackProviderRef: { current: null },
  })),
}));

vi.mock('@/hooks/useAutoAdvance', () => ({
  useAutoAdvance: vi.fn(),
}));

vi.mock('@/hooks/useAccentColor', () => ({
  useAccentColor: vi.fn(),
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: vi.fn(() => ({ isUnifiedLikedActive: false })),
}));

vi.mock('@/hooks/useRadio', () => ({
  useRadio: vi.fn(() => ({
    radioState: { isActive: false, seedDescription: null, isGenerating: false, error: null, lastMatchStats: null },
    startRadio: vi.fn(),
    stopRadio: vi.fn(),
    isRadioAvailable: true,
  })),
}));

const mockDescriptor = {
  id: 'spotify' as const,
  catalog: { listTracks: vi.fn().mockResolvedValue([]) },
  auth: {
    isAuthenticated: mockIsAuthenticated,
    beginLogin: vi.fn(),
    logout: vi.fn(),
  },
  playback: {
    initialize: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    playTrack: vi.fn(),
    getState: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn(() => vi.fn()),
    prepareTrack: mockPrepareTrack,
    probePlayable: mockProbePlayable,
  },
  capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true },
};

vi.mock('@/contexts/ProviderContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/ProviderContext')>();
  return {
    ...actual,
    useProviderContext: vi.fn(() => ({
      activeDescriptor: mockDescriptor,
      setActiveProviderId: vi.fn(),
      getDescriptor: vi.fn((id: string) => (id === 'spotify' ? mockDescriptor : undefined)),
      connectedProviderIds: ['spotify'],
      chosenProviderId: 'spotify',
      activeProviderId: 'spotify',
      setProviderSwitchInterceptor: vi.fn(),
      registry: {},
      needsProviderSelection: false,
      enabledProviderIds: ['spotify'],
      toggleProvider: vi.fn(),
      isProviderEnabled: vi.fn(() => true),
      hasMultipleProviders: false,
      fallthroughNotification: null,
      dismissFallthroughNotification: vi.fn(),
    })),
  };
});

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockReturnValue(false),
    getAccessToken: vi.fn().mockReturnValue('test-token'),
    ensureValidToken: vi.fn().mockResolvedValue('test-token'),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    resume: vi.fn(),
    pause: vi.fn(),
    setVolume: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn(() => mockDescriptor),
    getAll: vi.fn(() => []),
    register: vi.fn(),
  },
}));

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ProviderProvider>
    <TrackProvider>
      <VisualEffectsProvider>
        <ColorProvider>
          {children}
        </ColorProvider>
      </VisualEffectsProvider>
    </TrackProvider>
  </ProviderProvider>
);

function makeSession(overrides?: Partial<SessionSnapshot>): SessionSnapshot {
  const trackA = makeMediaTrack({ id: 'track-a', name: 'Song A', artists: 'Artist A' });
  const trackB = makeMediaTrack({ id: 'track-b', name: 'Song B', artists: 'Artist B' });
  return {
    collectionId: 'playlist-xyz',
    collectionName: 'My Playlist',
    collectionProvider: 'spotify',
    trackIndex: 0,
    trackId: 'track-a',
    queueTracks: [trackA, trackB],
    playbackPosition: 42_000,
    ...overrides,
  };
}

describe('usePlayerLogic — handleHydrate fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playTrackSpy.mockClear();
    mockPrepareTrack.mockClear();
    mockProbePlayable.mockClear();
    mockProbePlayable.mockResolvedValue(true);
    mockIsAuthenticated.mockReturnValue(true);
  });

  it('skips to the next track when prepareTrack throws on the saved track', async () => {
    // #given — first track's prepareTrack throws UnavailableTrackError, second succeeds
    mockPrepareTrack
      .mockImplementationOnce(() => { throw new UnavailableTrackError('Song A'); })
      .mockImplementationOnce(() => {});
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    let hydrateResult!: Awaited<ReturnType<typeof result.current.handlers.handleHydrate>>;
    await act(async () => {
      hydrateResult = await result.current.handlers.handleHydrate(session);
    });

    // #then — landed on second track, flagged as skipped
    expect(hydrateResult.track?.id).toBe('track-b');
    expect(hydrateResult.skipped).toBe(true);
    expect(hydrateResult.totalFailure).toBe(false);
    expect(mockPrepareTrack).toHaveBeenCalledTimes(2);
    expect(mockPrepareTrack.mock.calls[0][0].id).toBe('track-a');
    expect(mockPrepareTrack.mock.calls[1][0].id).toBe('track-b');
  });

  it('omits the saved positionMs when falling back to a later track', async () => {
    // #given
    mockPrepareTrack
      .mockImplementationOnce(() => { throw new Error('boom'); })
      .mockImplementationOnce(() => {});
    const session = makeSession({ playbackPosition: 120_000 });
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });

    // #then — first call had positionMs, second had undefined
    expect(mockPrepareTrack.mock.calls[0][1]).toEqual({ positionMs: 120_000 });
    expect(mockPrepareTrack.mock.calls[1][1]).toBeUndefined();
  });

  it('updates currentTrackIndex to the first playable candidate', async () => {
    // #given — three-track queue, first two throw, third succeeds
    mockPrepareTrack
      .mockImplementationOnce(() => { throw new UnavailableTrackError('a'); })
      .mockImplementationOnce(() => { throw new UnavailableTrackError('b'); })
      .mockImplementationOnce(() => {});
    const trackA = makeMediaTrack({ id: 'track-a' });
    const trackB = makeMediaTrack({ id: 'track-b' });
    const trackC = makeMediaTrack({ id: 'track-c' });
    const session = makeSession({ queueTracks: [trackA, trackB, trackC], trackId: 'track-a', trackIndex: 0 });
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });

    // #then
    await waitFor(() => {
      expect(result.current.state.tracks).toHaveLength(3);
    });
    expect(mockPrepareTrack).toHaveBeenCalledTimes(3);
    expect(mockPrepareTrack.mock.calls[2][0].id).toBe('track-c');
  });

  it('routes to the library and flags total failure when every track fails', async () => {
    // #given — both tracks throw
    mockPrepareTrack.mockImplementation(() => { throw new UnavailableTrackError('nope'); });
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    let hydrateResult!: Awaited<ReturnType<typeof result.current.handlers.handleHydrate>>;
    await act(async () => {
      hydrateResult = await result.current.handlers.handleHydrate(session);
    });

    // #then — full-failure result, queue cleared (persistence cleanup is the caller's job)
    expect(hydrateResult.track).toBeNull();
    expect(hydrateResult.skipped).toBe(false);
    expect(hydrateResult.totalFailure).toBe(true);
    expect(mockPrepareTrack).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(result.current.state.tracks).toHaveLength(0);
      expect(result.current.state.selectedPlaylistId).toBeNull();
    });
  });

  it('treats unauthenticated providers as a total failure and routes to the library', async () => {
    // #given — every candidate's descriptor reports unauthenticated, so no track
    // can be prepared. The only way to force this reliably is to flip the mock
    // to always return false for this test — the ProviderProvider also consumes
    // isAuthenticated during render, so per-call flipping is racey.
    mockIsAuthenticated.mockReturnValue(false);
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    let hydrateResult!: Awaited<ReturnType<typeof result.current.handlers.handleHydrate>>;
    await act(async () => {
      hydrateResult = await result.current.handlers.handleHydrate(session);
    });

    // #then — prepareTrack never ran; total failure
    expect(hydrateResult.totalFailure).toBe(true);
    expect(hydrateResult.track).toBeNull();
    expect(mockPrepareTrack).not.toHaveBeenCalled();
  });

  it('clears the pending hydrate ref on total failure so handlePlay does not resurrect it', async () => {
    // #given
    mockPrepareTrack.mockImplementation(() => { throw new UnavailableTrackError('nope'); });
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });
    playTrackSpy.mockClear();

    // #when — user hits play after hydrate wipes out
    await act(async () => {
      await result.current.handlers.handlePlay();
    });

    // #then — no pending hydrate was consumed; nothing plays
    expect(playTrackSpy).not.toHaveBeenCalled();
  });

  it('skips tracks the adapter reports as unplayable via probePlayable without calling prepareTrack', async () => {
    // #given — first candidate probes as unplayable (file moved / market-restricted),
    // second probes playable. Because real adapters swallow prepareTrack errors
    // internally, probePlayable is the real skip signal.
    mockPrepareTrack.mockReset();
    mockProbePlayable
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    let hydrateResult!: Awaited<ReturnType<typeof result.current.handlers.handleHydrate>>;
    await act(async () => {
      hydrateResult = await result.current.handlers.handleHydrate(session);
    });

    // #then — advanced to the second track; prepareTrack only ran for the playable one
    expect(hydrateResult.track?.id).toBe('track-b');
    expect(hydrateResult.skipped).toBe(true);
    expect(mockProbePlayable).toHaveBeenCalledTimes(2);
    expect(mockPrepareTrack).toHaveBeenCalledTimes(1);
    expect(mockPrepareTrack.mock.calls[0][0].id).toBe('track-b');
  });

  it('aborts to library when probePlayable throws AuthExpiredError on every candidate', async () => {
    // #given — provider auth is stale; probes throw for each candidate
    const { AuthExpiredError } = await import('@/providers/errors');
    mockProbePlayable.mockRejectedValue(new AuthExpiredError('spotify'));
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    let hydrateResult!: Awaited<ReturnType<typeof result.current.handlers.handleHydrate>>;
    await act(async () => {
      hydrateResult = await result.current.handlers.handleHydrate(session);
    });

    // #then
    expect(hydrateResult.totalFailure).toBe(true);
    expect(mockPrepareTrack).not.toHaveBeenCalled();
  });

  it('lets a subsequent handlePlay start the fallback track at position 0', async () => {
    // #given — first throws, second succeeds; fallback should lose the saved position
    mockPrepareTrack
      .mockImplementationOnce(() => { throw new UnavailableTrackError('Song A'); })
      .mockImplementationOnce(() => {});
    const session = makeSession({ playbackPosition: 90_000 });
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });
    playTrackSpy.mockClear();

    // #when
    await act(async () => {
      await result.current.handlers.handlePlay();
    });

    // #then — handlePlay consumed the pending-play ref at index 1 with no positionMs
    expect(playTrackSpy).toHaveBeenCalledTimes(1);
    const [idx, skipOnError, options] = playTrackSpy.mock.calls[0];
    expect(idx).toBe(1);
    expect(skipOnError).toBe(false);
    expect(options).toBeUndefined();
  });
});
