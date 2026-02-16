import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../../hooks/usePlayerLogic';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePlayerState } from '../../hooks/usePlayerState';

// Mock all dependencies
vi.mock('../../hooks/usePlayerState', () => ({
  usePlayerState: vi.fn()
}));

vi.mock('../../hooks/usePlaylistManager', () => ({
  usePlaylistManager: vi.fn(() => ({
    handlePlaylistSelect: vi.fn()
  }))
}));

vi.mock('../../hooks/useSpotifyPlayback', () => ({
  useSpotifyPlayback: vi.fn(() => ({
    playTrack: vi.fn()
  }))
}));

vi.mock('../../hooks/useAutoAdvance', () => ({
  useAutoAdvance: vi.fn()
}));

vi.mock('../../hooks/useAccentColor', () => ({
  useAccentColor: vi.fn(() => ({
    handleAccentColorChange: vi.fn()
  }))
}));

vi.mock('../../hooks/useVisualEffectsState', () => ({
  useVisualEffectsState: vi.fn(() => ({
    effectiveGlow: { intensity: 50, rate: 50 },
    handleGlowIntensityChange: vi.fn(),
    handleGlowRateChange: vi.fn(),
    restoreGlowSettings: vi.fn()
  }))
}));

vi.mock('../../hooks/useVolume', () => ({
  useVolume: vi.fn(() => ({
    handleMuteToggle: vi.fn()
  }))
}));

vi.mock('../../services/spotify', () => ({
  spotifyAuth: {
    handleRedirect: vi.fn().mockResolvedValue(undefined)
  },
  checkTrackSaved: vi.fn().mockResolvedValue(false),
  saveTrack: vi.fn().mockResolvedValue(undefined),
  unsaveTrack: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../services/spotifyPlayer', () => ({
  spotifyPlayer: {
    onPlayerStateChanged: vi.fn(),
    getCurrentState: vi.fn().mockResolvedValue(null),
    resume: vi.fn(),
    pause: vi.fn()
  }
}));

describe('Keyboard Shortcuts Integration', () => {
  const mockUsePlayerState = usePlayerState as ReturnType<typeof vi.fn>;

  const defaultState = {
    track: { 
      tracks: [
        { 
          id: 'track-1', 
          name: 'Test Track', 
          artists: 'Test Artist',
          album: 'Test Album',
          duration_ms: 180000,
          uri: 'spotify:track:123',
          image: 'https://example.com/image.jpg'
        }
      ], 
      currentIndex: 0, 
      isLoading: false, 
      error: null 
    },
    playlist: { selectedId: 'playlist-1', isVisible: false },
    color: { current: '#000000', overrides: {} },
    visualEffects: {
      enabled: true,
      menuVisible: false,
      filters: { brightness: 110, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0 },
      backgroundVisualizer: { enabled: false, style: 'particles', intensity: 60 },
      accentColorBackground: { enabled: false, preferred: false },
      perAlbumGlow: {},
      savedFilters: null
    },
    actions: {
      track: { 
        setTracks: vi.fn(), 
        setCurrentIndex: vi.fn(), 
        setLoading: vi.fn(), 
        setError: vi.fn() 
      },
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
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlayerState.mockReturnValue(defaultState);
  });

  it('should expose handleLikeToggle from usePlayerLogic', () => {
    const { result } = renderHook(() => usePlayerLogic());
    
    expect(result.current.handlers).toHaveProperty('handleLikeToggle');
    expect(typeof result.current.handlers.handleLikeToggle).toBe('function');
  });



  it('should handle all keyboard shortcuts in PlayerContent context', () => {
    const handlers = {
      onPlayPause: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
      onTogglePlaylist: vi.fn(),
      onClosePlaylist: vi.fn(),
      onToggleVisualEffectsMenu: vi.fn(),
      onCloseVisualEffects: vi.fn(),
      onToggleBackgroundVisualizer: vi.fn(),
      onToggleGlow: vi.fn(),
      onMute: vi.fn(),
      onToggleLike: vi.fn(),
      onToggleHelp: vi.fn()
    };

    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts(handlers));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;
    
    // Test each shortcut
    const tests = [
      { key: 'Space', handler: handlers.onPlayPause },
      { key: 'ArrowLeft', handler: handlers.onPrevious },
      { key: 'ArrowRight', handler: handlers.onNext },
      { key: 'KeyP', handler: handlers.onTogglePlaylist },
      { key: 'KeyM', handler: handlers.onMute },
      { key: 'KeyL', handler: handlers.onToggleLike },
      { key: 'KeyG', handler: handlers.onToggleGlow },
      { key: 'KeyV', handler: handlers.onToggleBackgroundVisualizer },
      { key: 'KeyO', handler: handlers.onToggleVisualEffectsMenu },
    ];

    tests.forEach(({ key, handler: expectedHandler }) => {
      const event = new KeyboardEvent('keydown', { code: key, bubbles: true });
      Object.defineProperty(event, 'target', { value: document.body, enumerable: true });
      handler(event);
      expect(expectedHandler).toHaveBeenCalled();
    });

    addEventListenerSpy.mockRestore();
  });

  it('should not trigger shortcuts when typing in form fields', () => {
    const handlers = {
      onToggleLike: vi.fn(),
      onTogglePlaylist: vi.fn(),
      onPlayPause: vi.fn()
    };

    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    
    renderHook(() => useKeyboardShortcuts(handlers));
    
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;

    // Create input and textarea elements
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');

    // Test input field
    const inputEvent = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    Object.defineProperty(inputEvent, 'target', { value: input, enumerable: true });
    handler(inputEvent);
    expect(handlers.onPlayPause).not.toHaveBeenCalled();

    // Test textarea field
    const textareaEvent = new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true });
    Object.defineProperty(textareaEvent, 'target', { value: textarea, enumerable: true });
    handler(textareaEvent);
    expect(handlers.onTogglePlaylist).not.toHaveBeenCalled();

    // Test that normal element still works
    const bodyEvent = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    Object.defineProperty(bodyEvent, 'target', { value: document.body, enumerable: true });
    handler(bodyEvent);
    expect(handlers.onPlayPause).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
  });
});
