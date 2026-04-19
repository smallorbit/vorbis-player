import React, { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storage';

interface TranslucenceContextValue {
  translucenceEnabled: boolean;
  setTranslucenceEnabled: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  translucenceOpacity: number;
  setTranslucenceOpacity: (opacity: number | ((prev: number) => number)) => void;
}

const TranslucenceContext = createContext<TranslucenceContextValue | null>(null);

export function TranslucenceProvider({ children }: { children: React.ReactNode }) {
  const [translucenceEnabled, setTranslucenceEnabled] = useLocalStorage<boolean>(
    STORAGE_KEYS.TRANSLUCENCE_ENABLED,
    true,
  );
  const [translucenceOpacity, setTranslucenceOpacity] = useLocalStorage<number>(
    STORAGE_KEYS.TRANSLUCENCE_OPACITY,
    0.8,
  );

  const value = useMemo<TranslucenceContextValue>(
    () => ({
      translucenceEnabled,
      setTranslucenceEnabled,
      translucenceOpacity,
      setTranslucenceOpacity,
    }),
    [translucenceEnabled, setTranslucenceEnabled, translucenceOpacity, setTranslucenceOpacity],
  );

  return <TranslucenceContext.Provider value={value}>{children}</TranslucenceContext.Provider>;
}

export function useTranslucence(): TranslucenceContextValue {
  const ctx = useContext(TranslucenceContext);
  if (!ctx) {
    throw new Error('useTranslucence must be used within TranslucenceProvider');
  }
  return ctx;
}
