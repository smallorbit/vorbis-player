/**
 * Tests for usePlayerLogic queue operations: add, remove, reorder.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../usePlayerLogic';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { TrackProvider } from '@/contexts/TrackContext';
import { VisualEffectsProvider } from '@/contexts/VisualEffectsContext';
import { ColorProvider } from '@/contexts/ColorContext';
import { ProviderProvider } from '@/contexts/ProviderContext';
import { makeMediaTrack } from '@/test/fixtures';

const playTrackSpy = vi.fn();

vi.mock('@/hooks/usePlaylistManager', () => ({
  usePlaylistManager: vi.fn(() => ({ handlePlaylistSelect: vi.fn() })),
}));

vi.mock('@/hooks/useSpotifyPlayback', () => ({
  useSpotifyPlayback: vi.fn(() => ({
    playTrack: playTrackSpy,
    resumePlayback: vi.fn(),
    currentPlaybackProviderRef: { current: 'spotify' as const },
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

const useRadioMock = vi.fn();
vi.mock('@/hooks/useRadio', () => ({
  useRadio: (...args: unknown[]) => useRadioMock(...args),
}));

const mockListTracks = vi.fn().mockResolvedValue([]);
const mockDescriptor = {
  id: 'spotify' as const,
  catalog: { listTracks: mockListTracks },
  playback: { initialize: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), resume: vi.fn(), playTrack: vi.fn(), getState: vi.fn().mockResolvedValue(null), subscribe: vi.fn(() => vi.fn()), prepareTrack: undefined },
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

vi.mock('@/services/spotifyResolver', () => ({
  resolveViaSpotify: vi.fn().mockResolvedValue([]),
}));

const defaultRadioReturn = {
  radioState: { isActive: false, seedDescription: null, isGenerating: false, error: null, lastMatchStats: null },
  stopRadio: vi.fn(),
  isRadioAvailable: true,
};

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

/** Hook that exposes both track context and player logic. */
function useTrackContextAndPlayerLogic() {
  const trackList = useTrackListContext();
  const currentTrackContext = useCurrentTrackContext();
  const playerLogic = usePlayerLogic();
  return { ...trackList, ...currentTrackContext, ...playerLogic };
}

describe('usePlayerLogic — queue operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playTrackSpy.mockClear();
    mockListTracks.mockResolvedValue([]);
    useRadioMock.mockReturnValue(defaultRadioReturn);
  });

  it('handleRemoveFromQueue removes a track by index', () => {
    const t1 = makeMediaTrack({ id: 'track-1', name: 'Track 1', artists: 'Artist A' });
    const t2 = makeMediaTrack({ id: 'track-2', name: 'Track 2', artists: 'Artist B' });
    const t3 = makeMediaTrack({ id: 'track-3', name: 'Track 3', artists: 'Artist C' });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([t1, t2, t3]);
      result.current.setCurrentTrackIndex(0);
    });

    act(() => {
      result.current.handlers.handleRemoveFromQueue(1);
    });

    expect(result.current.state.tracks).toHaveLength(2);
    expect(result.current.state.tracks[0].id).toBe('track-1');
    expect(result.current.state.tracks[1].id).toBe('track-3');
  });

  it('handleRemoveFromQueue does not remove the currently playing track', () => {
    const t1 = makeMediaTrack({ id: 'track-1', name: 'Track 1', artists: 'Artist A' });
    const t2 = makeMediaTrack({ id: 'track-2', name: 'Track 2', artists: 'Artist B' });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([t1, t2]);
      result.current.setCurrentTrackIndex(0);
    });

    act(() => {
      result.current.handlers.handleRemoveFromQueue(0);
    });

    // Should not remove current track
    expect(result.current.state.tracks).toHaveLength(2);
    expect(result.current.state.tracks[0].id).toBe('track-1');
  });

  it('handleRemoveFromQueue adjusts currentTrackIndex when removing before current', () => {
    const t1 = makeMediaTrack({ id: 'track-1', name: 'Track 1', artists: 'Artist A' });
    const t2 = makeMediaTrack({ id: 'track-2', name: 'Track 2', artists: 'Artist B' });
    const t3 = makeMediaTrack({ id: 'track-3', name: 'Track 3', artists: 'Artist C' });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([t1, t2, t3]);
      result.current.setCurrentTrackIndex(2);
    });

    act(() => {
      result.current.handlers.handleRemoveFromQueue(0);
    });

    expect(result.current.state.tracks).toHaveLength(2);
    expect(result.current.currentTrackIndex).toBe(1);
  });

  it('handleReorderQueue moves a track from one position to another', () => {
    const t1 = makeMediaTrack({ id: 'track-1', name: 'Track 1', artists: 'Artist A' });
    const t2 = makeMediaTrack({ id: 'track-2', name: 'Track 2', artists: 'Artist B' });
    const t3 = makeMediaTrack({ id: 'track-3', name: 'Track 3', artists: 'Artist C' });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([t1, t2, t3]);
      result.current.setCurrentTrackIndex(0);
    });

    act(() => {
      result.current.handlers.handleReorderQueue(0, 2);
    });

    expect(result.current.state.tracks).toHaveLength(3);
    expect(result.current.state.tracks[0].id).toBe('track-2');
    expect(result.current.state.tracks[1].id).toBe('track-3');
    expect(result.current.state.tracks[2].id).toBe('track-1');
  });

  it('handleReorderQueue keeps currentTrackIndex tracking the playing track', () => {
    const t1 = makeMediaTrack({ id: 'track-1', name: 'Track 1', artists: 'Artist A' });
    const t2 = makeMediaTrack({ id: 'track-2', name: 'Track 2', artists: 'Artist B' });
    const t3 = makeMediaTrack({ id: 'track-3', name: 'Track 3', artists: 'Artist C' });

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([t1, t2, t3]);
      result.current.setCurrentTrackIndex(0);
    });

    act(() => {
      result.current.handlers.handleReorderQueue(0, 2);
    });

    // The current track (previously at 0) should now be at index 2
    expect(result.current.currentTrackIndex).toBe(2);
    expect(result.current.state.tracks[result.current.currentTrackIndex].id).toBe('track-1');
  });
});

describe('usePlayerLogic — handleAddToQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playTrackSpy.mockClear();
    mockListTracks.mockResolvedValue([]);
    useRadioMock.mockReturnValue(defaultRadioReturn);
  });

  it('delegates to handlePlaylistSelect when queue is empty', async () => {
    const newTrack1 = makeMediaTrack({ id: 'new-1', name: 'New Track 1', artists: 'New Artist' });
    const newTrack2 = makeMediaTrack({ id: 'new-2', name: 'New Track 2', artists: 'New Artist' });

    mockListTracks.mockResolvedValue([newTrack1, newTrack2]);

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([]);
      result.current.setCurrentTrackIndex(-1);
    });

    await act(async () => {
      await result.current.handlers.handleAddToQueue('pl-test', 'Test Playlist');
    });

    // After adding to empty queue, tracks should be loaded
    expect(result.current.state.tracks.length).toBeGreaterThan(0);
  });

  it('appends tracks to an existing queue without changing currentTrackIndex', async () => {
    const t1 = makeMediaTrack({ id: 'track-1', name: 'Track 1', artists: 'Artist A' });
    const t2 = makeMediaTrack({ id: 'track-2', name: 'Track 2', artists: 'Artist B' });
    const newT1 = makeMediaTrack({ id: 'new-1', name: 'New Track 1', artists: 'New Artist' });
    const newT2 = makeMediaTrack({ id: 'new-2', name: 'New Track 2', artists: 'New Artist' });

    mockListTracks.mockResolvedValue([newT1, newT2]);

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([t1, t2]);
      result.current.setCurrentTrackIndex(0);
    });

    await act(async () => {
      await result.current.handlers.handleAddToQueue('pl-new', 'New Playlist');
    });

    expect(result.current.state.tracks).toHaveLength(4);
    expect(result.current.currentTrackIndex).toBe(0);
    expect(result.current.state.tracks[0].id).toBe('track-1');
    expect(result.current.state.tracks[2].id).toBe('new-1');
    expect(result.current.state.tracks[3].id).toBe('new-2');
  });

  it('returns null when listTracks returns empty', async () => {
    const t1 = makeMediaTrack({ id: 'track-1', name: 'Track 1', artists: 'Artist A' });

    mockListTracks.mockResolvedValue([]);

    const { result } = renderHook(() => useTrackContextAndPlayerLogic(), { wrapper: AllProviders });

    act(() => {
      result.current.setTracks([t1]);
      result.current.setCurrentTrackIndex(0);
    });

    let addResult: unknown;
    await act(async () => {
      addResult = await result.current.handlers.handleAddToQueue('pl-empty', 'Empty Playlist');
    });

    expect(addResult).toBeNull();
    expect(result.current.state.tracks).toHaveLength(1); // Unchanged
  });
});
