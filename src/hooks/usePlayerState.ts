/**
 * Centralized state management hook for the entire Vorbis Player application.
 * 
 * Manages tracks, playback state, visual effects, and user preferences with
 * persistent storage and performance optimizations. Serves as the single source
 * of truth for all player-related state.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Track } from '../services/spotify';
import { theme } from '@/styles/theme';
import type { VisualizerStyle } from '../types/visualizer';
import type { AlbumFilters } from '../types/filters';
import { DEFAULT_ALBUM_FILTERS } from '../types/filters';
import { useLocalStorage } from './useLocalStorage';

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

interface LibraryDrawerState {
  isOpen: boolean;
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

interface LibraryDrawerActions {
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
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
  libraryDrawer: LibraryDrawerState;
  color: ColorState;
  visualEffects: VisualEffectsState;
  debug: DebugState;
}

interface PlayerStateSetters {
  actions: {
    track: TrackActions;
    playlist: PlaylistActions;
    libraryDrawer: LibraryDrawerActions;
    color: ColorActions;
    visualEffects: VisualEffectsActions;
    debug: DebugActions;
  };
}

/**
 * Global player state management hook.
 * 
 * Centralized state management for the entire player application.
 * Manages tracks, playback state, visual effects, and user preferences
 * with persistent storage and performance optimizations.
 */
export function usePlayerState(): PlayerState & PlayerStateSetters {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(theme.colors.accent);
  const [showVisualEffects, setShowVisualEffects] = useState(false);

  const [visualEffectsEnabled, setVisualEffectsEnabled] = useLocalStorage<boolean>(
    'vorbis-player-visual-effects-enabled',
    true
  );
  
  const [perAlbumGlow, setPerAlbumGlow] = useLocalStorage<Record<string, { intensity: number; rate: number }>>(
    'vorbis-player-per-album-glow',
    {}
  );
  
  const [accentColorOverrides, setAccentColorOverrides] = useLocalStorage<Record<string, string>>(
    'accentColorOverrides',
    {}
  );
  
  const [albumFilters, setAlbumFilters] = useLocalStorage<AlbumFilters>(
    'vorbis-player-album-filters',
    DEFAULT_ALBUM_FILTERS
  );

  const [savedAlbumFilters, setSavedAlbumFilters] = useState<AlbumFilters | null>(null);
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useLocalStorage<boolean>(
    'vorbis-player-background-visualizer-enabled',
    false
  );
  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useLocalStorage<VisualizerStyle>(
    'vorbis-player-background-visualizer-style',
    'particles'
  );
  const [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred] = useLocalStorage<boolean>(
    'vorbis-player-accent-color-background-preferred',
    false
  );
  const [accentColorBackgroundEnabled, setAccentColorBackgroundEnabled] = useState<boolean>(false);
  const [debugModeEnabled, setDebugModeEnabled] = useLocalStorage<boolean>(
    'vorbis-player-debug-mode-enabled',
    false
  );
  const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useLocalStorage<number>(
    'vorbis-player-background-visualizer-intensity',
    60
  );

  useEffect(() => {
    if (!visualEffectsEnabled) {
      setAccentColorBackgroundEnabled(false);
    } else {
      setAccentColorBackgroundEnabled(accentColorBackgroundPreferred);
    }
  }, [visualEffectsEnabled, accentColorBackgroundPreferred]);

  const handleFilterChange = useCallback((filterName: string, value: number | boolean) => {
    setAlbumFilters(prev => {
      const newFilters = {
        ...prev,
        [filterName]: value
      };
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

  const libraryDrawerState: LibraryDrawerState = {
    isOpen: showLibraryDrawer
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

  const trackActions: TrackActions = {
    setTracks,
    setCurrentIndex: setCurrentTrackIndex,
    setLoading: setIsLoading,
    setError
  };

  const playlistActions: PlaylistActions = {
    setSelectedId: setSelectedPlaylistId,
    setVisible: setShowPlaylist
  };

  const libraryDrawerActions: LibraryDrawerActions = {
    setOpen: setShowLibraryDrawer
  };

  const colorActions: ColorActions = {
    setCurrent: setAccentColor,
    setOverrides: setAccentColorOverrides,
    handleSetAccentColorOverride,
    handleRemoveAccentColorOverride,
    handleResetAccentColorOverride
  };

  const visualEffectsActions: VisualEffectsActions = {
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

  const debugActions: DebugActions = {
    setEnabled: setDebugModeEnabled
  };

  return {
    track: trackState,
    playlist: playlistState,
    libraryDrawer: libraryDrawerState,
    color: colorState,
    visualEffects: visualEffectsState,
    debug: debugState,
    actions: {
      track: trackActions,
      playlist: playlistActions,
      libraryDrawer: libraryDrawerActions,
      color: colorActions,
      visualEffects: visualEffectsActions,
      debug: debugActions
    }
  };
}