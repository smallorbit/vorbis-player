import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import PlayerContent from '../PlayerContent';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Mock child components to avoid rendering complexity
vi.mock('../AlbumArt', () => ({ default: () => <div data-testid="album-art" /> }));
vi.mock('../PlayerControls', () => ({ default: () => <div data-testid="player-controls" /> }));
vi.mock('../QuickActionsPanel', () => ({ default: () => <div data-testid="quick-actions" /> }));
vi.mock('../LeftQuickActionsPanel', () => ({ default: () => <div data-testid="left-quick-actions" /> }));
vi.mock('../PlaylistDrawer', () => ({ default: () => <div data-testid="playlist-drawer" /> }));
vi.mock('../VisualEffectsMenu/index', () => ({ default: () => <div data-testid="visual-effects-menu" /> }));
vi.mock('../KeyboardShortcutsHelp', () => ({ default: () => <div data-testid="keyboard-shortcuts-help" /> }));

// Mock useKeyboardShortcuts hook
vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn()
}));

// Mock usePlayerSizing
vi.mock('@/hooks/usePlayerSizing', () => ({
  usePlayerSizing: () => ({
    dimensions: { width: 1000, height: 800 },
    useFluidSizing: false,
    padding: 20,
    transitionDuration: 300,
    transitionEasing: 'ease',
    aspectRatio: 1.6
  })
}));

describe('PlayerContent', () => {
  const mockHandlers = {
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onShowPlaylist: vi.fn(),
    onTogglePlaylist: vi.fn(),
    onShowVisualEffects: vi.fn(),
    onCloseVisualEffects: vi.fn(),
    onToggleVisualEffectsMenu: vi.fn(),
    onClosePlaylist: vi.fn(),
    onTrackSelect: vi.fn(),
    onAccentColorChange: vi.fn(),
    onGlowToggle: vi.fn(),
    onFilterChange: vi.fn(),
    onResetFilters: vi.fn(),
    onGlowIntensityChange: vi.fn(),
    onGlowRateChange: vi.fn(),
    onMuteToggle: vi.fn()
  };

  const defaultProps = {
    track: {
      current: { id: '1', name: 'Test Track', uri: 'spotify:track:1' } as any,
      list: [],
      currentIndex: 0,
      isPlaying: false
    },
    ui: {
      accentColor: '#ffffff',
      showVisualEffects: false,
      showPlaylist: false
    },
    effects: {
      enabled: true,
      glow: { intensity: 100, rate: 5 },
      filters: { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0 }
    },
    handlers: mockHandlers
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call handlers.onPlay when space is pressed and isPlaying is false', () => {
    render(<PlayerContent {...defaultProps} />);

    const { onPlayPause } = (useKeyboardShortcuts as Mock).mock.calls[0][0];
    
    onPlayPause();
    
    expect(mockHandlers.onPlay).toHaveBeenCalled();
    expect(mockHandlers.onPause).not.toHaveBeenCalled();
  });

  it('should call handlers.onPause when space is pressed and isPlaying is true', () => {
    const props = {
      ...defaultProps,
      track: {
        ...defaultProps.track,
        isPlaying: true
      }
    };

    render(<PlayerContent {...props} />);

    const { onPlayPause } = (useKeyboardShortcuts as Mock).mock.calls[0][0];
    
    onPlayPause();
    
    expect(mockHandlers.onPause).toHaveBeenCalled();
    expect(mockHandlers.onPlay).not.toHaveBeenCalled();
  });
});

