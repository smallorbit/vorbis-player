import React, { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

interface ZenModeContextValue {
  zenModeEnabled: boolean;
  setZenModeEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
}

const ZenModeContext = createContext<ZenModeContextValue | null>(null);

export function ZenModeProvider({ children }: { children: React.ReactNode }) {
  const [zenModeEnabled, setZenModeEnabled] = useLocalStorage<boolean>(STORAGE_KEYS.ZEN_MODE_ENABLED, false);

  const value = useMemo<ZenModeContextValue>(
    () => ({ zenModeEnabled, setZenModeEnabled }),
    [zenModeEnabled, setZenModeEnabled],
  );

  return <ZenModeContext.Provider value={value}>{children}</ZenModeContext.Provider>;
}

export function useZenMode(): ZenModeContextValue {
  const ctx = useContext(ZenModeContext);
  if (!ctx) {
    throw new Error('useZenMode must be used within ZenModeProvider');
  }
  return ctx;
}
