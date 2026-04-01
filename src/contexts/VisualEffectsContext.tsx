import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import type { VisualizerStyle } from '@/types/visualizer';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isProfilingEnabled } from '@/contexts/ProfilingContext';
import { STORAGE_KEYS } from '@/constants/storage';

interface VisualEffectsContextValue {
  // State
  visualEffectsEnabled: boolean;
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  backgroundVisualizerEnabled: boolean;
  backgroundVisualizerStyle: VisualizerStyle;
  backgroundVisualizerIntensity: number;
  accentColorBackgroundPreferred: boolean;
  accentColorBackgroundEnabled: boolean;
  translucenceEnabled: boolean;
  translucenceOpacity: number;
  zenModeEnabled: boolean;
  showVisualEffects: boolean;
  // Setters
  setVisualEffectsEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setPerAlbumGlow: (glow: Record<string, { intensity: number; rate: number }> | ((prev: Record<string, { intensity: number; rate: number }>) => Record<string, { intensity: number; rate: number }>)) => void;
  setBackgroundVisualizerEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setBackgroundVisualizerStyle: (style: VisualizerStyle | ((prev: VisualizerStyle) => VisualizerStyle)) => void;
  setBackgroundVisualizerIntensity: (intensity: number | ((prev: number) => number)) => void;
  setAccentColorBackgroundPreferred: (preferred: boolean | ((prev: boolean) => boolean)) => void;
  setTranslucenceEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setTranslucenceOpacity: (opacity: number | ((prev: number) => number)) => void;
  setZenModeEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setShowVisualEffects: (visible: boolean | ((prev: boolean) => boolean)) => void;
}

const VisualEffectsContext = createContext<VisualEffectsContextValue | null>(null);

export function VisualEffectsProvider({ children }: { children: React.ReactNode }) {
  const [visualEffectsEnabled, setVisualEffectsEnabled] = useLocalStorage<boolean>(STORAGE_KEYS.VISUAL_EFFECTS_ENABLED, true);
  const [perAlbumGlow, setPerAlbumGlow] = useLocalStorage<Record<string, { intensity: number; rate: number }>>(STORAGE_KEYS.PER_ALBUM_GLOW, {});
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useLocalStorage<boolean>(STORAGE_KEYS.BG_VISUALIZER_ENABLED, true);
  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useLocalStorage<VisualizerStyle>(STORAGE_KEYS.BG_VISUALIZER_STYLE, 'fireflies');
  const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useLocalStorage<number>(STORAGE_KEYS.BG_VISUALIZER_INTENSITY, 40);
  const [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred] = useLocalStorage<boolean>(STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED, false);
  const [accentColorBackgroundEnabled, setAccentColorBackgroundEnabled] = useState<boolean>(false);
  const [translucenceEnabled, setTranslucenceEnabled] = useLocalStorage<boolean>(STORAGE_KEYS.TRANSLUCENCE_ENABLED, false);
  const [translucenceOpacity, setTranslucenceOpacity] = useLocalStorage<number>(STORAGE_KEYS.TRANSLUCENCE_OPACITY, 0.8);
  const [zenModeEnabled, setZenModeEnabled] = useLocalStorage<boolean>(STORAGE_KEYS.ZEN_MODE_ENABLED, false);
  const [showVisualEffects, setShowVisualEffects] = useState<boolean>(false);

  // One-time migration: rename old visualizer style values; remove geometric
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.BG_VISUALIZER_STYLE);
    if (raw === 'particles') {
      setBackgroundVisualizerStyle('fireflies');
      localStorage.setItem(STORAGE_KEYS.BG_VISUALIZER_STYLE, 'fireflies');
    } else if (raw === 'trail') {
      setBackgroundVisualizerStyle('comet');
      localStorage.setItem(STORAGE_KEYS.BG_VISUALIZER_STYLE, 'comet');
    } else if (raw === 'geometric') {
      setBackgroundVisualizerStyle('fireflies');
      localStorage.setItem(STORAGE_KEYS.BG_VISUALIZER_STYLE, 'fireflies');
    }
  }, [setBackgroundVisualizerStyle]);

  useEffect(() => {
    if (!visualEffectsEnabled) {
      setAccentColorBackgroundEnabled(false);
    } else {
      setAccentColorBackgroundEnabled(accentColorBackgroundPreferred);
    }
  }, [visualEffectsEnabled, accentColorBackgroundPreferred]);

  useEffect(() => { localStorage.removeItem(STORAGE_KEYS.ALBUM_FILTERS); }, []);

  const value = useMemo<VisualEffectsContextValue>(() => ({
    visualEffectsEnabled,
    perAlbumGlow,
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundPreferred,
    accentColorBackgroundEnabled,
    translucenceEnabled,
    translucenceOpacity,
    zenModeEnabled,
    showVisualEffects,
    setVisualEffectsEnabled,
    setPerAlbumGlow,
    setBackgroundVisualizerEnabled,
    setBackgroundVisualizerStyle,
    setBackgroundVisualizerIntensity,
    setAccentColorBackgroundPreferred,
    setTranslucenceEnabled,
    setTranslucenceOpacity,
    setZenModeEnabled,
    setShowVisualEffects,
  }), [
    visualEffectsEnabled,
    perAlbumGlow,
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundPreferred,
    accentColorBackgroundEnabled,
    translucenceEnabled,
    translucenceOpacity,
    zenModeEnabled,
    showVisualEffects,
    setVisualEffectsEnabled,
    setPerAlbumGlow,
    setBackgroundVisualizerEnabled,
    setBackgroundVisualizerStyle,
    setBackgroundVisualizerIntensity,
    setAccentColorBackgroundPreferred,
    setTranslucenceEnabled,
    setTranslucenceOpacity,
    setZenModeEnabled,
    setShowVisualEffects,
  ]);

  const profilingRef = useRef(0);
  useEffect(() => {
    if (!isProfilingEnabled()) return;
    profilingRef.current += 1;
    console.debug(`[Profiling] VisualEffectsContext update #${profilingRef.current}`);
  }, [value]);

  return (
    <VisualEffectsContext.Provider value={value}>
      {children}
    </VisualEffectsContext.Provider>
  );
}

export function useVisualEffectsContext(): VisualEffectsContextValue {
  const ctx = useContext(VisualEffectsContext);
  if (!ctx) {
    throw new Error('useVisualEffectsContext must be used within VisualEffectsProvider');
  }
  return ctx;
}
