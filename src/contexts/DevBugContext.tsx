import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

export type DevBugMode = 'inspect' | 'area' | 'annotate';

interface DevBugContextValue {
  isActive: boolean;
  activeMode: DevBugMode;
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  setMode: (mode: DevBugMode) => void;
}

const DevBugContext = createContext<DevBugContextValue | null>(null);

export function DevBugProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [activeMode, setActiveMode] = useState<DevBugMode>('inspect');

  const activate = useCallback(() => setIsActive(true), []);
  const deactivate = useCallback(() => setIsActive(false), []);
  const toggle = useCallback(() => setIsActive((prev) => !prev), []);
  const setMode = useCallback((mode: DevBugMode) => setActiveMode(mode), []);

  const value = useMemo<DevBugContextValue>(
    () => ({ isActive, activeMode, activate, deactivate, toggle, setMode }),
    [isActive, activeMode, activate, deactivate, toggle, setMode],
  );

  return <DevBugContext.Provider value={value}>{children}</DevBugContext.Provider>;
}

export function useDevBug(): DevBugContextValue {
  const ctx = useContext(DevBugContext);
  if (!ctx) throw new Error('useDevBug must be used within DevBugProvider');
  return ctx;
}
