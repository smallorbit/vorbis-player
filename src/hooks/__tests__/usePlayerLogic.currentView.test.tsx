/**
 * Tests for usePlayerLogic — currentView state and showLibrary derivation (#1292).
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../usePlayerLogic';
import { TrackProvider } from '@/contexts/TrackContext';
import { VisualEffectsProvider } from '@/contexts/visualEffects';
import { ColorProvider } from '@/contexts/ColorContext';
import { ProviderProvider } from '@/contexts/ProviderContext';

vi.mock('@/hooks/usePlaylistManager', () => ({
  usePlaylistManager: vi.fn(() => ({ handlePlaylistSelect: vi.fn() })),
}));

vi.mock('@/providers/spotify/useSpotifyPlaylistManager', () => ({
  useSpotifyPlaylistManager: vi.fn(() => ({ handlePlaylistSelect: vi.fn() })),
}));

vi.mock('@/hooks/useProviderPlayback', () => ({
  useProviderPlayback: vi.fn(() => ({
    playTrack: vi.fn(),
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

vi.mock('@/hooks/useQueueThumbnailLoader', () => ({
  useQueueThumbnailLoader: vi.fn(),
}));

vi.mock('@/hooks/useQueueDurationLoader', () => ({
  useQueueDurationLoader: vi.fn(),
}));

vi.mock('@/hooks/useQueueManagement', () => ({
  useQueueManagement: vi.fn(() => ({
    handleAddToQueue: vi.fn(),
    queueTracksDirectly: vi.fn(),
    handleRemoveFromQueue: vi.fn(),
    handleReorderQueue: vi.fn(),
  })),
}));

vi.mock('@/hooks/useCollectionLoader', () => ({
  useCollectionLoader: vi.fn(() => ({
    loadCollection: vi.fn(),
    playTracksDirectly: vi.fn(),
  })),
}));

vi.mock('@/hooks/usePlaybackSubscription', () => ({
  usePlaybackSubscription: vi.fn(),
}));

vi.mock('@/hooks/useQueueBundlePrefetch', () => ({
  useQueueBundlePrefetch: vi.fn(),
}));

vi.mock('@/hooks/useRadioSession', () => ({
  useRadioSession: vi.fn(() => ({
    handleStartRadio: vi.fn(),
    stopRadio: vi.fn(),
    clearAuthExpired: vi.fn(),
  })),
}));

vi.mock('@/hooks/useRecentlyPlayedCollections', () => ({
  useRecentlyPlayedCollections: vi.fn(() => ({ record: vi.fn() })),
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockReturnValue(false),
    getAccessToken: vi.fn().mockReturnValue(null),
    ensureValidToken: vi.fn().mockResolvedValue(null),
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
    get: vi.fn(() => undefined),
    getAll: vi.fn(() => []),
    register: vi.fn(),
  },
}));

vi.mock('@/contexts/ProviderContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/ProviderContext')>();
  return {
    ...actual,
    useProviderContext: vi.fn(() => ({
      activeDescriptor: null,
      setActiveProviderId: vi.fn(),
      getDescriptor: vi.fn(() => undefined),
      connectedProviderIds: [],
      chosenProviderId: null,
      isUnifiedLikedActive: false,
    })),
  };
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProviderProvider>
    <TrackProvider>
      <ColorProvider>
        <VisualEffectsProvider>
          {children}
        </VisualEffectsProvider>
      </ColorProvider>
    </TrackProvider>
  </ProviderProvider>
);

describe('usePlayerLogic — currentView + showLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises currentView to "player"', () => {
    // #when
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });

    // #then
    expect(result.current.state.currentView).toBe('player');
  });

  it('initialises showLibrary to false (derived from currentView)', () => {
    // #when
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });

    // #then
    expect(result.current.state.showLibrary).toBe(false);
  });

  it('handleOpenLibrary sets currentView to "library"', () => {
    // #given
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });

    // #when
    act(() => {
      result.current.handlers.handleOpenLibrary();
    });

    // #then
    expect(result.current.state.currentView).toBe('library');
  });

  it('handleOpenLibrary sets showLibrary to true', () => {
    // #given
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });

    // #when
    act(() => {
      result.current.handlers.handleOpenLibrary();
    });

    // #then
    expect(result.current.state.showLibrary).toBe(true);
  });

  it('handleCloseLibrary sets currentView back to "player"', () => {
    // #given
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });
    act(() => { result.current.handlers.handleOpenLibrary(); });

    // #when
    act(() => {
      result.current.handlers.handleCloseLibrary();
    });

    // #then
    expect(result.current.state.currentView).toBe('player');
  });

  it('handleCloseLibrary sets showLibrary back to false', () => {
    // #given
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });
    act(() => { result.current.handlers.handleOpenLibrary(); });

    // #when
    act(() => {
      result.current.handlers.handleCloseLibrary();
    });

    // #then
    expect(result.current.state.showLibrary).toBe(false);
  });

  it('showLibrary stays in lockstep with currentView === "library"', () => {
    // #given
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });

    // #when — open
    act(() => { result.current.handlers.handleOpenLibrary(); });
    // #then
    expect(result.current.state.showLibrary).toBe(result.current.state.currentView === 'library');

    // #when — close
    act(() => { result.current.handlers.handleCloseLibrary(); });
    // #then
    expect(result.current.state.showLibrary).toBe(result.current.state.currentView === 'library');
  });

  it('handleBackToLibrary does not change currentView', () => {
    // #given — library is open
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });
    act(() => { result.current.handlers.handleOpenLibrary(); });
    expect(result.current.state.currentView).toBe('library');

    // #when
    act(() => {
      result.current.handlers.handleBackToLibrary();
    });

    // #then — currentView unchanged
    expect(result.current.state.currentView).toBe('library');
  });

  it('handleBackToLibrary does not change currentView when at player view', () => {
    // #given — currentView is 'player' (default)
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: Wrapper });
    expect(result.current.state.currentView).toBe('player');

    // #when
    act(() => {
      result.current.handlers.handleBackToLibrary();
    });

    // #then
    expect(result.current.state.currentView).toBe('player');
  });
});
