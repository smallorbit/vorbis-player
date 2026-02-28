import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

interface RenderStats {
  renderCount: number; mountCount: number; updateCount: number;
  totalDuration: number; avgDuration: number; maxDuration: number;
  unnecessaryRenders: number;
}

interface OperationStats {
  count: number; totalDuration: number; avgDuration: number; maxDuration: number;
}

interface ContextStats { updateCount: number; lastUpdate: number }

interface RenderEvent {
  componentId: string; phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number; timestamp: number;
}

export interface ProfilingSnapshot {
  sessionStart: number; duration: number;
  components: Record<string, RenderStats>;
  contexts: Record<string, ContextStats>;
  operations: Record<string, OperationStats>;
  frameRate: { current: number; avg: number; min: number };
  longTasks: { count: number; totalDuration: number; maxDuration: number };
  memory: { current?: number; peak?: number };
  recentEvents: RenderEvent[];
}

interface ProfilingContextValue {
  enabled: boolean; collector: MetricsCollector | null; toggle: () => void;
}

const STORAGE_KEY = 'vorbis-player-profiling';
const HAS_WINDOW = typeof window !== 'undefined';

class MetricsCollector {
  private sessionStart: number;
  private components = new Map<string, RenderStats>();
  private contexts = new Map<string, ContextStats>();
  private operations = new Map<string, OperationStats>();
  private recentEvents: RenderEvent[] = [];
  private maxRecentEvents = 100;
  private fpsSamples: number[] = [];
  private currentFps = 0;
  private minFps = Infinity;
  private rafId: number | null = null;
  private frameCount = 0;
  private lastFpsTime = 0;
  private longTaskCount = 0;
  private longTaskTotal = 0;
  private longTaskMax = 0;
  private longTaskObserver: PerformanceObserver | null = null;
  private peakMemory = 0;

  constructor() {
    this.sessionStart = performance.now();
    this.startFpsTracking();
    this.startLongTaskObserver();
  }

  private startFpsTracking(): void {
    if (!HAS_WINDOW) return;
    this.lastFpsTime = performance.now();
    const tick = (): void => {
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.currentFps = this.frameCount;
        this.fpsSamples.push(this.currentFps);
        if (this.currentFps < this.minFps) this.minFps = this.currentFps;
        this.frameCount = 0;
        this.lastFpsTime = now;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private startLongTaskObserver(): void {
    if (!HAS_WINDOW || typeof PerformanceObserver === 'undefined') return;
    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTaskCount++;
          this.longTaskTotal += entry.duration;
          if (entry.duration > this.longTaskMax) this.longTaskMax = entry.duration;
        }
      });
      this.longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch { /* longtask not supported */ }
  }

  recordRender(
    componentId: string, phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number, baseDuration: number,
  ): void {
    const s = this.components.get(componentId) ?? {
      renderCount: 0, mountCount: 0, updateCount: 0,
      totalDuration: 0, avgDuration: 0, maxDuration: 0, unnecessaryRenders: 0,
    };
    s.renderCount++;
    s.totalDuration += actualDuration;
    s.avgDuration = s.totalDuration / s.renderCount;
    if (actualDuration > s.maxDuration) s.maxDuration = actualDuration;
    if (phase === 'mount') {
      s.mountCount++;
    } else {
      s.updateCount++;
      if (baseDuration > 0 && actualDuration / baseDuration > 0.8) s.unnecessaryRenders++;
    }
    this.components.set(componentId, s);
    this.recentEvents.push({ componentId, phase, actualDuration, timestamp: performance.now() });
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents = this.recentEvents.slice(-this.maxRecentEvents);
    }
  }

  recordContextUpdate(contextName: string): void {
    const s = this.contexts.get(contextName) ?? { updateCount: 0, lastUpdate: 0 };
    s.updateCount++;
    s.lastUpdate = performance.now();
    this.contexts.set(contextName, s);
  }

  recordOperation(name: string, durationMs: number): void {
    const s = this.operations.get(name) ?? { count: 0, totalDuration: 0, avgDuration: 0, maxDuration: 0 };
    s.count++;
    s.totalDuration += durationMs;
    s.avgDuration = s.totalDuration / s.count;
    if (durationMs > s.maxDuration) s.maxDuration = durationMs;
    this.operations.set(name, s);
  }

  getSnapshot(): ProfilingSnapshot {
    const avgFps = this.fpsSamples.length > 0
      ? this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length : 0;
    // performance.memory is Chrome-only, non-standard
    const perfMem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const curMem = perfMem ? perfMem.usedJSHeapSize / 1024 / 1024 : undefined;
    if (curMem !== undefined && curMem > this.peakMemory) this.peakMemory = curMem;
    return {
      sessionStart: this.sessionStart,
      duration: performance.now() - this.sessionStart,
      components: Object.fromEntries(this.components),
      contexts: Object.fromEntries(this.contexts),
      operations: Object.fromEntries(this.operations),
      frameRate: { current: this.currentFps, avg: Math.round(avgFps * 10) / 10, min: this.minFps === Infinity ? 0 : this.minFps },
      longTasks: { count: this.longTaskCount, totalDuration: this.longTaskTotal, maxDuration: this.longTaskMax },
      memory: { current: curMem, peak: this.peakMemory > 0 ? this.peakMemory : undefined },
      recentEvents: [...this.recentEvents],
    };
  }

  reset(): void {
    this.sessionStart = performance.now();
    this.components.clear(); this.contexts.clear(); this.operations.clear();
    this.recentEvents = []; this.fpsSamples = [];
    this.currentFps = 0; this.minFps = Infinity;
    this.frameCount = 0; this.lastFpsTime = performance.now();
    this.longTaskCount = 0; this.longTaskTotal = 0; this.longTaskMax = 0;
    this.peakMemory = 0;
  }

  exportJSON(): string { return JSON.stringify(this.getSnapshot(), null, 2); }

  destroy(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.longTaskObserver?.disconnect();
    this.longTaskObserver = null;
  }
}

const ProfilingContext = createContext<ProfilingContextValue | null>(null);

function getInitialEnabled(): boolean {
  if (!HAS_WINDOW) return false;
  if (new URLSearchParams(window.location.search).get('profile') === 'true') return true;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function ProfilingProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(getInitialEnabled);
  const collectorRef = useRef<MetricsCollector | null>(enabled ? new MetricsCollector() : null);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (HAS_WINDOW) localStorage.setItem(STORAGE_KEY, String(next));
      if (next && !collectorRef.current) collectorRef.current = new MetricsCollector();
      if (!next && collectorRef.current) collectorRef.current.destroy();
      return next;
    });
  }, []);

  useEffect(() => {
    if (!HAS_WINDOW) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  useEffect(() => () => { collectorRef.current?.destroy(); }, []);

  const disabledValue = useMemo<ProfilingContextValue>(
    () => ({ enabled: false, collector: null, toggle }), [toggle],
  );
  const enabledValue = useMemo<ProfilingContextValue>(
    () => ({ enabled: true, collector: collectorRef.current, toggle }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toggle, enabled],
  );

  return (
    <ProfilingContext.Provider value={enabled ? enabledValue : disabledValue}>
      {children}
    </ProfilingContext.Provider>
  );
}

export function useProfilingContext(): ProfilingContextValue {
  const ctx = useContext(ProfilingContext);
  if (!ctx) throw new Error('useProfilingContext must be used within ProfilingProvider');
  return ctx;
}

export function isProfilingEnabled(): boolean {
  if (!HAS_WINDOW) return false;
  if (new URLSearchParams(window.location.search).get('profile') === 'true') return true;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}
