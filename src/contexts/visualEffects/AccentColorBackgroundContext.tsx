import React, { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';
import { useVisualEffectsToggle } from './VisualEffectsToggleContext';

interface AccentColorBackgroundContextValue {
  accentColorBackgroundPreferred: boolean;
  setAccentColorBackgroundPreferred: (preferred: boolean | ((prev: boolean) => boolean)) => void;
  accentColorBackgroundEnabled: boolean;
}

const AccentColorBackgroundContext = createContext<AccentColorBackgroundContextValue | null>(null);

export function AccentColorBackgroundProvider({ children }: { children: React.ReactNode }) {
  const { visualEffectsEnabled } = useVisualEffectsToggle();
  const [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred] = useLocalStorage<boolean>(
    STORAGE_KEYS.ACCENT_COLOR_BG_PREFERRED,
    false,
  );

  const accentColorBackgroundEnabled = visualEffectsEnabled && accentColorBackgroundPreferred;

  const value = useMemo<AccentColorBackgroundContextValue>(
    () => ({
      accentColorBackgroundPreferred,
      setAccentColorBackgroundPreferred,
      accentColorBackgroundEnabled,
    }),
    [accentColorBackgroundPreferred, setAccentColorBackgroundPreferred, accentColorBackgroundEnabled],
  );

  return (
    <AccentColorBackgroundContext.Provider value={value}>
      {children}
    </AccentColorBackgroundContext.Provider>
  );
}

export function useAccentColorBackground(): AccentColorBackgroundContextValue {
  const ctx = useContext(AccentColorBackgroundContext);
  if (!ctx) {
    throw new Error('useAccentColorBackground must be used within AccentColorBackgroundProvider');
  }
  return ctx;
}
