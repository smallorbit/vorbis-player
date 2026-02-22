import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { theme } from '@/styles/theme';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface ColorContextValue {
  accentColor: string;
  accentColorOverrides: Record<string, string>;
  setAccentColor: (color: string | ((prev: string) => string)) => void;
  setAccentColorOverrides: (overrides: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  handleSetAccentColorOverride: (albumId: string, color: string) => void;
  handleRemoveAccentColorOverride: (albumId: string) => void;
  handleResetAccentColorOverride: (albumId: string) => void;
}

const ColorContext = createContext<ColorContextValue | null>(null);

export function ColorProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColor] = useState<string>(theme.colors.accent);
  const [accentColorOverrides, setAccentColorOverrides] = useLocalStorage<Record<string, string>>(
    'vorbis-player-accent-color-overrides',
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

  const value = useMemo(() => ({
    accentColor,
    accentColorOverrides,
    setAccentColor,
    setAccentColorOverrides,
    handleSetAccentColorOverride,
    handleRemoveAccentColorOverride,
    handleResetAccentColorOverride: handleRemoveAccentColorOverride,
  }), [accentColor, accentColorOverrides, setAccentColor, setAccentColorOverrides, handleSetAccentColorOverride, handleRemoveAccentColorOverride]);

  return <ColorContext.Provider value={value}>{children}</ColorContext.Provider>;
}

export function useColorContext(): ColorContextValue {
  const ctx = useContext(ColorContext);
  if (!ctx) throw new Error('useColorContext must be used within ColorProvider');
  return ctx;
}
