import { useState, useEffect, useCallback } from 'react';

interface UseCustomAccentColorsProps {
  currentTrackId?: string;
  onAccentColorChange?: (color: string) => void;
}

export const useCustomAccentColors = ({
  currentTrackId,
  onAccentColorChange
}: UseCustomAccentColorsProps) => {
  const [customAccentColorOverrides, setCustomAccentColorOverrides] = useState<Record<string, string>>({});

  // Load custom accent color overrides from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('customAccentColorOverrides');
    if (stored) {
      try {
        setCustomAccentColorOverrides(JSON.parse(stored));
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  // Save custom accent color overrides to localStorage when changed
  useEffect(() => {
    localStorage.setItem('customAccentColorOverrides', JSON.stringify(customAccentColorOverrides));
  }, [customAccentColorOverrides]);

  // When user picks a color with the eyedropper, store it as the custom color for this track
  const handleCustomAccentColor = useCallback((color: string) => {
    if (currentTrackId) {
      if (color === '') {
        // Empty string means reset - remove the override
        setCustomAccentColorOverrides(prev => {
          const newOverrides = { ...prev };
          delete newOverrides[currentTrackId!];
          return newOverrides;
        });
      } else {
        setCustomAccentColorOverrides(prev => ({ ...prev, [currentTrackId!]: color }));
      }
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  }, [currentTrackId, onAccentColorChange]);

  // Handle accent color changes, including reset
  const handleAccentColorChange = useCallback((color: string) => {
    if (color === 'RESET_TO_DEFAULT' && currentTrackId) {
      // Remove custom color override for this track
      setCustomAccentColorOverrides(prev => {
        const newOverrides = { ...prev };
        delete newOverrides[currentTrackId!];
        return newOverrides;
      });
      // Don't call onAccentColorChange here - let the parent re-extract the color
      return;
    }

    if (currentTrackId) {
      setCustomAccentColorOverrides(prev => ({ ...prev, [currentTrackId!]: color }));
      onAccentColorChange?.(color);
    } else {
      onAccentColorChange?.(color);
    }
  }, [currentTrackId, onAccentColorChange]);

  return {
    customAccentColorOverrides,
    handleCustomAccentColor,
    handleAccentColorChange
  };
};
