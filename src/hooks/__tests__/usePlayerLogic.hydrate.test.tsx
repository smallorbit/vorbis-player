/**
 * Tests for usePlayerLogic.handleHydrate — restores session state without autoplay.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../usePlayerLogic';
import { TrackProvider } from '@/contexts/TrackContext';
import { VisualEffectsProvider } from '@/contexts/visualEffects';
import { ColorProvider } from '@/contexts/ColorContext';
import { ProviderProvider } from '@/contexts/ProviderContext';
import { makeMediaTrack } from '@/test/fixtures';
import type { SessionSnapshot } from '@/services/sessionPersistence';

const playTrackSpy = vi.fn();
const mockPrepareTrack = vi.fn();

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
    isAuthenticated: vi.fn().mockReturnValue(true),
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
    trackIndex: 1,
    trackId: 'track-b',
    queueTracks: [trackA, trackB],
    playbackPosition: 42_000,
    ...overrides,
  };
}

describe('usePlayerLogic — handleHydrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playTrackSpy.mockClear();
    mockPrepareTrack.mockClear();
  });

  it('restores queue state and paused position without calling playTrack', async () => {
    // #given
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });

    // #then
    expect(result.current.state.tracks).toHaveLength(2);
    expect(result.current.state.tracks[0].id).toBe('track-a');
    expect(result.current.state.tracks[1].id).toBe('track-b');
    expect(result.current.state.selectedPlaylistId).toBe('playlist-xyz');
    expect(result.current.state.isPlaying).toBe(false);
    expect(result.current.state.playbackPosition).toBe(42_000);
    expect(playTrackSpy).not.toHaveBeenCalled();
  });

  it('calls prepareTrack with the resolved track and saved positionMs', async () => {
    // #given
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });

    // #then
    expect(mockPrepareTrack).toHaveBeenCalledTimes(1);
    const [passedTrack, passedOptions] = mockPrepareTrack.mock.calls[0];
    expect(passedTrack.id).toBe('track-b');
    expect(passedOptions).toEqual({ positionMs: 42_000 });
  });

  it('omits positionMs option when saved position is missing or zero', async () => {
    // #given
    const session = makeSession({ playbackPosition: 0 });
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });

    // #then
    expect(result.current.state.playbackPosition).toBe(0);
    expect(mockPrepareTrack).toHaveBeenCalledTimes(1);
    const passedOptions = mockPrepareTrack.mock.calls[0][1];
    expect(passedOptions).toBeUndefined();
  });

  it('resolves target index by trackId when it exists in the queue', async () => {
    // #given — trackIndex points at 0, but trackId matches track at position 1
    const session = makeSession({ trackIndex: 0, trackId: 'track-b' });
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });

    // #then
    expect(mockPrepareTrack.mock.calls[0][0].id).toBe('track-b');
  });

  it('triggers playTrack with saved positionMs on the next handlePlay', async () => {
    // #given
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });
    playTrackSpy.mockClear();

    // #when
    await act(async () => {
      await result.current.handlers.handlePlay();
    });

    // #then
    expect(playTrackSpy).toHaveBeenCalledTimes(1);
    const [index, skipOnError, options] = playTrackSpy.mock.calls[0];
    expect(index).toBe(1);
    expect(skipOnError).toBe(false);
    expect(options).toEqual({ positionMs: 42_000 });
  });

  it('does not re-trigger playTrack on a second handlePlay after hydrate', async () => {
    // #given
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    await act(async () => {
      await result.current.handlers.handleHydrate(session);
      await result.current.handlers.handlePlay();
    });
    playTrackSpy.mockClear();

    // #when — a second press should fall through to the normal resume path
    await act(async () => {
      await result.current.handlers.handlePlay();
    });

    // #then
    expect(playTrackSpy).not.toHaveBeenCalled();
    expect(mockDescriptor.playback.resume).toHaveBeenCalled();
  });

  it('no-ops when session has no queueTracks', async () => {
    // #given
    const session = makeSession({ queueTracks: [] });
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });

    // #then
    expect(result.current.state.tracks).toHaveLength(0);
    expect(result.current.state.selectedPlaylistId).toBeNull();
    expect(mockPrepareTrack).not.toHaveBeenCalled();
    expect(playTrackSpy).not.toHaveBeenCalled();
  });

  it('discards a pending hydrate when handleNext runs first', async () => {
    // #given
    const session = makeSession();
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    await act(async () => {
      await result.current.handlers.handleHydrate(session);
    });
    playTrackSpy.mockClear();

    // #when — user skips to next, consuming playback routing without the hydrate options
    await act(async () => {
      result.current.handlers.handleNext();
    });
    const nextCall = playTrackSpy.mock.calls.at(-1);
    playTrackSpy.mockClear();
    await act(async () => {
      await result.current.handlers.handlePlay();
    });

    // #then — handleNext took over; subsequent handlePlay uses resume, not a hydrated start
    expect(nextCall?.[0]).toBe(0); // wrapped around from index 1 -> 0 in a 2-track queue
    expect(playTrackSpy).not.toHaveBeenCalled();
    expect(mockDescriptor.playback.resume).toHaveBeenCalled();
  });
});
