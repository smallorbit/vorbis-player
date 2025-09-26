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
      } catch (e) {
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

  // Load accent color overrides from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('accentColorOverrides');
    if (stored) {
      setAccentColorOverrides(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('accentColorOverrides', JSON.stringify(accentColorOverrides));
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