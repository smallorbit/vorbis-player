import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startPerfCapture, stopPerfCapture, collectPerfData } from '../perfCapture';
import type { PerfData } from '@/types/devbug';

type ObserverCallback = (list: { getEntries: () => PerformanceEntry[] }) => void;

interface MockObserver {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  callback: ObserverCallback;
}

function makeMockObserver(callback: ObserverCallback): MockObserver {
  return {
    observe: vi.fn(),
    disconnect: vi.fn(),
    callback,
  };
}

let lcpMock: MockObserver | null = null;
let longTaskMock: MockObserver | null = null;

function setupPerformanceObserverMock(supported: Set<string> = new Set(['largest-contentful-paint', 'longtask'])): void {
  const MockObserverConstructor = vi.fn().mockImplementation((callback: ObserverCallback) => {
    const mock = makeMockObserver(callback);
    const firstCallCount = MockObserverConstructor.mock.calls.length;
    if (firstCallCount === 1) {
      lcpMock = mock;
    } else {
      longTaskMock = mock;
    }

    return {
      observe: (options: { type: string }) => {
        if (!supported.has(options.type)) throw new Error(`Unsupported entry type: ${options.type}`);
        mock.observe(options);
      },
      disconnect: mock.disconnect,
    };
  });

  vi.stubGlobal('PerformanceObserver', MockObserverConstructor);
}

function makePaintEntry(name: string, startTime: number): PerformanceEntry {
  return { name, startTime, duration: 0, entryType: 'paint', toJSON: () => ({}) };
}

function makeLcpEntry(startTime: number): PerformanceEntry {
  return { name: 'largest-contentful-paint', startTime, duration: 0, entryType: 'largest-contentful-paint', toJSON: () => ({}) };
}

function makeLongTaskEntry(startTime: number, duration: number): PerformanceEntry {
  return { name: 'longtask', startTime, duration, entryType: 'longtask', toJSON: () => ({}) };
}

beforeEach(() => {
  lcpMock = null;
  longTaskMock = null;

  vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
  setupPerformanceObserverMock();
});

afterEach(() => {
  stopPerfCapture();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('startPerfCapture', () => {
  it('sets up LCP observer on start', () => {
    // #when
    startPerfCapture();

    // #then
    expect(lcpMock?.observe).toHaveBeenCalledWith({ type: 'largest-contentful-paint', buffered: true });
  });

  it('sets up long task observer on start', () => {
    // #when
    startPerfCapture();

    // #then
    expect(longTaskMock?.observe).toHaveBeenCalledWith({ type: 'longtask', buffered: false });
  });

  it('resets accumulated data on each start', () => {
    // #given
    startPerfCapture();
    if (longTaskMock) {
      longTaskMock.callback({ getEntries: () => [makeLongTaskEntry(100, 80)] });
    }
    stopPerfCapture();

    setupPerformanceObserverMock();
    lcpMock = null;
    longTaskMock = null;

    // #when
    startPerfCapture();
    const data = collectPerfData();

    // #then
    expect(data.longTasks).toHaveLength(0);
    expect(data.lcp).toBeNull();
  });

  it('handles PerformanceObserver not supporting LCP gracefully', () => {
    // #given
    setupPerformanceObserverMock(new Set(['longtask']));

    // #when / #then — must not throw
    expect(() => startPerfCapture()).not.toThrow();
  });

  it('handles PerformanceObserver not supporting longtask gracefully', () => {
    // #given
    setupPerformanceObserverMock(new Set(['largest-contentful-paint']));

    // #when / #then — must not throw
    expect(() => startPerfCapture()).not.toThrow();
  });

  it('handles PerformanceObserver entirely missing from the environment', () => {
    // #given
    vi.stubGlobal('PerformanceObserver', undefined);

    // #when / #then — must not throw
    expect(() => startPerfCapture()).not.toThrow();
  });
});

describe('stopPerfCapture', () => {
  it('returns a PerfData object with the expected shape', () => {
    // #given
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data).toHaveProperty('fcp');
    expect(data).toHaveProperty('lcp');
    expect(data).toHaveProperty('memoryUsed');
    expect(data).toHaveProperty('memoryTotal');
    expect(data).toHaveProperty('longTasks');
    expect(Array.isArray(data.longTasks)).toBe(true);
  });

  it('disconnects LCP observer', () => {
    // #given
    startPerfCapture();
    const captured = lcpMock;

    // #when
    stopPerfCapture();

    // #then
    expect(captured?.disconnect).toHaveBeenCalled();
  });

  it('disconnects long task observer', () => {
    // #given
    startPerfCapture();
    const captured = longTaskMock;

    // #when
    stopPerfCapture();

    // #then
    expect(captured?.disconnect).toHaveBeenCalled();
  });

  it('returns empty longTasks when none were observed', () => {
    // #given
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.longTasks).toEqual([]);
  });

  it('can be called multiple times without throwing', () => {
    // #given
    startPerfCapture();
    stopPerfCapture();

    // #when / #then
    expect(() => stopPerfCapture()).not.toThrow();
  });
});

describe('FCP collection', () => {
  it('returns FCP startTime when paint entry exists', () => {
    // #given
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      makePaintEntry('first-paint', 100),
      makePaintEntry('first-contentful-paint', 250),
    ]);
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.fcp).toBe(250);
  });

  it('returns null when no first-contentful-paint entry exists', () => {
    // #given
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      makePaintEntry('first-paint', 100),
    ]);
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.fcp).toBeNull();
  });

  it('returns null when getEntriesByType throws', () => {
    // #given
    vi.spyOn(performance, 'getEntriesByType').mockImplementation(() => {
      throw new Error('not supported');
    });
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.fcp).toBeNull();
  });
});

describe('LCP collection', () => {
  it('captures LCP value from observer callback', () => {
    // #given
    startPerfCapture();
    lcpMock?.callback({ getEntries: () => [makeLcpEntry(1200)] });

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.lcp).toBe(1200);
  });

  it('uses the last LCP entry when multiple are reported', () => {
    // #given
    startPerfCapture();
    lcpMock?.callback({ getEntries: () => [makeLcpEntry(800), makeLcpEntry(1500)] });

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.lcp).toBe(1500);
  });

  it('returns null when LCP observer was not set up', () => {
    // #given
    setupPerformanceObserverMock(new Set(['longtask']));
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.lcp).toBeNull();
  });

  it('returns null before any LCP entry arrives', () => {
    // #given
    startPerfCapture();

    // #when
    const data = collectPerfData();

    // #then
    expect(data.lcp).toBeNull();
  });
});

describe('long task collection', () => {
  it('accumulates long tasks observed during capture', () => {
    // #given
    startPerfCapture();
    longTaskMock?.callback({ getEntries: () => [makeLongTaskEntry(100, 80), makeLongTaskEntry(300, 120)] });

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.longTasks).toHaveLength(2);
    expect(data.longTasks[0]).toEqual({ startTime: 100, duration: 80 });
    expect(data.longTasks[1]).toEqual({ startTime: 300, duration: 120 });
  });

  it('filters out tasks with duration <= 50ms', () => {
    // #given
    startPerfCapture();
    longTaskMock?.callback({
      getEntries: () => [
        makeLongTaskEntry(100, 50),
        makeLongTaskEntry(200, 30),
        makeLongTaskEntry(300, 80),
      ],
    });

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.longTasks).toHaveLength(1);
    expect(data.longTasks[0].duration).toBe(80);
  });

  it('returns empty array when long task observer was not set up', () => {
    // #given
    setupPerformanceObserverMock(new Set(['largest-contentful-paint']));
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.longTasks).toEqual([]);
  });

  it('returns a copy of longTasks so mutations do not affect internal state', () => {
    // #given
    startPerfCapture();
    longTaskMock?.callback({ getEntries: () => [makeLongTaskEntry(100, 80)] });

    // #when
    const data = collectPerfData();
    data.longTasks.push({ startTime: 999, duration: 999 });

    const data2 = collectPerfData();

    // #then
    expect(data2.longTasks).toHaveLength(1);
  });
});

describe('memory collection', () => {
  it('returns memory values when performance.memory is available', () => {
    // #given
    Object.defineProperty(performance, 'memory', {
      value: { usedJSHeapSize: 10_000_000, totalJSHeapSize: 50_000_000, jsHeapSizeLimit: 2_000_000_000 },
      configurable: true,
    });
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.memoryUsed).toBe(10_000_000);
    expect(data.memoryTotal).toBe(50_000_000);

    Object.defineProperty(performance, 'memory', { value: undefined, configurable: true });
  });

  it('returns null memory values when performance.memory is not available', () => {
    // #given — performance.memory is undefined in this test environment
    startPerfCapture();

    // #when
    const data = stopPerfCapture();

    // #then
    expect(data.memoryUsed).toBeNull();
    expect(data.memoryTotal).toBeNull();
  });
});

describe('collectPerfData', () => {
  it('returns current metrics without stopping observers', () => {
    // #given
    startPerfCapture();
    lcpMock?.callback({ getEntries: () => [makeLcpEntry(900)] });

    // #when
    const mid = collectPerfData();
    longTaskMock?.callback({ getEntries: () => [makeLongTaskEntry(400, 70)] });
    const later = stopPerfCapture();

    // #then
    expect(mid.lcp).toBe(900);
    expect(mid.longTasks).toHaveLength(0);
    expect(later.longTasks).toHaveLength(1);
  });

  it('returns a valid PerfData shape', () => {
    // #given
    startPerfCapture();

    // #when
    const data: PerfData = collectPerfData();

    // #then
    expect(typeof data.fcp === 'number' || data.fcp === null).toBe(true);
    expect(typeof data.lcp === 'number' || data.lcp === null).toBe(true);
    expect(typeof data.memoryUsed === 'number' || data.memoryUsed === null).toBe(true);
    expect(typeof data.memoryTotal === 'number' || data.memoryTotal === null).toBe(true);
    expect(Array.isArray(data.longTasks)).toBe(true);
  });
});
