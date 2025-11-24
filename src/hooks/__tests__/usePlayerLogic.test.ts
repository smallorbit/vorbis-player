import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { usePlayerLogic } from '../usePlayerLogic';
import { usePlayerState } from '../usePlayerState';

// Mock usePlayerState
vi.mock('../usePlayerState', () => ({
  usePlayerState: vi.fn()
}));

// Mock other hooks
vi.mock('../usePlaylistManager', () => ({
  usePlaylistManager: vi.fn(() => ({
    handlePlaylistSelect: vi.fn()
  }))
}));

vi.mock('../useSpotifyPlayback', () => ({
  useSpotifyPlayback: vi.fn(() => ({
    playTrack: vi.fn()
  }))
}));

vi.mock('../useAutoAdvance', () => ({
  useAutoAdvance: vi.fn()
}));

vi.mock('../useAccentColor', () => ({
  useAccentColor: vi.fn(() => ({
    handleAccentColorChange: vi.fn()
  }))
}));

vi.mock('../useVisualEffectsState', () => ({
  useVisualEffectsState: vi.fn(() => ({
    effectiveGlow: { intensity: 50, rate: 50 },
    handleGlowIntensityChange: vi.fn(),
    handleGlowRateChange: vi.fn(),
    restoreGlowSettings: vi.fn()
  }))
}));

// Mock services
vi.mock('../../services/spotify', () => ({
  spotifyAuth: {
    handleRedirect: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../services/spotifyPlayer', () => ({
  spotifyPlayer: {
    onPlayerStateChanged: vi.fn(),
    getCurrentState: vi.fn().mockResolvedValue(null),
    resume: vi.fn(),
    pause: vi.fn()
  }
}));

// ... imports ...

describe('usePlayerLogic', () => {
  const mockUsePlayerState = usePlayerState as Mock;

  const defaultState = {
    track: { tracks: [], currentIndex: 0, isLoading: false, error: null },
    playlist: { selectedId: null, isVisible: false },
    color: { current: '#000000', overrides: {} },
    visualEffects: {
      enabled: true,
      menuVisible: false,
      filters: {},
      backgroundVisualizer: { enabled: false, style: 'particles', intensity: 60 },
      accentColorBackground: { enabled: false, preferred: false },
      perAlbumGlow: {},
      savedFilters: null
    },
    debug: { enabled: false },
    actions: {
      track: { setTracks: vi.fn(), setCurrentIndex: vi.fn(), setLoading: vi.fn(), setError: vi.fn() },
      playlist: { setSelectedId: vi.fn(), setVisible: vi.fn() },
      color: { setCurrent: vi.fn(), setOverrides: vi.fn() },
      visualEffects: {
        setEnabled: vi.fn(),
        setMenuVisible: vi.fn(),
        handleFilterChange: vi.fn(),
        handleResetFilters: vi.fn(),
        restoreSavedFilters: vi.fn(),
        setPerAlbumGlow: vi.fn(),
        setFilters: vi.fn(),
        backgroundVisualizer: {
          setEnabled: vi.fn(),
          setStyle: vi.fn(),
          setIntensity: vi.fn()
        },
        accentColorBackground: {
          setPreferred: vi.fn()
        }
      },
      debug: { setEnabled: vi.fn() }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlayerState.mockReturnValue(defaultState);
  });

  it('should return state and handlers', () => {
    const { result } = renderHook(() => usePlayerLogic());

    expect(result.current).toHaveProperty('state');
    expect(result.current).toHaveProperty('handlers');
  });

  it('should expose track state', () => {
    const tracks = [{ id: '1', name: 'Track 1' }];
    mockUsePlayerState.mockReturnValue({
        ...defaultState,
        track: { ...defaultState.track, tracks }
    });

    const { result } = renderHook(() => usePlayerLogic());

    expect(result.current.state.tracks).toEqual(tracks);
  });
});
