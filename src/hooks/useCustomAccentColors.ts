import { useCallback } from 'react';
import { usePlayerState } from './usePlayerState';

interface UseCustomAccentColorsProps {
  currentAlbumId?: string;
  onAccentColorChange?: (color: string) => void;
}

export const useCustomAccentColors = ({
  currentAlbumId,
  onAccentColorChange
}: UseCustomAccentColorsProps) => {
  const {
    color: { overrides: accentColorOverrides },
    actions: {
      color: {
        handleSetAccentColorOverride,
        handleRemoveAccentColorOverride,
        handleResetAccentColorOverride
      }
    }
  } = usePlayerState();

  const handleCustomAccentColor = useCallback((color: string) => {
    if (currentAlbumId) {
      if (color === '') {
        handleRemoveAccentColorOverride(currentAlbumId);
      } else {
        handleSetAccentColorOverride(currentAlbumId, color);
      }
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  }, [currentAlbumId, onAccentColorChange, handleSetAccentColorOverride, handleRemoveAccentColorOverride]);

  const handleAccentColorChange = useCallback((color: string) => {
    if (color === 'RESET_TO_DEFAULT' && currentAlbumId) {
      handleResetAccentColorOverride(currentAlbumId);
      return;
    }

    if (currentAlbumId) {
      handleSetAccentColorOverride(currentAlbumId, color);
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  }, [currentAlbumId, onAccentColorChange, handleSetAccentColorOverride, handleResetAccentColorOverride]);

  return {
    customAccentColorOverrides: accentColorOverrides,
    handleCustomAccentColor,
    handleAccentColorChange
  };
};
