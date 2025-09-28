import { useState, useCallback, useMemo } from 'react';
import { DEFAULT_GLOW_INTENSITY, DEFAULT_GLOW_RATE } from '../components/AccentColorGlowOverlay';

interface UseVisualEffectsStateProps {
  initialGlowIntensity?: number;
  initialGlowRate?: number;
}

export const useVisualEffectsState = ({
  initialGlowIntensity = DEFAULT_GLOW_INTENSITY,
  initialGlowRate = DEFAULT_GLOW_RATE
}: UseVisualEffectsStateProps = {}) => {
  // Glow state management with localStorage persistence
  const [glowIntensity, setGlowIntensity] = useState(() => {
    const saved = localStorage.getItem('vorbis-player-glow-intensity');
    return saved ? parseInt(saved, 10) : initialGlowIntensity;
  });

  const [glowRate, setGlowRate] = useState(() => {
    const saved = localStorage.getItem('vorbis-player-glow-rate');
    return saved ? parseInt(saved, 10) : initialGlowRate;
  });

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
    localStorage.setItem('vorbis-player-glow-intensity', intensity.toString());
  }, []);

  const handleGlowRateChange = useCallback((rate: number) => {
    setGlowRate(rate);
    setSavedGlowRate(rate);
    localStorage.setItem('vorbis-player-glow-rate', rate.toString());
  }, []);

  // State restoration function
  const restoreGlowSettings = useCallback(() => {
    if (savedGlowIntensity !== null) {
      setGlowIntensity(savedGlowIntensity);
    }
    if (savedGlowRate !== null) {
      setGlowRate(savedGlowRate);
    }
  }, [savedGlowIntensity, savedGlowRate]);

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