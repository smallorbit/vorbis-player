import React from 'react';
import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../../hooks/usePlayerLogic';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { TrackProvider } from '../../contexts/TrackContext';
import { VisualEffectsProvider } from '../../contexts/VisualEffectsContext';
import { ColorProvider } from '../../contexts/ColorContext';
import { ProviderProvider } from '../../contexts/ProviderContext';

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
  useAccentColor: vi.fn()
}));

vi.mock('../../services/spotify', () => ({
  spotifyAuth: {
    handleRedirect: vi.fn().mockResolvedValue(undefined),
    isAuthenticated: vi.fn().mockReturnValue(true),
    getAccessToken: vi.fn().mockReturnValue('test-token'),
    ensureValidToken: vi.fn().mockResolvedValue('test-token'),
    redirectToAuth: vi.fn(),
    logout: vi.fn(),
  },
  checkTrackSaved: vi.fn().mockResolvedValue(false),
  saveTrack: vi.fn().mockResolvedValue(undefined),
  unsaveTrack: vi.fn().mockResolvedValue(undefined),
  getUserLibraryInterleaved: vi.fn(),
  getPlaylistTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
  getLikedSongs: vi.fn(),
  getLikedSongsCount: vi.fn(),
}));

vi.mock('../../services/spotifyPlayer', () => ({
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
  }
}));

// Wrap renderHook with all providers
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

describe('Keyboard Shortcuts Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose core playback handlers from usePlayerLogic', () => {
    // #when
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    // #then
    expect(result.current.handlers).toHaveProperty('handlePlay');
    expect(result.current.handlers).toHaveProperty('handlePause');
    expect(result.current.handlers).toHaveProperty('handleNext');
    expect(result.current.handlers).toHaveProperty('handlePrevious');
    expect(result.current.handlers).toHaveProperty('loadCollection');
    expect(result.current.handlers).toHaveProperty('handleOpenLibraryDrawer');
    expect(result.current.handlers).toHaveProperty('handleBackToLibrary');
    expect(typeof result.current.handlers.handlePlay).toBe('function');
    expect(typeof result.current.handlers.handleNext).toBe('function');
  });

  it('should handle all keyboard shortcuts in PlayerContent context', () => {
    // #given
    const handlers = {
      onPlayPause: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
      onCloseQueue: vi.fn(),
      onToggleVisualEffectsMenu: vi.fn(),
      onCloseVisualEffects: vi.fn(),
      onToggleBackgroundVisualizer: vi.fn(),
      onToggleGlow: vi.fn(),
      onMute: vi.fn(),
      onToggleLike: vi.fn(),
      onToggleShuffle: vi.fn(),
      onToggleHelp: vi.fn()
    };

    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    renderHook(() => useKeyboardShortcuts(handlers));
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;

    const tests = [
      { key: 'Space', handler: handlers.onPlayPause },
      { key: 'ArrowLeft', handler: handlers.onPrevious },
      { key: 'ArrowRight', handler: handlers.onNext },
      { key: 'KeyM', handler: handlers.onMute },
      { key: 'KeyK', handler: handlers.onToggleLike },
      { key: 'KeyG', handler: handlers.onToggleGlow },
      { key: 'KeyV', handler: handlers.onToggleBackgroundVisualizer },
      { key: 'KeyS', handler: handlers.onToggleShuffle, shift: false },
    ];

    // #when
    tests.forEach(({ key, handler: expectedHandler, shift }) => {
      const event = new KeyboardEvent('keydown', { code: key, shiftKey: shift || false, bubbles: true });
      Object.defineProperty(event, 'target', { value: document.body, enumerable: true });
      handler(event);

      // #then
      expect(expectedHandler).toHaveBeenCalled();
    });

    addEventListenerSpy.mockRestore();
  });

  it('should not trigger shortcuts when typing in form fields', () => {
    // #given
    const handlers = {
      onToggleLike: vi.fn(),
      onToggleGlow: vi.fn(),
      onPlayPause: vi.fn()
    };

    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    renderHook(() => useKeyboardShortcuts(handlers));
    const handler = addEventListenerSpy.mock.calls[0][1] as EventListener;

    const input = document.createElement('input');
    const textarea = document.createElement('textarea');

    // #when input field receives keydown
    const inputEvent = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    Object.defineProperty(inputEvent, 'target', { value: input, enumerable: true });
    handler(inputEvent);

    // #then
    expect(handlers.onPlayPause).not.toHaveBeenCalled();

    // #when textarea field receives keydown
    const textareaEvent = new KeyboardEvent('keydown', { code: 'KeyG', bubbles: true });
    Object.defineProperty(textareaEvent, 'target', { value: textarea, enumerable: true });
    handler(textareaEvent);

    // #then
    expect(handlers.onToggleGlow).not.toHaveBeenCalled();

    // #when normal element receives keydown
    const bodyEvent = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    Object.defineProperty(bodyEvent, 'target', { value: document.body, enumerable: true });
    handler(bodyEvent);

    // #then
    expect(handlers.onPlayPause).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
  });
});
