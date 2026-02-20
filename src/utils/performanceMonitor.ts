/**
 * Performance monitoring utilities for measuring and validating UI performance
 */

export interface PerformanceMetrics {
  interactionTime: number;
  renderTime: number;
  mainThreadBlocking: number;
  memoryUsage?: number;
  timestamp: number;
}

interface PerformanceThresholds {
  maxInteractionTime: number; // Target < 200ms
  maxRenderTime: number; // Target < 16.67ms (60fps)
  maxMainThreadBlocking: number; // Target < 50ms
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  maxInteractionTime: 200,
  maxRenderTime: 16.67,
  maxMainThreadBlocking: 50
};

/**
 * Measures interaction time from start to end
 */
class InteractionTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  getTime(): number {
    return this.endTime - this.startTime;
  }
}

/**
 * Measures frame rate and render performance
 */
class FrameRateMonitor {
  private frameCount: number = 0;
  private lastTime: number = 0;
  private frameRate: number = 0;
  private isMonitoring: boolean = false;

  start(): void {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.isMonitoring = true;
    this.measureFrameRate();
  }

  stop(): number {
    this.isMonitoring = false;
    return this.frameRate;
  }

  private measureFrameRate = (): void => {
    if (!this.isMonitoring) return;

    this.frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;

    if (elapsed >= 1000) { // Calculate every second
      this.frameRate = (this.frameCount * 1000) / elapsed;
      this.frameCount = 0;
      this.lastTime = currentTime;
    }

    requestAnimationFrame(this.measureFrameRate);
  };

  getCurrentFrameRate(): number {
    return this.frameRate;
  }
}

/**
 * Monitors main thread blocking time
 */
class MainThreadMonitor {
  private observer: PerformanceObserver | null = null;
  private blockingTimes: number[] = [];

  start(): void {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'longtask') {
            this.blockingTimes.push(entry.duration);
          }
        });
      });

      try {
        this.observer.observe({ entryTypes: ['longtask'] });
      } catch {
        console.warn('Long task observer not supported');
      }
    }
  }

  stop(): number[] {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    const times = [...this.blockingTimes];
    this.blockingTimes = [];
    return times;
  }

  getAverageBlockingTime(): number {
    if (this.blockingTimes.length === 0) return 0;
    return this.blockingTimes.reduce((sum, time) => sum + time, 0) / this.blockingTimes.length;
  }
}

/**
 * Memory usage monitor
 */
class MemoryMonitor {
  static getCurrentUsage(): number | undefined {
    if ('memory' in performance) {
      const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      return memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return undefined;
  }

  static getMemoryPressure(): 'low' | 'medium' | 'high' | 'unknown' {
    const usage = this.getCurrentUsage();
    if (usage === undefined) return 'unknown';
    
    if (usage < 50) return 'low';
    if (usage < 100) return 'medium';
    return 'high';
  }
}

/**
 * Comprehensive performance profiler
 */
export class PerformanceProfiler {
  private interactionTimer = new InteractionTimer();
  private frameRateMonitor = new FrameRateMonitor();
  private mainThreadMonitor = new MainThreadMonitor();
  private metrics: PerformanceMetrics[] = [];

  startProfiling(): void {
    this.interactionTimer.start();
    this.frameRateMonitor.start();
    this.mainThreadMonitor.start();
  }

  endProfiling(): PerformanceMetrics {
    const interactionTime = this.interactionTimer.end();
    const frameRate = this.frameRateMonitor.stop();
    const blockingTimes = this.mainThreadMonitor.stop();
    const memoryUsage = MemoryMonitor.getCurrentUsage();

    const renderTime = frameRate > 0 ? 1000 / frameRate : 0;
    const mainThreadBlocking = blockingTimes.length > 0 
      ? blockingTimes.reduce((sum, time) => sum + time, 0) / blockingTimes.length 
      : 0;

    const metrics: PerformanceMetrics = {
      interactionTime,
      renderTime,
      mainThreadBlocking,
      memoryUsage,
      timestamp: Date.now()
    };

    this.metrics.push(metrics);
    return metrics;
  }

  validateMetrics(metrics: PerformanceMetrics, thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS): boolean {
    return (
      metrics.interactionTime <= thresholds.maxInteractionTime &&
      metrics.renderTime <= thresholds.maxRenderTime &&
      metrics.mainThreadBlocking <= thresholds.maxMainThreadBlocking
    );
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  clearHistory(): void {
    this.metrics = [];
  }

  generateReport(): string {
    if (this.metrics.length === 0) {
      return 'No performance data collected';
    }

    const latest = this.metrics[this.metrics.length - 1];
    const averageInteraction = this.metrics.reduce((sum, m) => sum + m.interactionTime, 0) / this.metrics.length;
    const averageRender = this.metrics.reduce((sum, m) => sum + m.renderTime, 0) / this.metrics.length;
    const averageBlocking = this.metrics.reduce((sum, m) => sum + m.mainThreadBlocking, 0) / this.metrics.length;

    return `
Performance Report:
==================
Latest Metrics:
- Interaction Time: ${latest.interactionTime.toFixed(2)}ms (target: <200ms)
- Render Time: ${latest.renderTime.toFixed(2)}ms (target: <16.67ms for 60fps)
- Main Thread Blocking: ${latest.mainThreadBlocking.toFixed(2)}ms (target: <50ms)
- Memory Usage: ${latest.memoryUsage?.toFixed(2) || 'N/A'}MB

Averages (${this.metrics.length} samples):
- Interaction Time: ${averageInteraction.toFixed(2)}ms
- Render Time: ${averageRender.toFixed(2)}ms
- Main Thread Blocking: ${averageBlocking.toFixed(2)}ms

Validation: ${this.validateMetrics(latest) ? '✅ PASSED' : '❌ FAILED'}
    `.trim();
  }
}

