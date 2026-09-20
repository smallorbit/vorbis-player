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
import { makeMediaTrack, makeProviderDescriptor, makePlaybackProvider, makeCapabilities } from '@/test/fixtures';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import type { ProviderId, PlaybackState } from '@/types/domain';
import { defined } from '@/test/defined';

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
    radioState: { isActive: false, isGenerating: false, error: null, lastMatchStats: null },
    startRadio: vi.fn(),
    stopRadio: vi.fn(),
    isRadioAvailable: true,
  })),
}));

const makeMockDescriptor = (id: ProviderId) => {
  const resume = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const subscribe = vi.fn<(listener: (state: PlaybackState | null) => void) => () => void>().mockReturnValue(vi.fn());
  const descriptor = makeProviderDescriptor({
    id,
    name: id === 'dropbox' ? 'Dropbox' : 'Spotify',
    capabilities: makeCapabilities({ hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true }),
    auth: {
      providerId: id,
      isAuthenticated: vi.fn().mockReturnValue(true),
      getAccessToken: vi.fn(),
      beginLogin: vi.fn(),
      handleCallback: vi.fn().mockResolvedValue(false),
      logout: vi.fn(),
    },
    playback: makePlaybackProvider({
      providerId: id,
      resume,
      subscribe,
      prepareTrack: vi.fn(),
      probePlayable: vi.fn().mockResolvedValue(true),
    }),
  });
  return { descriptor, resume, subscribe };
};

const spotifyDescriptor = makeMockDescriptor('spotify');
const dropboxDescriptor = makeMockDescriptor('dropbox');

let activeDescriptor: ReturnType<typeof makeMockDescriptor> = spotifyDescriptor;

vi.mock('@/contexts/ProviderContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/ProviderContext')>();
  return {
    ...actual,
    useProviderContext: vi.fn(() => ({
      activeDescriptor: activeDescriptor.descriptor,
      setActiveProviderId: vi.fn(),
      getDescriptor: vi.fn((id: string) => (id === activeDescriptor.descriptor.id ? activeDescriptor.descriptor : undefined)),
      connectedProviderIds: [activeDescriptor.descriptor.id],
      chosenProviderId: activeDescriptor.descriptor.id,
      activeProviderId: activeDescriptor.descriptor.id,
      setProviderSwitchInterceptor: vi.fn(),
      registry: {},
      needsProviderSelection: false,
      enabledProviderIds: [activeDescriptor.descriptor.id],
      toggleProvider: vi.fn(),
      isProviderEnabled: vi.fn(() => true),
      hasMultipleProviders: false,
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
      if (id === 'spotify') return spotifyDescriptor.descriptor;
      if (id === 'dropbox') return dropboxDescriptor.descriptor;
      return activeDescriptor.descriptor;
    }),
    // playbackStore.attach() fans out over getAll() — the descriptors must be
    // registered here for their subscribe() to feed the store's pipeline.
    getAll: vi.fn(() => [spotifyDescriptor.descriptor, dropboxDescriptor.descriptor]),
    has: vi.fn((id: ProviderId) => id === 'spotify' || id === 'dropbox'),
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
  const trackA = makeMediaTrack({ id: 'track-a', name: 'Song A', artists: 'Artist A', provider: activeDescriptor.descriptor.id });
  const trackB = makeMediaTrack({ id: 'track-b', name: 'Song B', artists: 'Artist B', provider: activeDescriptor.descriptor.id });
  const trackC = makeMediaTrack({ id: 'track-c', name: 'Song C', artists: 'Artist C', provider: activeDescriptor.descriptor.id });
  return {
    selection: {
      type: 'collection',
      ref: { provider: activeDescriptor.descriptor.id, kind: 'playlist', id: 'playlist-xyz' },
      name: 'My Playlist',
    },
    collectionName: 'My Playlist',
    trackIndex: 1,
    trackId: 'track-b',
    queueTracks: [trackA, trackB, trackC],
    playbackPosition: 0,
    ...overrides,
  };
}

async function setupPausedQueue(startIndex = 1) {
  const ids = ['track-a', 'track-b', 'track-c'] as const;
  const session = makeSession({ trackIndex: startIndex, trackId: defined(ids[startIndex]) });
  const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });
  await act(async () => {
    await result.current.handlers.restoreSession(session, { autoplay: false });
  });
  // After hydrate, queue is loaded but isPlaying is false (paused).
  playTrackSpy.mockClear();
  activeDescriptor.resume.mockClear();
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
    expect(defined(defined(playTrackSpy.mock.calls[0])[0])).toBe(2);
  });

  it('handleNext auto-resumes via the driving provider when previously paused', async () => {
    // #given — paused player at index 0
    const result = await setupPausedQueue(0);

    // #when
    await act(async () => {
      await result.current.handlers.handleNext();
    });

    // #then — resume() is invoked so the new track plays without a second tap
    expect(descriptor.resume).toHaveBeenCalled();
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
    expect(defined(defined(playTrackSpy.mock.calls[0])[0])).toBe(1);
  });

  it('handlePrevious auto-resumes via the driving provider when previously paused', async () => {
    // #given — paused player at index 2
    const result = await setupPausedQueue(2);

    // #when
    await act(async () => {
      await result.current.handlers.handlePrevious();
    });

    // #then
    expect(descriptor.resume).toHaveBeenCalled();
  });

  it('handleNext is a no-op at the end of the queue', async () => {
    // #given — paused player at the last index
    const result = await setupPausedQueue(2);

    // #when
    await act(async () => {
      await result.current.handlers.handleNext();
    });

    // #then — queue is finite: no playback initiated, index unchanged
    expect(playTrackSpy).not.toHaveBeenCalled();
    expect(descriptor.resume).not.toHaveBeenCalled();
  });

  it('handlePrevious restarts the first track from index 0', async () => {
    // #given — paused player at the first index
    const result = await setupPausedQueue(0);

    // #when
    await act(async () => {
      await result.current.handlers.handlePrevious();
    });

    // #then — clamps at the queue start and replays track 0
    expect(defined(defined(playTrackSpy.mock.calls[0])[0])).toBe(0);
    expect(descriptor.resume).toHaveBeenCalled();
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
    expect(descriptor.resume).not.toHaveBeenCalled();
  });

  it('handleNext still advances when descriptor.playback.resume rejects', async () => {
    // #given — paused player; resume rejects with an autoplay-policy-style error
    const result = await setupPausedQueue(0);
    descriptor.resume.mockRejectedValueOnce(new Error('autoplay-blocked'));

    // #when — handleNext awaits resume, but the rejection is swallowed by
    // ensurePlaybackResumed's try/catch and must not bubble out of handleNext.
    let thrown: unknown = null;
    await act(async () => {
      try {
        await result.current.handlers.handleNext();
      } catch (e) {
        thrown = e;
      }
    });

    // #then — handleNext resolved cleanly, the index advanced, and playTrack
    // was invoked exactly once for the next slot
    expect(thrown).toBeNull();
    expect(playTrackSpy).toHaveBeenCalledTimes(1);
    expect(defined(defined(playTrackSpy.mock.calls[0])[0])).toBe(1);
  });

  it('handleNext invokes resume *after* playTrack (preserves ordering)', async () => {
    // #given — paused player at index 0
    const result = await setupPausedQueue(0);

    // #when
    await act(async () => {
      await result.current.handlers.handleNext();
    });

    // #then — vitest's invocationCallOrder is a monotonically-increasing global
    // counter across every vi.fn() call, so a strictly-greater order proves
    // resume() landed AFTER playTrack(). This guards against a future
    // optimisation that races resume ahead of playTrack and leaves the
    // adapter pointed at the prior track.
    expect(playTrackSpy).toHaveBeenCalledTimes(1);
    expect(descriptor.resume).toHaveBeenCalledTimes(1);
    const playTrackOrder = defined(playTrackSpy.mock.invocationCallOrder[0]);
    const resumeOrder = defined(descriptor.resume.mock.invocationCallOrder[0]);
    expect(resumeOrder).toBeGreaterThan(playTrackOrder);
  });

  it('handleNext invokes resume even when already playing (race-guard)', async () => {
    // #given — paused queue, then a subscription event raises isPlaying to true
    // before the user-initiated skip lands
    const result = await setupPausedQueue(0);

    expect(descriptor.subscribe).toHaveBeenCalled();
    const stateCallback = defined(defined(descriptor.subscribe.mock.calls[0])[0]);
    expect(typeof stateCallback).toBe('function');

    await act(async () => {
      stateCallback({
        isPlaying: true,
        positionMs: 1000,
        durationMs: 60_000,
        currentTrackId: 'track-a',
        currentPlaybackRef: { provider: descriptor.descriptor.id, ref: `${descriptor.descriptor.id}:track:track-a` },
      });
    });

    expect(result.current.state.isPlaying).toBe(true);

    // #when
    await act(async () => {
      await result.current.handlers.handleNext();
    });

    // #then — resume must still be called exactly once, even though we entered
    // handleNext with isPlaying=true. A future "if (!isPlaying) resume()"
    // optimisation would silently regress this and leave the new track stuck
    // in the prior track's resumed-at-position state on adapters that don't
    // auto-fire resume from playTrack.
    expect(playTrackSpy).toHaveBeenCalledTimes(1);
    expect(descriptor.resume).toHaveBeenCalledTimes(1);
  });
});
