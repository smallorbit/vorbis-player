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
  originalTracks: Track[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  shuffleEnabled: boolean;
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

interface TrackActions {
  setTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
  setOriginalTracks: (tracks: Track[]) => void;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  setLoading: (loading: boolean | ((prev: boolean) => boolean)) => void;
  setError: (error: string | null | ((prev: string | null) => string | null)) => void;
  setShuffleEnabled: (enabled: boolean) => void;
}

interface PlaylistActions {
  setSelectedId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
}

interface ColorActions {
  setCurrent: (color: string | ((prev: string) => string)) => void;
  setOverrides: (overrides: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  handleSetAccentColorOverride: (albumId: string, color: string) => void;
  handleRemoveAccentColorOverride: (albumId: string) => void;
  handleResetAccentColorOverride: (albumId: string) => void;
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

interface ZenModeState {
  enabled: boolean;
}

interface ZenModeActions {
  setEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
}

interface PlayerState {
  track: TrackState;
  playlist: PlaylistState;
  color: ColorState;
  visualEffects: VisualEffectsState;
  zenMode: ZenModeState;
}

interface PlayerStateSetters {
  actions: {
    track: TrackActions;
    playlist: PlaylistActions;
    color: ColorActions;
    visualEffects: VisualEffectsActions;
    zenMode: ZenModeActions;
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
  const [originalTracks, setOriginalTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shuffleEnabled, setShuffleEnabled] = useLocalStorage<boolean>(
    'vorbis-player-shuffle-enabled',
    false
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showPlaylist, setShowPlaylist] = useState(false);
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
    'vorbis-player-accent-color-overrides',
    {}
  );
  
  const [albumFilters, setAlbumFilters] = useLocalStorage<AlbumFilters>(
    'vorbis-player-album-filters',
    DEFAULT_ALBUM_FILTERS
  );

  const [savedAlbumFilters, setSavedAlbumFilters] = useState<AlbumFilters | null>(null);
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useLocalStorage<boolean>(
    'vorbis-player-background-visualizer-enabled',
    true
  );
  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useLocalStorage<VisualizerStyle>(
    'vorbis-player-background-visualizer-style',
    'particles'
  );
  const [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred] = useLocalStorage<boolean>(
    'vorbis-player-accent-color-background-preferred',
    false
  );
  const [zenModeEnabled, setZenModeEnabled] = useLocalStorage<boolean>(
    'vorbis-player-zen-mode-enabled',
    false
  );
  const [accentColorBackgroundEnabled, setAccentColorBackgroundEnabled] = useState<boolean>(false);
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

  const handleSetAccentColorOverride = useCallback((albumId: string, color: string) => {
    setAccentColorOverrides(prev => ({
      ...prev,
      [albumId]: color
    }));
  }, [setAccentColorOverrides]);

  const handleRemoveAccentColorOverride = useCallback((albumId: string) => {
    setAccentColorOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[albumId];
      return newOverrides;
    });
  }, [setAccentColorOverrides]);

  return {
    track: {
      tracks,
      originalTracks,
      currentIndex: currentTrackIndex,
      isLoading,
      error,
      shuffleEnabled
    },
    playlist: {
      selectedId: selectedPlaylistId,
      isVisible: showPlaylist
    },
    color: {
      current: accentColor,
      overrides: accentColorOverrides
    },
    visualEffects: {
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
    },
    zenMode: {
      enabled: zenModeEnabled
    },
    actions: {
      track: {
        setTracks,
        setOriginalTracks,
        setCurrentIndex: setCurrentTrackIndex,
        setLoading: setIsLoading,
        setError,
        setShuffleEnabled
      },
      playlist: {
        setSelectedId: setSelectedPlaylistId,
        setVisible: setShowPlaylist
      },
      color: {
        setCurrent: setAccentColor,
        setOverrides: setAccentColorOverrides,
        handleSetAccentColorOverride,
        handleRemoveAccentColorOverride,
        handleResetAccentColorOverride: handleRemoveAccentColorOverride
      },
      visualEffects: {
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
      },
      zenMode: {
        setEnabled: setZenModeEnabled
      }
    }
  };
}