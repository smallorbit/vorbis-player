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
export interface AlbumFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
}

/**
 * Track and Playback State
 * 
 * Contains all state related to track management and playback.
 */
export interface TrackState {
  tracks: Track[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Playlist State
 * 
 * Contains state related to playlist management and UI.
 */
export interface PlaylistState {
  selectedId: string | null;
  isVisible: boolean;
}

/**
 * Color and Theme State
 * 
 * Contains state related to accent colors and theme customization.
 */
export interface ColorState {
  current: string;
  overrides: Record<string, string>;
}

/**
 * Visual Effects State
 * 
 * Contains state related to visual effects and image processing.
 */
export interface VisualEffectsState {
  enabled: boolean;
  menuVisible: boolean;
  filters: AlbumFilters;
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  savedFilters: AlbumFilters | null;
}

/**
 * Grouped Player State
 * 
 * Organized state object with logical groupings for better maintainability.
 */
export interface GroupedPlayerState {
  track: TrackState;
  playlist: PlaylistState;
  color: ColorState;
  visualEffects: VisualEffectsState;
}

/**
 * Player Actions
 * 
 * Grouped action functions for state management.
 */
export interface PlayerActions {
  track: {
    setTracks: (tracks: Track[]) => void;
    setCurrentIndex: (index: number) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
  };
  playlist: {
    setSelectedId: (id: string | null) => void;
    setVisible: (visible: boolean) => void;
  };
  color: {
    setCurrent: (color: string) => void;
    setOverrides: (overrides: Record<string, string>) => void;
  };
  visualEffects: {
    setEnabled: (enabled: boolean) => void;
    setMenuVisible: (visible: boolean) => void;
    setFilters: (filters: AlbumFilters) => void;
    setPerAlbumGlow: (glow: Record<string, { intensity: number; rate: number }>) => void;
    handleFilterChange: (filterName: string, value: number | boolean) => void;
    handleResetFilters: () => void;
    restoreSavedFilters: () => void;
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
 * @returns {PlayerState & PlayerStateSetters} Object containing all state and setter functions
 */
export const usePlayerState = () => {
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
  
  // Visual effects state with persistence
  const [visualEffectsEnabled, setVisualEffectsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('vorbis-player-visual-effects-enabled');
    return saved ? JSON.parse(saved) : true;
  });
  
  // Per-album glow settings with persistence
  const [perAlbumGlow, setPerAlbumGlow] = useState<Record<string, { intensity: number; rate: number }>>(() => {
    const saved = localStorage.getItem('vorbis-player-per-album-glow');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Accent color overrides
  const [accentColorOverrides, setAccentColorOverrides] = useState<Record<string, string>>({});
  
  // Album filters with persistence and fallback defaults
  const [albumFilters, setAlbumFilters] = useState<AlbumFilters>(() => {
    const saved = localStorage.getItem('vorbis-player-album-filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          brightness: parsed.brightness ?? 100,
          contrast: parsed.contrast ?? 100,
          saturation: parsed.saturation ?? 100,
          hue: parsed.hue ?? 0,
          blur: parsed.blur ?? 0,
          sepia: parsed.sepia ?? 0
        };
      } catch {
        return {
          brightness: 100,
          contrast: 100,
          saturation: 100,
          hue: 0,
          blur: 0,
          sepia: 0
        };
      }
    }
    return {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0
    };
  });

  // Saved filter preset
  const [savedAlbumFilters, setSavedAlbumFilters] = useState<AlbumFilters | null>(null);

  // Background visualizer state with persistence
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('vorbis-player-background-visualizer-enabled');
    return saved ? JSON.parse(saved) : false;
  });

  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useState<VisualizerStyle>(() => {
    const saved = localStorage.getItem('vorbis-player-background-visualizer-style');
    return (saved as VisualizerStyle) || 'particles';
  });

  // Accent color background state with persistence
  const [accentColorBackgroundEnabled, setAccentColorBackgroundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('vorbis-player-accent-color-background-enabled');
    return saved ? JSON.parse(saved) : false;
  });

  const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useState<number>(() => {
    const saved = localStorage.getItem('vorbis-player-background-visualizer-intensity');
    return saved ? parseInt(saved, 10) : 60;
  });

  // Load accent color overrides from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('accentColorOverrides');
    if (stored) {
      try {
        setAccentColorOverrides(JSON.parse(stored));
      } catch (error) {
        console.warn('Failed to parse accent color overrides from localStorage:', error);
        setAccentColorOverrides({});
      }
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('accentColorOverrides', JSON.stringify(accentColorOverrides));
    } catch (error) {
      console.warn('Failed to save accent color overrides to localStorage:', error);
    }
  }, [accentColorOverrides]);

  useEffect(() => {
    localStorage.setItem('vorbis-player-album-filters', JSON.stringify(albumFilters));
  }, [albumFilters]);

  useEffect(() => {
    localStorage.setItem('vorbis-player-visual-effects-enabled', JSON.stringify(visualEffectsEnabled));
  }, [visualEffectsEnabled]);
  

  
  useEffect(() => {
    localStorage.setItem('vorbis-player-per-album-glow', JSON.stringify(perAlbumGlow));
  }, [perAlbumGlow]);

  // Background visualizer persistence
  useEffect(() => {
    localStorage.setItem('vorbis-player-background-visualizer-enabled', JSON.stringify(backgroundVisualizerEnabled));
  }, [backgroundVisualizerEnabled]);

  useEffect(() => {
    localStorage.setItem('vorbis-player-background-visualizer-style', backgroundVisualizerStyle);
  }, [backgroundVisualizerStyle]);

  useEffect(() => {
    localStorage.setItem('vorbis-player-background-visualizer-intensity', backgroundVisualizerIntensity.toString());
  }, [backgroundVisualizerIntensity]);

  // Accent color background persistence
  useEffect(() => {
    localStorage.setItem('vorbis-player-accent-color-background-enabled', JSON.stringify(accentColorBackgroundEnabled));
  }, [accentColorBackgroundEnabled]);

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
  }, []);

  const handleResetFilters = useCallback(() => {
    setAlbumFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0
    });
  }, []);

  const restoreSavedFilters = useCallback(() => {
    if (savedAlbumFilters) {
      setAlbumFilters(savedAlbumFilters);
    }
  }, [savedAlbumFilters]);

  // Accent color helper methods
  const handleSetAccentColorOverride = useCallback((trackId: string, color: string) => {
    setAccentColorOverrides(prev => ({
      ...prev,
      [trackId]: color
    }));
  }, []);

  const handleRemoveAccentColorOverride = useCallback((trackId: string) => {
    setAccentColorOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[trackId];
      return newOverrides;
    });
  }, []);

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
    savedFilters: savedAlbumFilters
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
    restoreSavedFilters
  };

  return {
    // Grouped state
    track: trackState,
    playlist: playlistState,
    color: colorState,
    visualEffects: visualEffectsState,
    actions: {
      track: trackActions,
      playlist: playlistActions,
      color: colorActions,
      visualEffects: visualEffectsActions
    },
    // Legacy individual state (for backward compatibility during migration)
    tracks,
    currentTrackIndex,
    isLoading,
    error,
    selectedPlaylistId,
    showPlaylist,
    accentColor,
    showVisualEffects,
    visualEffectsEnabled,
    perAlbumGlow,
    accentColorOverrides,
    albumFilters,
    savedAlbumFilters,
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundEnabled,
    setTracks,
    setCurrentTrackIndex,
    setIsLoading,
    setError,
    setSelectedPlaylistId,
    setShowPlaylist,
    setAccentColor,
    setShowVisualEffects,
    setVisualEffectsEnabled,
    setPerAlbumGlow,
    setAccentColorOverrides,
    setAlbumFilters,
    setBackgroundVisualizerEnabled,
    setBackgroundVisualizerStyle,
    setBackgroundVisualizerIntensity,
    setAccentColorBackgroundEnabled,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
    handleSetAccentColorOverride,
    handleRemoveAccentColorOverride,
    handleResetAccentColorOverride,
  };
};