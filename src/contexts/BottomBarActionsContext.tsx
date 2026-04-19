import React, { createContext, useContext } from 'react';

export interface BottomBarActionsValue {
  hidden: boolean;
  showSettings: () => void;
  showQueue: () => void;
  openLibrary: () => void;
  toggleZenMode: () => void;
  startRadio?: () => void;
  openQuickAccessPanel?: () => void;
  radioGenerating?: boolean;
}

const BottomBarActionsContext = createContext<BottomBarActionsValue | null>(null);

interface BottomBarActionsProviderProps {
  value: BottomBarActionsValue;
  children: React.ReactNode;
}

export function BottomBarActionsProvider({ value, children }: BottomBarActionsProviderProps) {
  return (
    <BottomBarActionsContext.Provider value={value}>
      {children}
    </BottomBarActionsContext.Provider>
  );
}

export function useBottomBarActions(): BottomBarActionsValue {
  const ctx = useContext(BottomBarActionsContext);
  if (!ctx) {
    throw new Error('useBottomBarActions must be used within BottomBarActionsProvider');
  }
  return ctx;
}
