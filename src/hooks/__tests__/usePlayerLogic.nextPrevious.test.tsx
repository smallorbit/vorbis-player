/**
 * Tests for usePlayerLogic.handleNext / handlePrevious — verify that skipping
 * forward/back from a paused state auto-resumes playback (issue #1388). Skip
 * intent is "play this instead", not "queue and stay paused", matching how
 * Spotify and Apple Music handle skip-while-paused.
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
import type { ProviderId } from '@/types/domain';

const playTrackSpy = vi.fn();

vi.mock('@/hooks/usePlaylistManager', () => ({
  usePlaylistManager: vi.fn(() => ({ handlePlaylistSelect: vi.fn() })),
}));

vi.mock('@/hooks/useProviderPlayback', () => ({
  useProviderPlayback: vi.fn(() => ({
    playTrack: playTrackSpy,
    currentPlaybackProviderRef: { current: null as ProviderId | null },
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

const makeMockDescriptor = (id: ProviderId) => ({
  id,
  catalog: { listTracks: vi.fn().mockResolvedValue([]) },
  auth: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    beginLogin: vi.fn(),
    logout: vi.fn(),
  },
  playback: {
    initialize: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn(() => vi.fn()),
    prepareTrack: vi.fn(),
    probePlayable: vi.fn().mockResolvedValue(true),
  },
  capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true },
});

const spotifyDescriptor = makeMockDescriptor('spotify');
const dropboxDescriptor = makeMockDescriptor('dropbox');

let activeDescriptor: ReturnType<typeof makeMockDescriptor> = spotifyDescriptor;

vi.mock('@/contexts/ProviderContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/ProviderContext')>();
  return {
    ...actual,
    useProviderContext: vi.fn(() => ({
      activeDescriptor,
      setActiveProviderId: vi.fn(),
      getDescriptor: vi.fn((id: string) => (id === activeDescriptor.id ? activeDescriptor : undefined)),
      connectedProviderIds: [activeDescriptor.id],
      chosenProviderId: activeDescriptor.id,
      activeProviderId: activeDescriptor.id,
      setProviderSwitchInterceptor: vi.fn(),
      registry: {},
      needsProviderSelection: false,
      enabledProviderIds: [activeDescriptor.id],
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
    get: vi.fn((id?: ProviderId) => {
      if (id === 'spotify') return spotifyDescriptor;
      if (id === 'dropbox') return dropboxDescriptor;
      return activeDescriptor;
    }),
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
  const trackA = makeMediaTrack({ id: 'track-a', name: 'Song A', artists: 'Artist A', provider: activeDescriptor.id });
  const trackB = makeMediaTrack({ id: 'track-b', name: 'Song B', artists: 'Artist B', provider: activeDescriptor.id });
  const trackC = makeMediaTrack({ id: 'track-c', name: 'Song C', artists: 'Artist C', provider: activeDescriptor.id });
  return {
    collectionId: 'playlist-xyz',
    collectionName: 'My Playlist',
    collectionProvider: activeDescriptor.id,
    trackIndex: 1,
    trackId: 'track-b',
    queueTracks: [trackA, trackB, trackC],
    playbackPosition: 0,
    ...overrides,
  };
}

async function setupPausedQueue(startIndex = 1) {
  const session = makeSession({ trackIndex: startIndex, trackId: ['track-a', 'track-b', 'track-c'][startIndex] });
  const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });
  await act(async () => {
    await result.current.handlers.handleHydrate(session);
  });
  // After hydrate, queue is loaded but isPlaying is false (paused).
  playTrackSpy.mockClear();
  activeDescriptor.playback.resume.mockClear();
  return result;
}

describe.each([
  { providerName: 'spotify', descriptor: spotifyDescriptor },
  { providerName: 'dropbox', descriptor: dropboxDescriptor },
])('usePlayerLogic — handleNext / handlePrevious auto-resume ($providerName)', ({ descriptor }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    playTrackSpy.mockClear();
    activeDescriptor = descriptor;
  });

  it('handleNext from paused state advances to the next track via playTrack', async () => {
    // #given — paused player at index 1 of a 3-track queue
    const result = await setupPausedQueue(1);
    expect(result.current.state.isPlaying).toBe(false);

    // #when — user skips forward
    await act(async () => {
      await result.current.handlers.handleNext();
    });

    // #then — playTrack was called with the next index, advancing the track
    expect(playTrackSpy).toHaveBeenCalledTimes(1);
    expect(playTrackSpy.mock.calls[0][0]).toBe(2);
  });

  it('handleNext auto-resumes via the driving provider when previously paused', async () => {
    // #given — paused player at index 0
    const result = await setupPausedQueue(0);

    // #when
    await act(async () => {
      await result.current.handlers.handleNext();
    });

    // #then — resume() is invoked so the new track plays without a second tap
    expect(descriptor.playback.resume).toHaveBeenCalled();
  });

  it('handlePrevious from paused state moves to the previous track via playTrack', async () => {
    // #given — paused player at index 2
    const result = await setupPausedQueue(2);

    // #when
    await act(async () => {
      await result.current.handlers.handlePrevious();
    });

    // #then
    expect(playTrackSpy).toHaveBeenCalledTimes(1);
    expect(playTrackSpy.mock.calls[0][0]).toBe(1);
  });

  it('handlePrevious auto-resumes via the driving provider when previously paused', async () => {
    // #given — paused player at index 2
    const result = await setupPausedQueue(2);

    // #when
    await act(async () => {
      await result.current.handlers.handlePrevious();
    });

    // #then
    expect(descriptor.playback.resume).toHaveBeenCalled();
  });

  it('handleNext wraps around to the first track at the end of the queue', async () => {
    // #given — paused player at the last index
    const result = await setupPausedQueue(2);

    // #when
    await act(async () => {
      await result.current.handlers.handleNext();
    });

    // #then
    expect(playTrackSpy.mock.calls[0][0]).toBe(0);
    expect(descriptor.playback.resume).toHaveBeenCalled();
  });

  it('handlePrevious wraps to the last track from index 0', async () => {
    // #given — paused player at the first index
    const result = await setupPausedQueue(0);

    // #when
    await act(async () => {
      await result.current.handlers.handlePrevious();
    });

    // #then
    expect(playTrackSpy.mock.calls[0][0]).toBe(2);
    expect(descriptor.playback.resume).toHaveBeenCalled();
  });

  it('handleNext is a no-op on an empty queue', async () => {
    // #given
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #when
    await act(async () => {
      await result.current.handlers.handleNext();
    });

    // #then
    expect(playTrackSpy).not.toHaveBeenCalled();
    expect(descriptor.playback.resume).not.toHaveBeenCalled();
  });
});
