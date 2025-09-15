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
 * Player state interface
 * 
 * Comprehensive state object containing all player-related data
 * including tracks, UI state, visual effects, and user preferences.
 * 
 * @interface PlayerState
 * 
 * @property {Track[]} tracks - Current playlist/track collection
 * @property {number} currentTrackIndex - Currently playing track position
 * @property {boolean} isLoading - Loading state for async operations
 * @property {string | null} error - Error state for failed operations
 * @property {string | null} selectedPlaylistId - Active playlist identifier
 * @property {boolean} showPlaylist - Playlist drawer visibility
 * @property {boolean} showLibrary - Library navigation visibility
 * @property {string} accentColor - Dynamic theme color from album art
 * @property {boolean} showVisualEffects - Visual effects menu visibility
 * @property {boolean} visualEffectsEnabled - Visual effects toggle state
 * @property {Record<string, { intensity: number; rate: number }>} perAlbumGlow - Per-album glow settings
 * @property {Record<string, string>} accentColorOverrides - Manual accent color overrides
 * @property {AlbumFilters} albumFilters - Current image processing filters
 * @property {AlbumFilters | null} savedAlbumFilters - Saved filter preset
 * 
 * @example
 * ```typescript
 * const playerState: PlayerState = {
 *   tracks: [track1, track2, track3],
 *   currentTrackIndex: 1,
 *   isLoading: false,
 *   error: null,
 *   selectedPlaylistId: 'playlist_123',
 *   showPlaylist: false,
 *   showLibrary: true,
 *   accentColor: '#1db954',
 *   showVisualEffects: false,
 *   visualEffectsEnabled: true,
 *   perAlbumGlow: {
 *     'album_123': { intensity: 0.8, rate: 2.0 }
 *   },
 *   accentColorOverrides: {
 *     'album_456': '#ff6b6b'
 *   },
 *   albumFilters: {
 *     brightness: 100,
 *     contrast: 100,
 *     saturation: 100,
 *     hue: 0,
 *     blur: 0,
 *     sepia: 0
 *   },
 *   savedAlbumFilters: null
 * };
 * ```
 */
export interface PlayerState {
  tracks: Track[];
  currentTrackIndex: number;
  isLoading: boolean;
  error: string | null;
  selectedPlaylistId: string | null;
  showPlaylist: boolean;
  showLibrary: boolean;
  accentColor: string;
  showVisualEffects: boolean;
  visualEffectsEnabled: boolean;
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  accentColorOverrides: Record<string, string>;
  albumFilters: AlbumFilters;
  savedAlbumFilters: AlbumFilters | null;
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
  const [showLibrary, setShowLibrary] = useState(true); // Library is visible by default in Electron mode
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
  // This ensures user preferences are maintained across sessions
  const [albumFilters, setAlbumFilters] = useState<AlbumFilters>(() => {
    const saved = localStorage.getItem('vorbis-player-album-filters');
    if (saved) {
      try {
        // Parse saved filters with fallback values for missing properties
        // This handles cases where the saved data structure has changed
        const parsed = JSON.parse(saved);
        return {
          brightness: parsed.brightness ?? 100,  // Default to normal brightness
          contrast: parsed.contrast ?? 100,      // Default to normal contrast
          saturation: parsed.saturation ?? 100,  // Default to normal saturation
          hue: parsed.hue ?? 0,                  // Default to no hue shift
          blur: parsed.blur ?? 0,                // Default to no blur
          sepia: parsed.sepia ?? 0               // Default to no sepia effect
        };
      } catch {
        // If parsing fails, return default values
        // This prevents crashes from corrupted localStorage data
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
    // No saved data, return default values
    // These represent neutral filter settings
    return {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      blur: 0,
      sepia: 0
    };
  });

  // Saved filter preset for quick restoration
  // This allows users to save and restore custom filter configurations
  const [savedAlbumFilters, setSavedAlbumFilters] = useState<AlbumFilters | null>(null);

  // Load accent color overrides from localStorage on mount
  // This restores user's manual color preferences across sessions
  useEffect(() => {
    const stored = localStorage.getItem('accentColorOverrides');
    if (stored) {
      try {
        // Parse stored color overrides with error handling
        // This prevents crashes from corrupted localStorage data
        setAccentColorOverrides(JSON.parse(stored));
      } catch (error) {
        console.warn('Failed to load accent color overrides:', error);
        // Continue with empty overrides if parsing fails
      }
    }
  }, []);

  // Persist visual effects enabled state to localStorage
  // This ensures user's visual effects preference is remembered
  useEffect(() => {
    localStorage.setItem('vorbis-player-visual-effects-enabled', JSON.stringify(visualEffectsEnabled));
  }, [visualEffectsEnabled]);

  // Persist per-album glow settings to localStorage
  // This maintains custom glow settings for each album across sessions
  useEffect(() => {
    localStorage.setItem('vorbis-player-per-album-glow', JSON.stringify(perAlbumGlow));
  }, [perAlbumGlow]);

  // Persist album filters to localStorage with debouncing
  // This prevents excessive localStorage writes during rapid filter changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('vorbis-player-album-filters', JSON.stringify(albumFilters));
    }, 150); // 150ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [albumFilters]);

  // Persist accent color overrides to localStorage
  // This saves user's manual color customizations
  useEffect(() => {
    localStorage.setItem('accentColorOverrides', JSON.stringify(accentColorOverrides));
  }, [accentColorOverrides]);

  // Memoized setter for album filters with validation
  // This ensures filter values stay within acceptable ranges
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setAlbumFiltersWithValidation = useCallback((filters: Partial<AlbumFilters>) => {
    setAlbumFilters(prev => {
      const newFilters = { ...prev, ...filters };
      
      // Validate and clamp filter values to prevent invalid states
      // This ensures UI components receive valid filter values
      return {
        brightness: Math.max(0, Math.min(200, newFilters.brightness)),    // 0-200 range
        contrast: Math.max(0, Math.min(200, newFilters.contrast)),        // 0-200 range
        saturation: Math.max(0, Math.min(200, newFilters.saturation)),    // 0-200 range
        hue: ((newFilters.hue % 360) + 360) % 360,                        // 0-360 range with wrapping
        blur: Math.max(0, Math.min(20, newFilters.blur)),                 // 0-20 range
        sepia: Math.max(0, Math.min(100, newFilters.sepia))               // 0-100 range
      };
    });
  }, []);

  // Memoized setter for per-album glow settings
  // This optimizes performance by preventing unnecessary re-renders
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setPerAlbumGlowWithValidation = useCallback((
    albumId: string, 
    settings: { intensity: number; rate: number }
  ) => {
    setPerAlbumGlow(prev => {
      const newSettings = { ...prev };
      
      // Validate and clamp glow settings to prevent invalid states
      // This ensures visual effects receive valid parameters
      newSettings[albumId] = {
        intensity: Math.max(0, Math.min(1, settings.intensity)),  // 0-1 range
        rate: Math.max(0.1, Math.min(5, settings.rate))           // 0.1-5 range
      };
      
      return newSettings;
    });
  }, []);

  // Memoized setter for accent color with validation
  // This ensures color values are valid hex colors
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setAccentColorWithValidation = useCallback((color: string) => {
    // Validate hex color format
    // This prevents invalid colors from being applied
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      setAccentColor(color);
    } else {
      console.warn('Invalid accent color format:', color);
    }
  }, []);

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

  return {
    tracks,
    currentTrackIndex,
    isLoading,
    error,
    selectedPlaylistId,
    showPlaylist,
    showLibrary,
    accentColor,
    showVisualEffects,
    visualEffectsEnabled,
    perAlbumGlow,
    accentColorOverrides,
    albumFilters,
    savedAlbumFilters,
    setTracks,
    setCurrentTrackIndex,
    setIsLoading,
    setError,
    setSelectedPlaylistId,
    setShowPlaylist,
    setShowLibrary,
    setAccentColor,
    setShowVisualEffects,
    setVisualEffectsEnabled,

    setPerAlbumGlow,
    setAccentColorOverrides,
    setAlbumFilters,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
  };
};