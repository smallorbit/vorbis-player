import { useState, useCallback, useMemo } from 'react';
import { useDebounce, useDebouncedCallback } from './useDebounce';
import { DEFAULT_GLOW_RATE } from '../utils/colorUtils';

export interface GlowSettings {
  enabled: boolean;
  intensity: number;
  rate: number;
  mode: 'global' | 'per-album';
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
}

export interface UseGlowSettingsReturn {
  glowSettings: GlowSettings;
  debouncedGlowSettings: GlowSettings;
  toggleGlow: () => void;
  setGlowIntensity: (intensity: number) => void;
  setGlowRate: (rate: number) => void;
  setGlowMode: (mode: 'global' | 'per-album') => void;
  setPerAlbumGlow: (albumId: string, settings: { intensity: number; rate: number }) => void;
  resetGlowSettings: () => void;
}

const DEBOUNCE_DELAY = 150; // 150ms debounce for better performance

const loadGlowSettings = (): GlowSettings => {
  try {
    const enabled = localStorage.getItem('vorbis-player-glow-enabled');
    const intensity = localStorage.getItem('vorbis-player-glow-intensity');
    const rate = localStorage.getItem('vorbis-player-glow-rate');
    const mode = localStorage.getItem('vorbis-player-glow-mode');
    const perAlbumGlow = localStorage.getItem('vorbis-player-per-album-glow');

    return {
      enabled: enabled ? JSON.parse(enabled) : true,
      intensity: intensity ? parseInt(intensity, 10) : 100,
      rate: rate ? parseFloat(rate) : DEFAULT_GLOW_RATE,
      mode: mode === 'per-album' ? 'per-album' : 'global',
      perAlbumGlow: perAlbumGlow ? JSON.parse(perAlbumGlow) : {},
    };
  } catch (error) {
    console.warn('Failed to load glow settings from localStorage:', error);
    return {
      enabled: true,
      intensity: 100,
      rate: DEFAULT_GLOW_RATE,
      mode: 'global',
      perAlbumGlow: {},
    };
  }
};

const saveGlowSettingsToStorage = (settings: GlowSettings): void => {
  try {
    localStorage.setItem('vorbis-player-glow-enabled', JSON.stringify(settings.enabled));
    localStorage.setItem('vorbis-player-glow-intensity', settings.intensity.toString());
    localStorage.setItem('vorbis-player-glow-rate', settings.rate.toString());
    localStorage.setItem('vorbis-player-glow-mode', settings.mode);
    localStorage.setItem('vorbis-player-per-album-glow', JSON.stringify(settings.perAlbumGlow));
  } catch (error) {
    console.warn('Failed to save glow settings to localStorage:', error);
  }
};

export const useGlowSettings = (): UseGlowSettingsReturn => {
  const [glowSettings, setGlowSettings] = useState<GlowSettings>(loadGlowSettings);
  
  // Debounce the glow settings to prevent excessive re-renders
  const debouncedGlowSettings = useDebounce(glowSettings, DEBOUNCE_DELAY);
  
  // Debounced save to localStorage to prevent excessive writes
  const debouncedSave = useDebouncedCallback(
    saveGlowSettingsToStorage as (...args: unknown[]) => unknown,
    DEBOUNCE_DELAY
  ) as (settings: GlowSettings) => void;

  // Update settings and trigger debounced save
  const updateSettings = useCallback((updater: (prev: GlowSettings) => GlowSettings) => {
    setGlowSettings(prevSettings => {
      const newSettings = updater(prevSettings);
      debouncedSave(newSettings);
      return newSettings;
    });
  }, [debouncedSave]);

  // Optimized toggle function with useCallback
  const toggleGlow = useCallback(() => {
    updateSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, [updateSettings]);

  // Optimized intensity setter with useCallback
  const setGlowIntensity = useCallback((intensity: number) => {
    // Clamp intensity between 0 and 100
    const clampedIntensity = Math.max(0, Math.min(100, intensity));
    updateSettings(prev => ({ ...prev, intensity: clampedIntensity }));
  }, [updateSettings]);

  // Optimized rate setter with useCallback
  const setGlowRate = useCallback((rate: number) => {
    // Clamp rate between 0.5 and 10 seconds
    const clampedRate = Math.max(0.5, Math.min(10, rate));
    updateSettings(prev => ({ ...prev, rate: clampedRate }));
  }, [updateSettings]);

  // Optimized mode setter with useCallback
  const setGlowMode = useCallback((mode: 'global' | 'per-album') => {
    updateSettings(prev => ({ ...prev, mode }));
  }, [updateSettings]);

  // Optimized per-album glow setter with useCallback
  const setPerAlbumGlow = useCallback((albumId: string, settings: { intensity: number; rate: number }) => {
    updateSettings(prev => ({
      ...prev,
      perAlbumGlow: {
        ...prev.perAlbumGlow,
        [albumId]: {
          intensity: Math.max(0, Math.min(100, settings.intensity)),
          rate: Math.max(0.5, Math.min(10, settings.rate)),
        },
      },
    }));
  }, [updateSettings]);

  // Reset function with useCallback
  const resetGlowSettings = useCallback(() => {
    const defaultSettings: GlowSettings = {
      enabled: true,
      intensity: 100,
      rate: DEFAULT_GLOW_RATE,
      mode: 'global',
      perAlbumGlow: {},
    };
    setGlowSettings(defaultSettings);
    saveGlowSettingsToStorage(defaultSettings);
  }, []);

  // Memoize the return value to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    glowSettings,
    debouncedGlowSettings,
    toggleGlow,
    setGlowIntensity,
    setGlowRate,
    setGlowMode,
    setPerAlbumGlow,
    resetGlowSettings,
  }), [
    glowSettings,
    debouncedGlowSettings,
    toggleGlow,
    setGlowIntensity,
    setGlowRate,
    setGlowMode,
    setPerAlbumGlow,
    resetGlowSettings,
  ]);

  return returnValue;
};