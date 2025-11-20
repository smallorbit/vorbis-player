/**
 * Performance testing utilities specifically for VisualEffectsMenu optimization
 */

import { PerformanceProfiler, type PerformanceMetrics } from './performanceMonitor';

export interface VisualEffectsPerformanceMetrics extends PerformanceMetrics {
  filterCount: number;
  scrollDuration: number;
  glowAnimationFrameRate: number;
  virtualListRenderTime: number;
}

export interface VisualEffectsThresholds {
  maxInteractionTime: number; // Target < 200ms for filter adjustments
  maxRenderTime: number; // Target < 16.67ms for 60fps
  maxMainThreadBlocking: number; // Target < 50ms
  maxScrollDuration: number; // Target < 100ms for smooth scrolling
  minGlowFrameRate: number; // Target > 55fps during glow animations
  maxVirtualListRenderTime: number; // Target < 10ms for virtual list renders
}

export const VISUAL_EFFECTS_THRESHOLDS: VisualEffectsThresholds = {
  maxInteractionTime: 200,
  maxRenderTime: 16.67,
  maxMainThreadBlocking: 50,
  maxScrollDuration: 100,
  minGlowFrameRate: 55,
  maxVirtualListRenderTime: 10
};

/**
 * Specialized performance profiler for visual effects
 */
export class VisualEffectsProfiler extends PerformanceProfiler {
  private scrollStartTime: number = 0;
  private glowFrameCount: number = 0;
  private glowStartTime: number = 0;
  private virtualListRenderStart: number = 0;

  /**
   * Start tracking scroll performance
   */
  startScrollTracking(): void {
    this.scrollStartTime = performance.now();
  }

  /**
   * End scroll tracking and return duration
   */
  endScrollTracking(): number {
    return performance.now() - this.scrollStartTime;
  }

  /**
   * Start tracking glow animation frame rate
   */
  startGlowTracking(): void {
    this.glowFrameCount = 0;
    this.glowStartTime = performance.now();
    this.measureGlowFrameRate();
  }

  /**
   * End glow tracking and return frame rate
   */
  endGlowTracking(): number {
    const duration = performance.now() - this.glowStartTime;
    return duration > 0 ? (this.glowFrameCount * 1000) / duration : 0;
  }

  /**
   * Start virtual list render tracking
   */
  startVirtualListRender(): void {
    this.virtualListRenderStart = performance.now();
  }

  /**
   * End virtual list render tracking
   */
  endVirtualListRender(): number {
    return performance.now() - this.virtualListRenderStart;
  }

  private measureGlowFrameRate = (): void => {
    this.glowFrameCount++;
    const elapsed = performance.now() - this.glowStartTime;
    
    if (elapsed < 5000) { // Track for 5 seconds max
      requestAnimationFrame(this.measureGlowFrameRate);
    }
  };

  /**
   * Run comprehensive visual effects performance test
   */
  async runPerformanceTest(filterCount: number = 7): Promise<VisualEffectsPerformanceMetrics> {
    this.startProfiling();
    
    // Simulate scroll performance
    this.startScrollTracking();
    await this.simulateScrolling();
    const scrollDuration = this.endScrollTracking();

    // Simulate glow animation
    this.startGlowTracking();
    await this.simulateGlowAnimation();
    const glowAnimationFrameRate = this.endGlowTracking();

    // Measure virtual list render time
    this.startVirtualListRender();
    await this.simulateVirtualListRender();
    const virtualListRenderTime = this.endVirtualListRender();

    const baseMetrics = this.endProfiling();

    return {
      ...baseMetrics,
      filterCount,
      scrollDuration,
      glowAnimationFrameRate,
      virtualListRenderTime
    };
  }

  /**
   * Validate visual effects specific metrics
   */
  validateVisualEffectsMetrics(
    metrics: VisualEffectsPerformanceMetrics,
    thresholds: VisualEffectsThresholds = VISUAL_EFFECTS_THRESHOLDS
  ): { passed: boolean; failures: string[] } {
    const failures: string[] = [];

    if (metrics.interactionTime > thresholds.maxInteractionTime) {
      failures.push(`Interaction time ${metrics.interactionTime.toFixed(2)}ms exceeds threshold ${thresholds.maxInteractionTime}ms`);
    }

    if (metrics.renderTime > thresholds.maxRenderTime) {
      failures.push(`Render time ${metrics.renderTime.toFixed(2)}ms exceeds threshold ${thresholds.maxRenderTime}ms`);
    }

    if (metrics.mainThreadBlocking > thresholds.maxMainThreadBlocking) {
      failures.push(`Main thread blocking ${metrics.mainThreadBlocking.toFixed(2)}ms exceeds threshold ${thresholds.maxMainThreadBlocking}ms`);
    }

    if (metrics.scrollDuration > thresholds.maxScrollDuration) {
      failures.push(`Scroll duration ${metrics.scrollDuration.toFixed(2)}ms exceeds threshold ${thresholds.maxScrollDuration}ms`);
    }

    if (metrics.glowAnimationFrameRate < thresholds.minGlowFrameRate) {
      failures.push(`Glow frame rate ${metrics.glowAnimationFrameRate.toFixed(2)}fps below threshold ${thresholds.minGlowFrameRate}fps`);
    }

    if (metrics.virtualListRenderTime > thresholds.maxVirtualListRenderTime) {
      failures.push(`Virtual list render time ${metrics.virtualListRenderTime.toFixed(2)}ms exceeds threshold ${thresholds.maxVirtualListRenderTime}ms`);
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }

  /**
   * Generate detailed performance report for visual effects
   */
  generateVisualEffectsReport(metrics: VisualEffectsPerformanceMetrics): string {
    const validation = this.validateVisualEffectsMetrics(metrics);
    
    return `
Visual Effects Performance Report
=================================
Filter Performance:
- Filter Count: ${metrics.filterCount}
- Interaction Time: ${metrics.interactionTime.toFixed(2)}ms (target: <200ms)
- Virtual List Render: ${metrics.virtualListRenderTime.toFixed(2)}ms (target: <10ms)

Scrolling Performance:
- Scroll Duration: ${metrics.scrollDuration.toFixed(2)}ms (target: <100ms)
- Render Time: ${metrics.renderTime.toFixed(2)}ms (target: <16.67ms for 60fps)

Animation Performance:
- Glow Frame Rate: ${metrics.glowAnimationFrameRate.toFixed(2)}fps (target: >55fps)
- Main Thread Blocking: ${metrics.mainThreadBlocking.toFixed(2)}ms (target: <50ms)

Resource Usage:
- Memory Usage: ${metrics.memoryUsage?.toFixed(2) || 'N/A'}MB
- Timestamp: ${new Date(metrics.timestamp).toISOString()}

Validation Results:
${validation.passed ? '✅ ALL TESTS PASSED' : '❌ PERFORMANCE ISSUES DETECTED'}
${validation.failures.length > 0 ? '\nFailures:\n' + validation.failures.map(f => `- ${f}`).join('\n') : ''}

Recommendations:
${this.generateRecommendations(metrics, validation)}
    `.trim();
  }

  private generateRecommendations(
    metrics: VisualEffectsPerformanceMetrics,
    validation: { passed: boolean; failures: string[] }
  ): string {
    if (validation.passed) {
      return '✅ Performance is optimal. No improvements needed.';
    }

    const recommendations: string[] = [];

    if (metrics.interactionTime > VISUAL_EFFECTS_THRESHOLDS.maxInteractionTime) {
      recommendations.push('- Optimize filter change handlers with debouncing');
      recommendations.push('- Consider reducing filter calculation complexity');
    }

    if (metrics.scrollDuration > VISUAL_EFFECTS_THRESHOLDS.maxScrollDuration) {
      recommendations.push('- Enable hardware acceleration for scroll containers');
      recommendations.push('- Increase virtual list overscan for smoother scrolling');
    }

    if (metrics.glowAnimationFrameRate < VISUAL_EFFECTS_THRESHOLDS.minGlowFrameRate) {
      recommendations.push('- Optimize glow animation using CSS transforms');
      recommendations.push('- Consider reducing glow complexity during animations');
    }

    if (metrics.virtualListRenderTime > VISUAL_EFFECTS_THRESHOLDS.maxVirtualListRenderTime) {
      recommendations.push('- Optimize virtual list item rendering');
      recommendations.push('- Add more aggressive memoization to list items');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '- Review overall component architecture for optimization opportunities';
  }

  private async simulateScrolling(): Promise<void> {
    return new Promise(resolve => {
      let scrollPosition = 0;
      const scrollStep = () => {
        scrollPosition += 10;
        if (scrollPosition < 200) {
          requestAnimationFrame(scrollStep);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(scrollStep);
    });
  }

  private async simulateGlowAnimation(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, 1000); // Simulate 1 second of glow animation
    });
  }

  private async simulateVirtualListRender(): Promise<void> {
    return new Promise(resolve => {
      // Simulate virtual list render work
      const start = performance.now();
      while (performance.now() - start < 5) {
        // Simulate render work for 5ms
      }
      resolve();
    });
  }
}

/**
 * React hook for visual effects performance testing
 */
export const useVisualEffectsPerformance = () => {
  const profiler = new VisualEffectsProfiler();

  return {
    runTest: (filterCount?: number) => profiler.runPerformanceTest(filterCount),
    validateMetrics: (metrics: VisualEffectsPerformanceMetrics) => 
      profiler.validateVisualEffectsMetrics(metrics),
    generateReport: (metrics: VisualEffectsPerformanceMetrics) => 
      profiler.generateVisualEffectsReport(metrics),
    startScrollTracking: () => profiler.startScrollTracking(),
    endScrollTracking: () => profiler.endScrollTracking(),
    startGlowTracking: () => profiler.startGlowTracking(),
    endGlowTracking: () => profiler.endGlowTracking()
  };
};

