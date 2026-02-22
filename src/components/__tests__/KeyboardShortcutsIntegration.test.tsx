import React from 'react';
import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePlayerLogic } from '../../hooks/usePlayerLogic';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { TrackProvider } from '../../contexts/TrackContext';
import { VisualEffectsProvider } from '../../contexts/VisualEffectsContext';
import { ColorProvider } from '../../contexts/ColorContext';

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
    handleRedirect: vi.fn().mockResolvedValue(undefined)
  },
  checkTrackSaved: vi.fn().mockResolvedValue(false),
  saveTrack: vi.fn().mockResolvedValue(undefined),
  unsaveTrack: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../services/spotifyPlayer', () => ({
  spotifyPlayer: {
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    resume: vi.fn(),
    pause: vi.fn()
  }
}));

// Wrap renderHook with all 3 providers
const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <TrackProvider>
    <VisualEffectsProvider>
      <ColorProvider>
        {children}
      </ColorProvider>
    </VisualEffectsProvider>
  </TrackProvider>
);

describe('Keyboard Shortcuts Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose core playback handlers from usePlayerLogic', () => {
    const { result } = renderHook(() => usePlayerLogic(), { wrapper: AllProviders });

    expect(result.current.handlers).toHaveProperty('handlePlay');
    expect(result.current.handlers).toHaveProperty('handlePause');
    expect(result.current.handlers).toHaveProperty('handleNext');
    expect(result.current.handlers).toHaveProperty('handlePrevious');
    expect(result.current.handlers).toHaveProperty('handlePlaylistSelect');
    expect(result.current.handlers).toHaveProperty('handleOpenLibraryDrawer');
    expect(result.current.handlers).toHaveProperty('handleBackToLibrary');
    expect(typeof result.current.handlers.handlePlay).toBe('function');
    expect(typeof result.current.handlers.handleNext).toBe('function');
  });

  it('should handle all keyboard shortcuts in PlayerContent context', () => {
    const handlers = {
      onPlayPause: vi.fn(),
      onNext: vi.fn(),
      onPrevious: vi.fn(),
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
      onToggleGlow: vi.fn(),
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
    const textareaEvent = new KeyboardEvent('keydown', { code: 'KeyG', bubbles: true });
    Object.defineProperty(textareaEvent, 'target', { value: textarea, enumerable: true });
    handler(textareaEvent);
    expect(handlers.onToggleGlow).not.toHaveBeenCalled();

    // Test that normal element still works
    const bodyEvent = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    Object.defineProperty(bodyEvent, 'target', { value: document.body, enumerable: true });
    handler(bodyEvent);
    expect(handlers.onPlayPause).toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
  });
});
