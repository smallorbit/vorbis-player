import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import type { VisualizerStyle } from '@/types/visualizer';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isProfilingEnabled } from '@/contexts/ProfilingContext';

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
  const [visualEffectsEnabled, setVisualEffectsEnabled] = useLocalStorage<boolean>('vorbis-player-visual-effects-enabled', true);
  const [perAlbumGlow, setPerAlbumGlow] = useLocalStorage<Record<string, { intensity: number; rate: number }>>('vorbis-player-per-album-glow', {});
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useLocalStorage<boolean>('vorbis-player-background-visualizer-enabled', true);
  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useLocalStorage<VisualizerStyle>('vorbis-player-background-visualizer-style', 'fireflies');
  const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useLocalStorage<number>('vorbis-player-background-visualizer-intensity', 40);
  const [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred] = useLocalStorage<boolean>('vorbis-player-accent-color-background-preferred', false);
  const [accentColorBackgroundEnabled, setAccentColorBackgroundEnabled] = useState<boolean>(false);
  const [translucenceEnabled, setTranslucenceEnabled] = useLocalStorage<boolean>('vorbis-player-translucence-enabled', false);
  const [translucenceOpacity, setTranslucenceOpacity] = useLocalStorage<number>('vorbis-player-translucence-opacity', 0.8);
  const [zenModeEnabled, setZenModeEnabled] = useLocalStorage<boolean>('vorbis-player-zen-mode-enabled', false);
  const [showVisualEffects, setShowVisualEffects] = useState<boolean>(false);

  // One-time migration: rename old visualizer style values; remove geometric
  useEffect(() => {
    const raw = localStorage.getItem('vorbis-player-background-visualizer-style');
    if (raw === 'particles') {
      setBackgroundVisualizerStyle('fireflies');
      localStorage.setItem('vorbis-player-background-visualizer-style', 'fireflies');
    } else if (raw === 'trail') {
      setBackgroundVisualizerStyle('comet');
      localStorage.setItem('vorbis-player-background-visualizer-style', 'comet');
    } else if (raw === 'geometric') {
      setBackgroundVisualizerStyle('fireflies');
      localStorage.setItem('vorbis-player-background-visualizer-style', 'fireflies');
    }
  }, [setBackgroundVisualizerStyle]);

  useEffect(() => {
    if (!visualEffectsEnabled) {
      setAccentColorBackgroundEnabled(false);
    } else {
      setAccentColorBackgroundEnabled(accentColorBackgroundPreferred);
    }
  }, [visualEffectsEnabled, accentColorBackgroundPreferred]);

  useEffect(() => { localStorage.removeItem('vorbis-player-album-filters'); }, []);

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
