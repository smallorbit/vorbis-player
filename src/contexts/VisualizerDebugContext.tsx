import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  DEFAULT_VISUALIZER_DEBUG_CONFIG,
  mergeVisualizerConfig,
  type VisualizerDebugConfig,
  type VisualizerDebugOverrides,
} from '@/constants/visualizerDebugConfig';

const DEBUG_PARAM = 'debug';
const DEBUG_VALUE = 'visualizer';
const STORAGE_KEY = 'vorbis-player-visualizer-debug-overrides';

function isDebugModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get(DEBUG_PARAM) === DEBUG_VALUE;
}

function readStoredOverrides(): VisualizerDebugOverrides | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisualizerDebugOverrides;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredOverrides(overrides: VisualizerDebugOverrides | null): void {
  try {
    if (overrides == null) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

interface VisualizerDebugContextValue {
  isDebugMode: boolean;
  config: VisualizerDebugConfig;
  overrides: VisualizerDebugOverrides | null;
  setOverrides: (next: VisualizerDebugOverrides | null | ((prev: VisualizerDebugOverrides | null) => VisualizerDebugOverrides | null)) => void;
  setParticleOverride: <K extends keyof VisualizerDebugConfig['particle']>(key: K, value: VisualizerDebugConfig['particle'][K]) => void;
  setTrailOverride: <K extends keyof VisualizerDebugConfig['trail']>(key: K, value: VisualizerDebugConfig['trail'][K]) => void;
  reset: () => void;
  exportAsJson: () => string;
  copyExportToClipboard: () => Promise<void>;
  loadOverridesFromJson: (json: string) => boolean;
}

const VisualizerDebugContext = createContext<VisualizerDebugContextValue | null>(null);

export function VisualizerDebugProvider({ children }: { children: React.ReactNode }) {
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [overrides, setOverridesState] = useState<VisualizerDebugOverrides | null>(() =>
    readStoredOverrides()
  );

  useEffect(() => {
    setIsDebugMode(isDebugModeEnabled());
  }, []);

  // Sync overrides to localStorage when they change (only when debug mode was active at some point)
  const setOverrides = useCallback((next: VisualizerDebugOverrides | null | ((prev: VisualizerDebugOverrides | null) => VisualizerDebugOverrides | null)) => {
    setOverridesState(prev => {
      const nextVal = typeof next === 'function' ? next(prev) : next;
      writeStoredOverrides(nextVal);
      return nextVal;
    });
  }, []);

  const setParticleOverride = useCallback(<K extends keyof VisualizerDebugConfig['particle']>(key: K, value: VisualizerDebugConfig['particle'][K]) => {
    setOverrides(prev => ({
      ...prev,
      particle: { ...prev?.particle, [key]: value },
    }));
  }, [setOverrides]);

  const setTrailOverride = useCallback(<K extends keyof VisualizerDebugConfig['trail']>(key: K, value: VisualizerDebugConfig['trail'][K]) => {
    setOverrides(prev => ({
      ...prev,
      trail: { ...prev?.trail, [key]: value },
    }));
  }, [setOverrides]);

  const reset = useCallback(() => {
    setOverridesState(null);
    writeStoredOverrides(null);
  }, []);

  const config = useMemo(
    () => mergeVisualizerConfig(DEFAULT_VISUALIZER_DEBUG_CONFIG, overrides ?? {}),
    [overrides]
  );

  const exportAsJson = useCallback(() => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  const copyExportToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportAsJson());
    } catch {
      // ignore
    }
  }, [exportAsJson]);

  const loadOverridesFromJson = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json) as VisualizerDebugConfig | VisualizerDebugOverrides;
      const overrides: VisualizerDebugOverrides =
        parsed?.particle && parsed?.trail
          ? { particle: parsed.particle, trail: parsed.trail }
          : (parsed as VisualizerDebugOverrides);
      setOverridesState(overrides);
      writeStoredOverrides(overrides);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo<VisualizerDebugContextValue>(
    () => ({
      isDebugMode,
      config,
      overrides,
      setOverrides,
      setParticleOverride,
      setTrailOverride,
      reset,
      exportAsJson,
      copyExportToClipboard,
      loadOverridesFromJson,
    }),
    [
      isDebugMode,
      config,
      overrides,
      setOverrides,
      setParticleOverride,
      setTrailOverride,
      reset,
      exportAsJson,
      copyExportToClipboard,
      loadOverridesFromJson,
    ]
  );

  return (
    <VisualizerDebugContext.Provider value={value}>
      {children}
    </VisualizerDebugContext.Provider>
  );
}

export function useVisualizerDebug(): VisualizerDebugContextValue | null {
  return useContext(VisualizerDebugContext);
}

/** Returns merged config when debug mode is on and overrides exist; otherwise null so components use their built-in defaults. */
export function useVisualizerDebugConfig(): VisualizerDebugConfig | null {
  const ctx = useContext(VisualizerDebugContext);
  if (!ctx?.isDebugMode) return null;
  return ctx.config;
}
