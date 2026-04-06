import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

interface DevBugContextValue {
  isActive: boolean;
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
}

const DevBugContext = createContext<DevBugContextValue | null>(null);

export function DevBugProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);

  const activate = useCallback(() => setIsActive(true), []);
  const deactivate = useCallback(() => setIsActive(false), []);
  const toggle = useCallback(() => setIsActive((prev) => !prev), []);

  const value = useMemo<DevBugContextValue>(
    () => ({ isActive, activate, deactivate, toggle }),
    [isActive, activate, deactivate, toggle],
  );

  return <DevBugContext.Provider value={value}>{children}</DevBugContext.Provider>;
}

export function useDevBug(): DevBugContextValue {
  const ctx = useContext(DevBugContext);
  if (!ctx) throw new Error('useDevBug must be used within DevBugProvider');
  return ctx;
}
