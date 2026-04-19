import React, { createContext, useContext, useEffect, useMemo } from 'react';
import type { VisualizerStyle } from '@/types/visualizer';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

interface VisualizerContextValue {
  backgroundVisualizerEnabled: boolean;
  setBackgroundVisualizerEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  backgroundVisualizerStyle: VisualizerStyle;
  setBackgroundVisualizerStyle: (style: VisualizerStyle | ((prev: VisualizerStyle) => VisualizerStyle)) => void;
  backgroundVisualizerIntensity: number;
  setBackgroundVisualizerIntensity: (intensity: number | ((prev: number) => number)) => void;
  backgroundVisualizerSpeed: number;
  setBackgroundVisualizerSpeed: (speed: number | ((prev: number) => number)) => void;
}

const VisualizerContext = createContext<VisualizerContextValue | null>(null);

export function VisualizerProvider({ children }: { children: React.ReactNode }) {
  const [backgroundVisualizerEnabled, setBackgroundVisualizerEnabled] = useLocalStorage<boolean>(
    STORAGE_KEYS.BG_VISUALIZER_ENABLED,
    true,
  );
  const [backgroundVisualizerStyle, setBackgroundVisualizerStyle] = useLocalStorage<VisualizerStyle>(
    STORAGE_KEYS.BG_VISUALIZER_STYLE,
    'fireflies',
  );
  const [backgroundVisualizerIntensity, setBackgroundVisualizerIntensity] = useLocalStorage<number>(
    STORAGE_KEYS.BG_VISUALIZER_INTENSITY,
    40,
  );
  const [backgroundVisualizerSpeed, setBackgroundVisualizerSpeed] = useLocalStorage<number>(
    STORAGE_KEYS.BG_VISUALIZER_SPEED,
    1.0,
  );

  // One-time migration: rename legacy visualizer style values
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.BG_VISUALIZER_STYLE);
    if (raw === 'particles' || raw === 'geometric') {
      setBackgroundVisualizerStyle('fireflies');
    } else if (raw === 'trail') {
      setBackgroundVisualizerStyle('comet');
    }
  }, [setBackgroundVisualizerStyle]);

  const value = useMemo<VisualizerContextValue>(
    () => ({
      backgroundVisualizerEnabled,
      setBackgroundVisualizerEnabled,
      backgroundVisualizerStyle,
      setBackgroundVisualizerStyle,
      backgroundVisualizerIntensity,
      setBackgroundVisualizerIntensity,
      backgroundVisualizerSpeed,
      setBackgroundVisualizerSpeed,
    }),
    [
      backgroundVisualizerEnabled,
      setBackgroundVisualizerEnabled,
      backgroundVisualizerStyle,
      setBackgroundVisualizerStyle,
      backgroundVisualizerIntensity,
      setBackgroundVisualizerIntensity,
      backgroundVisualizerSpeed,
      setBackgroundVisualizerSpeed,
    ],
  );

  return <VisualizerContext.Provider value={value}>{children}</VisualizerContext.Provider>;
}

export function useVisualizer(): VisualizerContextValue {
  const ctx = useContext(VisualizerContext);
  if (!ctx) {
    throw new Error('useVisualizer must be used within VisualizerProvider');
  }
  return ctx;
}
