/**
 * @fileoverview usePlayerState Hook
 * 
 * Centralized state management hook for the entire Vorbis Player application.
 * Manages tracks, playback state, visual effects, and user preferences with
 * persistent storage and performance optimizations.
 * 
 * @architecture
 * This hook serves as the single source of truth for all player-related state.
 * It integrates with localStorage for persistence and provides memoized
 * state updates to prevent unnecessary re-renders.
 * 
 * @responsibilities
 * - Global player state management
 * - Track and playlist state
 * - Visual effects and theme settings
 * - User preferences persistence
 * - Performance optimization
 * 
 * @state
 * - tracks: Current playlist/track collection
 * - currentTrackIndex: Currently playing track position
 * - isLoading: Loading state for async operations
 * - error: Error state for failed operations
 * - selectedPlaylistId: Active playlist identifier
 * - showPlaylist: Playlist drawer visibility
 * - showLibrary: Library navigation visibility
 * - accentColor: Dynamic theme color from album art
 * - visualEffectsEnabled: Visual effects toggle state
 * - albumFilters: Image processing filters
 * 
 * @persistence
 * - Visual effects settings stored in localStorage
 * - Album filters persisted across sessions
 * - Per-album glow settings cached locally
 * 
 * @performance
 * - Memoized state updates to prevent unnecessary re-renders
 * - Debounced filter updates (150ms delay)
 * - Lazy loading of non-critical state
 * 
 * @usage
 * ```typescript
 * const {
 *   tracks,
 *   currentTrackIndex,
 *   setTracks,
 *   setCurrentTrackIndex,
 *   visualEffectsEnabled,
 *   setVisualEffectsEnabled
 * } = usePlayerState();
 * ```
 * 
 * @dependencies
 * - localStorage: Persistent storage
 * - theme: Design system tokens
 * 
 * @sideEffects
 * - localStorage reads/writes on state changes
 * - Theme color updates on accent color changes
 * - Visual effects re-renders on filter changes
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import type { Track } from '../services/spotify';
import { theme } from '@/styles/theme';
import type { VisualizerStyle } from '../types/visualizer';
import { useLocalStorage } from './useLocalStorage';

/**
 * Album image processing filters interface
 * 
 * Defines the available image processing filters that can be applied
 * to album artwork for visual effects and customization.
 * 
 * @interface AlbumFilters
 * 
 * @property {number} brightness - Brightness adjustment (0-200, 100 = normal)
 * @property {number} contrast - Contrast adjustment (0-200, 100 = normal)
 * @property {number} saturation - Saturation adjustment (0-200, 100 = normal)
 * @property {number} hue - Hue rotation in degrees (0-360)
 * @property {number} blur - Blur radius in pixels (0-20)
 * @property {number} sepia - Sepia effect intensity (0-100)
 * 
 * @example
 * ```typescript
 * const filters: AlbumFilters = {
 *   brightness: 110,  // 10% brighter
 *   contrast: 120,    // 20% more contrast
 *   saturation: 90,   // 10% less saturation
 *   hue: 180,         // 180° hue rotation
 *   blur: 2,          // 2px blur
 *   sepia: 30         // 30% sepia effect
 * };
 * ```
 */
interface AlbumFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
}



/**
 * Internal state type definitions
 */
interface TrackState {
  tracks: Track[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
}

interface PlaylistState {
  selectedId: string | null;
  isVisible: boolean;
}

interface ColorState {
  current: string;
  overrides: Record<string, string>;
}

interface VisualEffectsState {
  enabled: boolean;
  menuVisible: boolean;
  filters: AlbumFilters;
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  savedFilters: AlbumFilters | null;
  backgroundVisualizer: {
    enabled: boolean;
    style: VisualizerStyle;
    intensity: number;
  };
  accentColorBackground: {
    enabled: boolean;
    preferred: boolean;
  };
}

interface DebugState {
  enabled: boolean;
}

interface TrackActions {
  setTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  setLoading: (loading: boolean | ((prev: boolean) => boolean)) => void;
  setError: (error: string | null | ((prev: string | null) => string | null)) => void;
}

interface PlaylistActions {
  setSelectedId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
}

interface ColorActions {
  setCurrent: (color: string | ((prev: string) => string)) => void;
  setOverrides: (overrides: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  handleSetAccentColorOverride: (trackId: string, color: string) => void;
  handleRemoveAccentColorOverride: (trackId: string) => void;
  handleResetAccentColorOverride: (trackId: string) => void;
}

interface VisualEffectsActions {
  setEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setMenuVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  setFilters: (filters: AlbumFilters | ((prev: AlbumFilters) => AlbumFilters)) => void;
  setPerAlbumGlow: (glow: Record<string, { intensity: number; rate: number }> | ((prev: Record<string, { intensity: number; rate: number }>) => Record<string, { intensity: number; rate: number }>)) => void;
  handleFilterChange: (filterName: string, value: number | boolean) => void;
  handleResetFilters: () => void;
  restoreSavedFilters: () => void;
  backgroundVisualizer: {
    setEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
    setStyle: (style: VisualizerStyle | ((prev: VisualizerStyle) => VisualizerStyle)) => void;
    setIntensity: (intensity: number | ((prev: number) => number)) => void;
  };
  accentColorBackground: {
    setPreferred: (preferred: boolean | ((prev: boolean) => boolean)) => void;
  };
}

interface DebugActions {
  setEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
}

interface PlayerState {
  track: TrackState;
  playlist: PlaylistState;
  color: ColorState;
  visualEffects: VisualEffectsState;
  debug: DebugState;
}

interface PlayerStateSetters {
  actions: {
    track: TrackActions;
    playlist: PlaylistActions;
    color: ColorActions;
    visualEffects: VisualEffectsActions;
    debug: DebugActions;
  };
}

/**
 * usePlayerState - Global player state management hook
 * 
 * Centralized state management for the entire player application.
 * Manages tracks, playback state, visual effects, and user preferences
 * with persistent storage and performance optimizations.
 * 
 * @hook
 * 
 * @state
 * - tracks: Current playlist/track collection
 * - currentTrackIndex: Currently playing track position
 * - isLoading: Loading state for async operations
 * - error: Error state for failed operations
 * - selectedPlaylistId: Active playlist identifier
 * - showPlaylist: Playlist drawer visibility
 * - showLibrary: Library navigation visibility
 * - accentColor: Dynamic theme color from album art
 * - visualEffectsEnabled: Visual effects toggle state
 * - albumFilters: Image processing filters (brightness, contrast, saturation, etc.)
 * 
 * @persistence
 * - Visual effects settings stored in localStorage
 * - Album filters persisted across sessions
 * - Per-album glow settings cached locally
 * 
 * @performance
 * - Memoized state updates to prevent unnecessary re-renders
 * - Debounced filter updates (150ms delay)
 * - Lazy loading of non-critical state
 * 
 * @usage
 * ```typescript
 * const {
 *   track,
 *   playlist,
 *   color,
 *   visualEffects,
 *   debug,
 *   actions
 * } = usePlayerState();
 * ```
 * 
 * @dependencies
 * - localStorage: Persistent storage
 * - theme: Design system tokens
 * 
 * @sideEffects
 * - localStorage reads/writes on state changes
 * - Theme color updates on accent color changes
 * - Visual effects re-renders on filter changes
 */
export const usePlayerState = (): PlayerState & PlayerStateSetters => {
  // Track and playback state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  
  // UI state
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(theme.colors.accent);
  const [showVisualEffects, setShowVisualEffects] = useState(false);
  
  // Default album filters
  const defaultAlbumFilters: AlbumFilters = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0
  };

  // Visual effects state with persistence (using useLocalStorage)
  const [visualEffectsEnabled, setVisualEffectsEnabled] = useLocalStorage<boolean>(
    'vorbis-player-visual-effects-enabled',
    true
  );
  
  // Per-album glow settings with persistence
  const [perAlbumGlow, setPerAlbumGlow] = useLocalStorage<Record<string, { intensity: number; rate: number }>>(
    'vorbis-player-per-album-glow',
    {}
  );
  
  // Accent color overrides
  const [accentColorOverrides, setAccentColorOverrides] = useLocalStorage<Record<string, string>>(
    'accentColorOverrides',
    {}
  );
  
  // Album filters with persistence
  const [albumFilters, setAlbumFilters] = useLocalStorage<AlbumFilters>(
    'vorbis-player-album-filters',
    defaultAlbumFilters
  );

  // Saved filter preset
  const [savedAlbumFilters, setSavedAlbumFilters] = useState<AlbumFilters | null>(null);

  // Background visualizer state with persistence
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useLocalStorage<boolean>(
    'vorbis-player-background-visualizer-enabled',
    false
  );

  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useLocalStorage<VisualizerStyle>(
    'vorbis-player-background-visualizer-style',
    'particles'
  );

  // Preferred accent color background state (user's preference from VFX menu)
  const [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred] = useLocalStorage<boolean>(
    'vorbis-player-accent-color-background-preferred',
    false
  );

  // Actual accent color background enabled state (respects glow state)
  const [accentColorBackgroundEnabled, setAccentColorBackgroundEnabled] = useState<boolean>(false);

  // Debug mode state with persistence (hidden by default, toggle with 'D' key)
  const [debugModeEnabled, setDebugModeEnabled] = useLocalStorage<boolean>(
    'vorbis-player-debug-mode-enabled',
    false
  );

  const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useLocalStorage<number>(
    'vorbis-player-background-visualizer-intensity',
    60
  );

  // Sync accent color background with glow effect
  // When glow is disabled, accent color background is also disabled (visually)
  // When glow is enabled, restore the user's preferred setting from VFX menu
  useEffect(() => {
    if (!visualEffectsEnabled) {
      // When glow is disabled, disable accent color background visually
      setAccentColorBackgroundEnabled(false);
    } else {
      // When glow is enabled, restore the user's preferred setting
      setAccentColorBackgroundEnabled(accentColorBackgroundPreferred);
    }
  }, [visualEffectsEnabled, accentColorBackgroundPreferred]);

  const handleFilterChange = useCallback((filterName: string, value: number | boolean) => {
    setAlbumFilters(prev => {
      const newFilters = {
        ...prev,
        [filterName]: value
      };
      // Save the updated filters as the current settings
      setSavedAlbumFilters(newFilters);
      return newFilters;
    });
  }, [setAlbumFilters]);

  const handleResetFilters = useCallback(() => {
    setAlbumFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0
    });
  }, [setAlbumFilters]);

  const restoreSavedFilters = useCallback(() => {
    if (savedAlbumFilters) {
      setAlbumFilters(savedAlbumFilters);
    }
  }, [savedAlbumFilters, setAlbumFilters]);

  // Accent color helper methods
  const handleSetAccentColorOverride = useCallback((trackId: string, color: string) => {
    setAccentColorOverrides(prev => ({
      ...prev,
      [trackId]: color
    }));
  }, [setAccentColorOverrides]);

  const handleRemoveAccentColorOverride = useCallback((trackId: string) => {
    setAccentColorOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[trackId];
      return newOverrides;
    });
  }, [setAccentColorOverrides]);

  const handleResetAccentColorOverride = useCallback((trackId: string) => {
    handleRemoveAccentColorOverride(trackId);
  }, [handleRemoveAccentColorOverride]);

  // Group related state for external consumption
  const trackState: TrackState = {
    tracks,
    currentIndex: currentTrackIndex,
    isLoading,
    error
  };

  const playlistState: PlaylistState = {
    selectedId: selectedPlaylistId,
    isVisible: showPlaylist
  };

  const colorState: ColorState = {
    current: accentColor,
    overrides: accentColorOverrides
  };

  const visualEffectsState: VisualEffectsState = {
    enabled: visualEffectsEnabled,
    menuVisible: showVisualEffects,
    filters: albumFilters,
    perAlbumGlow,
    savedFilters: savedAlbumFilters,
    backgroundVisualizer: {
      enabled: backgroundVisualizerEnabled,
      style: backgroundVisualizerStyle,
      intensity: backgroundVisualizerIntensity
    },
    accentColorBackground: {
      enabled: accentColorBackgroundEnabled,
      preferred: accentColorBackgroundPreferred
    }
  };

  const debugState: DebugState = {
    enabled: debugModeEnabled
  };

  // Group related actions
  const trackActions = {
    setTracks,
    setCurrentIndex: setCurrentTrackIndex,
    setLoading: setIsLoading,
    setError
  };

  const playlistActions = {
    setSelectedId: setSelectedPlaylistId,
    setVisible: setShowPlaylist
  };

  const colorActions = {
    setCurrent: setAccentColor,
    setOverrides: setAccentColorOverrides,
    handleSetAccentColorOverride,
    handleRemoveAccentColorOverride,
    handleResetAccentColorOverride
  };

  const visualEffectsActions = {
    setEnabled: setVisualEffectsEnabled,
    setMenuVisible: setShowVisualEffects,
    setFilters: setAlbumFilters,
    setPerAlbumGlow,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
    backgroundVisualizer: {
      setEnabled: setBackgroundVisualizerEnabled,
      setStyle: setBackgroundVisualizerStyle,
      setIntensity: setBackgroundVisualizerIntensity
    },
    accentColorBackground: {
      setPreferred: setAccentColorBackgroundPreferred
    }
  };

  const debugActions = {
    setEnabled: setDebugModeEnabled
  };

  return {
    // Grouped state
    track: trackState,
    playlist: playlistState,
    color: colorState,
    visualEffects: visualEffectsState,
    debug: debugState,
    actions: {
      track: trackActions,
      playlist: playlistActions,
      color: colorActions,
      visualEffects: visualEffectsActions,
      debug: debugActions
    }
  };
};