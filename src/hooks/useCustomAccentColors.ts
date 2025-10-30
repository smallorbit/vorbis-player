import { useCallback } from 'react';
import { usePlayerState } from './usePlayerState';

interface UseCustomAccentColorsProps {
  currentTrackId?: string;
  onAccentColorChange?: (color: string) => void;
}

export const useCustomAccentColors = ({
  currentTrackId,
  onAccentColorChange
}: UseCustomAccentColorsProps) => {
  // Get accent color state and helper methods from usePlayerState
  const { accentColorOverrides, handleSetAccentColorOverride, handleRemoveAccentColorOverride, handleResetAccentColorOverride } = usePlayerState();

  // When user picks a color with the eyedropper, store it as the custom color for this track
  const handleCustomAccentColor = useCallback((color: string) => {
    if (currentTrackId) {
      if (color === '') {
        // Empty string means reset - remove the override
        handleRemoveAccentColorOverride(currentTrackId);
      } else {
        handleSetAccentColorOverride(currentTrackId, color);
      }
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  }, [currentTrackId, onAccentColorChange, handleSetAccentColorOverride, handleRemoveAccentColorOverride]);

  // Handle accent color changes, including reset
  const handleAccentColorChange = useCallback((color: string) => {
    if (color === 'RESET_TO_DEFAULT' && currentTrackId) {
      // Remove custom color override for this track
      handleResetAccentColorOverride(currentTrackId);
      // Don't call onAccentColorChange here - let the parent re-extract the color
      return;
    }

    if (currentTrackId) {
      handleSetAccentColorOverride(currentTrackId, color);
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  }, [currentTrackId, onAccentColorChange, handleSetAccentColorOverride, handleResetAccentColorOverride]);

  return {
    customAccentColorOverrides: accentColorOverrides,
    handleCustomAccentColor,
    handleAccentColorChange
  };
};
