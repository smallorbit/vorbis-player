/**
 * Centralized state management hook for the entire Vorbis Player application.
 * 
 * Manages tracks, playback state, visual effects, and user preferences with
 * persistent storage and performance optimizations. Serves as the single source
 * of truth for all player-related state.
 */

import { useState, useEffect, useCallback } from 'react';
import type { MediaTrack } from '@/types/domain';
import { theme } from '@/styles/theme';
import type { VisualizerStyle } from '../types/visualizer';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

/**
 * Internal state type definitions
 */
interface TrackState {
  tracks: MediaTrack[];
  originalTracks: MediaTrack[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  shuffleEnabled: boolean;
}

interface QueueState {
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
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
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
  setTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setOriginalTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
  setCurrentIndex: (index: number | ((prev: number) => number)) => void;
  setLoading: (loading: boolean | ((prev: boolean) => boolean)) => void;
  setError: (error: string | null | ((prev: string | null) => string | null)) => void;
  setShuffleEnabled: (enabled: boolean) => void;
}

interface QueueActions {
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
  setPerAlbumGlow: (glow: Record<string, { intensity: number; rate: number }> | ((prev: Record<string, { intensity: number; rate: number }>) => Record<string, { intensity: number; rate: number }>)) => void;
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
  queue: QueueState;
  color: ColorState;
  visualEffects: VisualEffectsState;
  zenMode: ZenModeState;
}

interface PlayerStateSetters {
  actions: {
    track: TrackActions;
    queue: QueueActions;
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
  const [tracks, setTracks] = useState<MediaTrack[]>([]);
  const [originalTracks, setOriginalTracks] = useState<MediaTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shuffleEnabled, setShuffleEnabled] = useLocalStorage<boolean>(
    STORAGE_KEYS.SHUFFLE_ENABLED,
    false
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(theme.colors.accent);
  const [showVisualEffects, setShowVisualEffects] = useState(false);

  const [visualEffectsEnabled, setVisualEffectsEnabled] = useLocalStorage<boolean>(
    STORAGE_KEYS.VISUAL_EFFECTS_ENABLED,
    true
  );
  
  const [perAlbumGlow, setPerAlbumGlow] = useLocalStorage<Record<string, { intensity: number; rate: number }>>(
    STORAGE_KEYS.PER_ALBUM_GLOW,
    {}
  );
  
  const [accentColorOverrides, setAccentColorOverrides] = useLocalStorage<Record<string, string>>(
    STORAGE_KEYS.ACCENT_COLOR_OVERRIDES,
    {}
  );
  
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useLocalStorage<boolean>(
    STORAGE_KEYS.BG_VISUALIZER_ENABLED,
    true
  );
  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useLocalStorage<VisualizerStyle>(
    STORAGE_KEYS.BG_VISUALIZER_STYLE,
    'fireflies'
  );
  const [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred] = useLocalStorage<boolean>(
    STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED,
    false
  );
  const [zenModeEnabled, setZenModeEnabled] = useLocalStorage<boolean>(
    STORAGE_KEYS.ZEN_MODE_ENABLED,
    false
  );
  const [accentColorBackgroundEnabled, setAccentColorBackgroundEnabled] = useState<boolean>(false);
  const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useLocalStorage<number>(
    STORAGE_KEYS.BG_VISUALIZER_INTENSITY,
    40
  );

  useEffect(() => {
    if (!visualEffectsEnabled) {
      setAccentColorBackgroundEnabled(false);
    } else {
      setAccentColorBackgroundEnabled(accentColorBackgroundPreferred);
    }
  }, [visualEffectsEnabled, accentColorBackgroundPreferred]);

  useEffect(() => { localStorage.removeItem(STORAGE_KEYS.ALBUM_FILTERS); }, []);

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
    queue: {
      selectedId: selectedPlaylistId,
      isVisible: showQueue
    },
    color: {
      current: accentColor,
      overrides: accentColorOverrides
    },
    visualEffects: {
      enabled: visualEffectsEnabled,
      menuVisible: showVisualEffects,
      perAlbumGlow,
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
      queue: {
        setSelectedId: setSelectedPlaylistId,
        setVisible: setShowQueue
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
        setPerAlbumGlow,
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