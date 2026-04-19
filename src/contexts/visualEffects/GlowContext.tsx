import React, { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

type PerAlbumGlow = Record<string, { intensity: number; rate: number }>;

interface GlowContextValue {
  perAlbumGlow: PerAlbumGlow;
  setPerAlbumGlow: (glow: PerAlbumGlow | ((prev: PerAlbumGlow) => PerAlbumGlow)) => void;
}

const GlowContext = createContext<GlowContextValue | null>(null);

export function GlowProvider({ children }: { children: React.ReactNode }) {
  const [perAlbumGlow, setPerAlbumGlow] = useLocalStorage<PerAlbumGlow>(STORAGE_KEYS.PER_ALBUM_GLOW, {});

  const value = useMemo<GlowContextValue>(
    () => ({ perAlbumGlow, setPerAlbumGlow }),
    [perAlbumGlow, setPerAlbumGlow],
  );

  return <GlowContext.Provider value={value}>{children}</GlowContext.Provider>;
}

export function useGlow(): GlowContextValue {
  const ctx = useContext(GlowContext);
  if (!ctx) {
    throw new Error('useGlow must be used within GlowProvider');
  }
  return ctx;
}
