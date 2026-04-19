import React, { createContext, useContext, useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

interface VisualEffectsToggleContextValue {
  visualEffectsEnabled: boolean;
  setVisualEffectsEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  showVisualEffects: boolean;
  setShowVisualEffects: (visible: boolean | ((prev: boolean) => boolean)) => void;
}

const VisualEffectsToggleContext = createContext<VisualEffectsToggleContextValue | null>(null);

export function VisualEffectsToggleProvider({ children }: { children: React.ReactNode }) {
  const [visualEffectsEnabled, setVisualEffectsEnabled] = useLocalStorage<boolean>(
    STORAGE_KEYS.VISUAL_EFFECTS_ENABLED,
    true,
  );
  const [showVisualEffects, setShowVisualEffects] = useState<boolean>(false);

  const value = useMemo<VisualEffectsToggleContextValue>(
    () => ({
      visualEffectsEnabled,
      setVisualEffectsEnabled,
      showVisualEffects,
      setShowVisualEffects,
    }),
    [visualEffectsEnabled, setVisualEffectsEnabled, showVisualEffects],
  );

  return (
    <VisualEffectsToggleContext.Provider value={value}>
      {children}
    </VisualEffectsToggleContext.Provider>
  );
}

export function useVisualEffectsToggle(): VisualEffectsToggleContextValue {
  const ctx = useContext(VisualEffectsToggleContext);
  if (!ctx) {
    throw new Error('useVisualEffectsToggle must be used within VisualEffectsToggleProvider');
  }
  return ctx;
}
