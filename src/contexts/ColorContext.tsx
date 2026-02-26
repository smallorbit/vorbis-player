import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { theme } from '@/styles/theme';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isProfilingEnabled } from '@/contexts/ProfilingContext';

interface ColorContextValue {
  accentColor: string;
  accentColorOverrides: Record<string, string>;
  customAccentColors: Record<string, string>;
  setAccentColor: (color: string | ((prev: string) => string)) => void;
  setAccentColorOverrides: (overrides: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  handleSetAccentColorOverride: (albumId: string, color: string) => void;
  handleRemoveAccentColorOverride: (albumId: string) => void;
  handleResetAccentColorOverride: (albumId: string) => void;
  handleSetCustomAccentColor: (albumId: string, color: string) => void;
  handleRemoveCustomAccentColor: (albumId: string) => void;
}

const ColorContext = createContext<ColorContextValue | null>(null);

export function ColorProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColor] = useState<string>(theme.colors.accent);
  const [accentColorOverrides, setAccentColorOverrides] = useLocalStorage<Record<string, string>>(
    'vorbis-player-accent-color-overrides',
    {}
  );

  // Separate storage for colors picked via the eyedropper — only updated by the eyedropper,
  // not by palette swatch selection. This prevents palette clicks from overwriting the custom swatch.
  const [customAccentColors, setCustomAccentColors] = useLocalStorage<Record<string, string>>(
    'vorbis-player-custom-accent-colors',
    {}
  );

  const handleSetAccentColorOverride = useCallback((albumId: string, color: string) => {
    setAccentColorOverrides(prev => ({ ...prev, [albumId]: color }));
  }, [setAccentColorOverrides]);

  const handleRemoveAccentColorOverride = useCallback((albumId: string) => {
    setAccentColorOverrides(prev => {
      const newOverrides = { ...prev };
      delete newOverrides[albumId];
      return newOverrides;
    });
  }, [setAccentColorOverrides]);

  const handleSetCustomAccentColor = useCallback((albumId: string, color: string) => {
    setCustomAccentColors(prev => ({ ...prev, [albumId]: color }));
  }, [setCustomAccentColors]);

  const handleRemoveCustomAccentColor = useCallback((albumId: string) => {
    setCustomAccentColors(prev => {
      const newColors = { ...prev };
      delete newColors[albumId];
      return newColors;
    });
  }, [setCustomAccentColors]);

  const value = useMemo(() => ({
    accentColor,
    accentColorOverrides,
    customAccentColors,
    setAccentColor,
    setAccentColorOverrides,
    handleSetAccentColorOverride,
    handleRemoveAccentColorOverride,
    handleResetAccentColorOverride: handleRemoveAccentColorOverride,
    handleSetCustomAccentColor,
    handleRemoveCustomAccentColor,
  }), [accentColor, accentColorOverrides, customAccentColors, setAccentColor, setAccentColorOverrides, handleSetAccentColorOverride, handleRemoveAccentColorOverride, handleSetCustomAccentColor, handleRemoveCustomAccentColor]);

  const profilingRef = useRef(0);
  useEffect(() => {
    if (!isProfilingEnabled()) return;
    profilingRef.current += 1;
    console.debug(`[Profiling] ColorContext update #${profilingRef.current}`);
  }, [value]);

  return <ColorContext.Provider value={value}>{children}</ColorContext.Provider>;
}

export function useColorContext(): ColorContextValue {
  const ctx = useContext(ColorContext);
  if (!ctx) throw new Error('useColorContext must be used within ColorProvider');
  return ctx;
}
