/**
 * @fileoverview useAccentColor Hook
 *
 * Custom hook for managing accent color extraction and overrides in the Vorbis Player.
 * Handles automatic color extraction from album artwork and manual color overrides.
 *
 * @architecture
 * This hook encapsulates the logic for extracting dominant colors from album artwork
 * and managing manual color overrides. It provides a clean interface for accent color
 * management while maintaining separation of concerns from the main component.
 *
 * @responsibilities
 * - Extract dominant colors from album artwork
 * - Manage manual accent color overrides
 * - Handle color fallbacks and error states
 * - Provide color change handlers
 *
 * @features
 * - Automatic color extraction from track images
 * - Manual color override system
 * - Per-track color persistence
 * - Fallback to theme default colors
 * - Error handling for extraction failures
 *
 * @performance
 * - Uses memoized callbacks to prevent unnecessary re-renders
 * - Leverages existing color extraction caching
 * - Efficient state updates with useCallback
 *
 * @usage
 * ```typescript
 * const {
 *   accentColor,
 *   handleAccentColorChange,
 *   resetToAutoColor
 * } = useAccentColor(currentTrack, accentColorOverrides, setAccentColor, setAccentColorOverrides);
 * ```
 *
 * @dependencies
 * - extractDominantColor: Color extraction utility
 * - theme: Design system tokens
 *
 * @author Vorbis Player Team
 * @version 1.0.0
 */

import { useCallback, useEffect } from 'react';
import { extractDominantColor } from '../utils/colorExtractor';
import { theme } from '@/styles/theme';
import type { Track } from '../services/spotify';

/**
 * useAccentColor - Custom hook for accent color management
 *
 * Manages accent color extraction from album artwork and manual color overrides.
 * Provides handlers for color changes and automatic extraction logic.
 *
 * @hook
 *
 * @param currentTrack - The currently selected track with image data
 * @param accentColorOverrides - Map of manual color overrides per track
 * @param setAccentColor - State setter for the current accent color
 * @param setAccentColorOverrides - State setter for color overrides map
 *
 * @returns Object containing accent color management functions
 *
 * @example
 * ```typescript
 * const {
 *   handleAccentColorChange,
 *   resetToAutoColor
 * } = useAccentColor(
 *   currentTrack,
 *   accentColorOverrides,
 *   setAccentColor,
 *   setAccentColorOverrides
 * );
 *
 * // Handle manual color change
 * handleAccentColorChange('#ff6b6b');
 *
 * // Reset to extracted color
 * resetToAutoColor();
 * ```
 *
 * @features
 * - Automatic color extraction when track changes
 * - Manual color override with persistence
 * - Intelligent fallback to theme colors
 * - Error handling for extraction failures
 * - Reset functionality to return to auto-extracted colors
 *
 * @sideEffects
 * - Updates accent color state when track changes
 * - Triggers color extraction from album artwork
 * - Persists color overrides in state
 */
export const useAccentColor = (
  currentTrack: Track | null,
  accentColorOverrides: Record<string, string>,
  setAccentColor: (color: string) => void,
  setAccentColorOverrides: (overrides: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
) => {
  /**
   * Automatic color extraction effect
   *
   * Extracts the dominant color from the current track's artwork when the track changes.
   * Uses cached colors from overrides if available, otherwise extracts from image.
   */
  useEffect(() => {
    if (!currentTrack) {
      setAccentColor(theme.colors.accent);
      return;
    }

    // Check if we have a manual override for this album
    if (currentTrack.album_id && accentColorOverrides[currentTrack.album_id]) {
      setAccentColor(accentColorOverrides[currentTrack.album_id]);
      return;
    }

    // Extract color from album artwork if available
    if (currentTrack.image) {
      extractDominantColor(currentTrack.image)
        .then(dominantColor => {
          if (dominantColor) {
            setAccentColor(dominantColor.hex);
          } else {
            setAccentColor(theme.colors.accent);
          }
        })
        .catch(() => {
          setAccentColor(theme.colors.accent);
        });
    } else {
      setAccentColor(theme.colors.accent);
    }
  }, [currentTrack, accentColorOverrides, setAccentColor]);

  /**
   * Handle manual accent color changes
   *
   * Manages both automatic extraction and manual color overrides.
   * When color is 'auto', triggers re-extraction from artwork.
   * Otherwise, saves the manual override for the current track.
   *
   * @param color - The new accent color ('auto' for extraction, or hex color)
   */
  const handleAccentColorChange = useCallback((color: string) => {
    const albumId = currentTrack?.album_id;

    if (color === 'auto') {
      if (albumId) {
        setAccentColorOverrides(prev => {
          const newOverrides = { ...prev };
          delete newOverrides[albumId];
          return newOverrides;
        });
      }

      if (currentTrack?.image) {
        extractDominantColor(currentTrack.image)
          .then(dominantColor => {
            if (dominantColor) {
              setAccentColor(dominantColor.hex);
            } else {
              setAccentColor(theme.colors.accent);
            }
          })
          .catch(() => {
            setAccentColor(theme.colors.accent);
          });
      } else {
        setAccentColor(theme.colors.accent);
      }
      return;
    }

    if (albumId) {
      setAccentColorOverrides(prev => ({ ...prev, [albumId]: color }));
      setAccentColor(color);
    } else {
      setAccentColor(color);
    }
  }, [currentTrack?.album_id, currentTrack?.image, setAccentColorOverrides, setAccentColor]);

  /**
   * Reset to automatically extracted color
   *
   * Removes any manual override for the current track and triggers
   * automatic color extraction from the artwork.
   */
  const resetToAutoColor = useCallback(() => {
    handleAccentColorChange('auto');
  }, [handleAccentColorChange]);

  return {
    handleAccentColorChange,
    resetToAutoColor
  };
};