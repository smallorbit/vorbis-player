import type { PerfData } from '@/types/devbug';

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: MemoryInfo;
}

let lcpObserver: PerformanceObserver | null = null;
let longTaskObserver: PerformanceObserver | null = null;
let latestLcp: number | null = null;
let longTasks: Array<{ duration: number; startTime: number }> = [];

function readFcp(): number | null {
  try {
    const entries = performance.getEntriesByType('paint');
    const fcp = entries.find((e) => e.name === 'first-contentful-paint');
    return fcp ? fcp.startTime : null;
  } catch {
    return null;
  }
}

function readMemory(): Pick<PerfData, 'memoryUsed' | 'memoryTotal'> {
  try {
    const mem = (performance as PerformanceWithMemory).memory;
    if (!mem) return { memoryUsed: null, memoryTotal: null };
    return {
      memoryUsed: mem.usedJSHeapSize,
      memoryTotal: mem.totalJSHeapSize,
    };
  } catch {
    return { memoryUsed: null, memoryTotal: null };
  }
}

function buildSnapshot(): PerfData {
  const { memoryUsed, memoryTotal } = readMemory();
  return {
    fcp: readFcp(),
    lcp: latestLcp,
    memoryUsed,
    memoryTotal,
    longTasks: [...longTasks],
  };
}

export function startPerfCapture(): void {
  latestLcp = null;
  longTasks = [];

  try {
    lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        latestLcp = entries[entries.length - 1].startTime;
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    lcpObserver = null;
  }

  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          longTasks.push({ duration: entry.duration, startTime: entry.startTime });
        }
      }
    });
    longTaskObserver.observe({ type: 'longtask', buffered: false });
  } catch {
    longTaskObserver = null;
  }
}

export function stopPerfCapture(): PerfData {
  const snapshot = buildSnapshot();

  if (lcpObserver) {
    try {
      lcpObserver.disconnect();
    } catch {
      // ignore
    }
    lcpObserver = null;
  }

  if (longTaskObserver) {
    try {
      longTaskObserver.disconnect();
    } catch {
      // ignore
    }
    longTaskObserver = null;
  }

  latestLcp = null;
  longTasks = [];

  return snapshot;
}

export function collectPerfData(): PerfData {
  return buildSnapshot();
}
