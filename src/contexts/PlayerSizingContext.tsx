import React, { createContext, useContext } from 'react';
import { usePlayerSizing } from '@/hooks/usePlayerSizing';

type PlayerSizingValue = ReturnType<typeof usePlayerSizing>;

const PlayerSizingContext = createContext<PlayerSizingValue | null>(null);

export function PlayerSizingProvider({ children }: { children: React.ReactNode }) {
  const sizing = usePlayerSizing();
  return <PlayerSizingContext.Provider value={sizing}>{children}</PlayerSizingContext.Provider>;
}

export function usePlayerSizingContext(): PlayerSizingValue {
  const ctx = useContext(PlayerSizingContext);
  if (!ctx) throw new Error('usePlayerSizingContext must be used within PlayerSizingProvider');
  return ctx;
}
