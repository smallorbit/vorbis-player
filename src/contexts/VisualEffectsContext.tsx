import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { VisualizerStyle } from '@/types/visualizer';
import type { AlbumFilters } from '@/types/filters';
import { DEFAULT_ALBUM_FILTERS } from '@/types/filters';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface VisualEffectsContextValue {
  // State
  visualEffectsEnabled: boolean;
  albumFilters: AlbumFilters;
  perAlbumGlow: Record<string, { intensity: number; rate: number }>;
  savedAlbumFilters: AlbumFilters | null;
  backgroundVisualizerEnabled: boolean;
  backgroundVisualizerStyle: VisualizerStyle;
  backgroundVisualizerIntensity: number;
  accentColorBackgroundPreferred: boolean;
  accentColorBackgroundEnabled: boolean;
  zenModeEnabled: boolean;
  showVisualEffects: boolean;
  // Setters
  setVisualEffectsEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setAlbumFilters: (filters: AlbumFilters | ((prev: AlbumFilters) => AlbumFilters)) => void;
  setPerAlbumGlow: (glow: Record<string, { intensity: number; rate: number }> | ((prev: Record<string, { intensity: number; rate: number }>) => Record<string, { intensity: number; rate: number }>)) => void;
  setBackgroundVisualizerEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setBackgroundVisualizerStyle: (style: VisualizerStyle | ((prev: VisualizerStyle) => VisualizerStyle)) => void;
  setBackgroundVisualizerIntensity: (intensity: number | ((prev: number) => number)) => void;
  setAccentColorBackgroundPreferred: (preferred: boolean | ((prev: boolean) => boolean)) => void;
  setZenModeEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  setShowVisualEffects: (visible: boolean | ((prev: boolean) => boolean)) => void;
  // Handlers
  handleFilterChange: (filterName: string, value: number | boolean) => void;
  handleResetFilters: () => void;
  restoreSavedFilters: () => void;
}

const VisualEffectsContext = createContext<VisualEffectsContextValue | null>(null);

export function VisualEffectsProvider({ children }: { children: React.ReactNode }) {
  const [visualEffectsEnabled, setVisualEffectsEnabled] = useLocalStorage<boolean>('vorbis-player-visual-effects-enabled', true);
  const [albumFilters, setAlbumFilters] = useLocalStorage<AlbumFilters>('vorbis-player-album-filters', DEFAULT_ALBUM_FILTERS);
  const [perAlbumGlow, setPerAlbumGlow] = useLocalStorage<Record<string, { intensity: number; rate: number }>>('vorbis-player-per-album-glow', {});
  const [savedAlbumFilters, setSavedAlbumFilters] = useState<AlbumFilters | null>(null);
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useLocalStorage<boolean>('vorbis-player-background-visualizer-enabled', true);
  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useLocalStorage<VisualizerStyle>('vorbis-player-background-visualizer-style', 'particles');
  const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useLocalStorage<number>('vorbis-player-background-visualizer-intensity', 60);
  const [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred] = useLocalStorage<boolean>('vorbis-player-accent-color-background-preferred', false);
  const [accentColorBackgroundEnabled, setAccentColorBackgroundEnabled] = useState<boolean>(false);
  const [zenModeEnabled, setZenModeEnabled] = useLocalStorage<boolean>('vorbis-player-zen-mode-enabled', false);
  const [showVisualEffects, setShowVisualEffects] = useState<boolean>(false);

  useEffect(() => {
    if (!visualEffectsEnabled) {
      setAccentColorBackgroundEnabled(false);
    } else {
      setAccentColorBackgroundEnabled(accentColorBackgroundPreferred);
    }
  }, [visualEffectsEnabled, accentColorBackgroundPreferred]);

  const handleFilterChange = useCallback((filterName: string, value: number | boolean) => {
    setAlbumFilters(prev => {
      const newFilters = { ...prev, [filterName]: value };
      setSavedAlbumFilters(newFilters);
      return newFilters;
    });
  }, [setAlbumFilters]);

  const handleResetFilters = useCallback(() => {
    setAlbumFilters({ brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0 });
  }, [setAlbumFilters]);

  const restoreSavedFilters = useCallback(() => {
    if (savedAlbumFilters) {
      setAlbumFilters(savedAlbumFilters);
    }
  }, [savedAlbumFilters, setAlbumFilters]);

  const value = useMemo<VisualEffectsContextValue>(() => ({
    visualEffectsEnabled,
    albumFilters,
    perAlbumGlow,
    savedAlbumFilters,
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundPreferred,
    accentColorBackgroundEnabled,
    zenModeEnabled,
    showVisualEffects,
    setVisualEffectsEnabled,
    setAlbumFilters,
    setPerAlbumGlow,
    setBackgroundVisualizerEnabled,
    setBackgroundVisualizerStyle,
    setBackgroundVisualizerIntensity,
    setAccentColorBackgroundPreferred,
    setZenModeEnabled,
    setShowVisualEffects,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
  }), [
    visualEffectsEnabled,
    albumFilters,
    perAlbumGlow,
    savedAlbumFilters,
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundPreferred,
    accentColorBackgroundEnabled,
    zenModeEnabled,
    showVisualEffects,
    setVisualEffectsEnabled,
    setAlbumFilters,
    setPerAlbumGlow,
    setBackgroundVisualizerEnabled,
    setBackgroundVisualizerStyle,
    setBackgroundVisualizerIntensity,
    setAccentColorBackgroundPreferred,
    setZenModeEnabled,
    setShowVisualEffects,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
  ]);

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
