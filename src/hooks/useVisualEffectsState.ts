import { useState, useCallback, useMemo } from 'react';
import { DEFAULT_GLOW_INTENSITY, DEFAULT_GLOW_RATE } from '../components/AccentColorGlowOverlay';
import { useLocalStorage } from './useLocalStorage';

interface UseVisualEffectsStateProps {
  initialGlowIntensity?: number;
  initialGlowRate?: number;
}

export const useVisualEffectsState = ({
  initialGlowIntensity = DEFAULT_GLOW_INTENSITY,
  initialGlowRate = DEFAULT_GLOW_RATE
}: UseVisualEffectsStateProps = {}) => {
  // Glow state management with localStorage persistence
  const [glowIntensity, setGlowIntensity] = useLocalStorage<number>(
    'vorbis-player-glow-intensity',
    initialGlowIntensity
  );

  const [glowRate, setGlowRate] = useLocalStorage<number>(
    'vorbis-player-glow-rate',
    initialGlowRate
  );

  // Saved state for restoration when visual effects are re-enabled
  const [savedGlowIntensity, setSavedGlowIntensity] = useState<number | null>(null);
  const [savedGlowRate, setSavedGlowRate] = useState<number | null>(null);

  // Effective glow calculation
  const effectiveGlow = useMemo(() => ({
    intensity: glowIntensity,
    rate: glowRate
  }), [glowIntensity, glowRate]);

  // Change handlers with persistence and saved state management
  const handleGlowIntensityChange = useCallback((intensity: number) => {
    setGlowIntensity(intensity);
    setSavedGlowIntensity(intensity);
  }, [setGlowIntensity]);

  const handleGlowRateChange = useCallback((rate: number) => {
    setGlowRate(rate);
    setSavedGlowRate(rate);
  }, [setGlowRate]);

  // State restoration function
  const restoreGlowSettings = useCallback(() => {
    if (savedGlowIntensity !== null) {
      setGlowIntensity(savedGlowIntensity);
    }
    if (savedGlowRate !== null) {
      setGlowRate(savedGlowRate);
    }
  }, [savedGlowIntensity, savedGlowRate, setGlowIntensity, setGlowRate]);

  return {
    glowIntensity,
    glowRate,
    savedGlowIntensity,
    savedGlowRate,
    effectiveGlow,
    handleGlowIntensityChange,
    handleGlowRateChange,
    restoreGlowSettings
  };
};