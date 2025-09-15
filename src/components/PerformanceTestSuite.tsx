/**
 * Performance testing suite for validating UI optimizations
 */

import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { PerformanceProfiler, DEFAULT_THRESHOLDS } from '../utils/performanceMonitor';
import type { PerformanceMetrics } from '../utils/performanceMonitor';
import { theme } from '../styles/theme';

interface TestResult {
  testName: string;
  metrics: PerformanceMetrics;
  passed: boolean;
  timestamp: number;
}

interface PerformanceTestSuiteProps {
  isVisible: boolean;
  onClose: () => void;
}

const TestSuiteContainer = styled.div<{ $isVisible: boolean }>`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  max-height: 80vh;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(20px);
  border: 1px solid ${theme.colors.popover.border};
  border-radius: 1rem;
  z-index: ${theme.zIndex.modal + 1};
  overflow-y: auto;
  opacity: ${({ $isVisible }) => ($isVisible ? 1 : 0)};
  pointer-events: ${({ $isVisible }) => ($isVisible ? 'auto' : 'none')};
  visibility: ${({ $isVisible }) => ($isVisible ? 'visible' : 'hidden')};
  transition: all 0.3s ease;
  -webkit-app-region: no-drag;
`;

const TestHeader = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TestTitle = styled.h2`
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.25rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  
  &:hover {
    color: ${theme.colors.white};
    background: ${theme.colors.muted.background};
  }
`;

const TestContent = styled.div`
  padding: 1.5rem;
`;

const TestButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  background: ${({ $variant }) => $variant === 'primary' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'};
  border: 1px solid ${({ $variant }) => $variant === 'primary' ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)'};
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  margin: 0.25rem;
  
  &:hover {
    background: ${({ $variant }) => $variant === 'primary' ? '#2563eb' : 'rgba(255, 255, 255, 0.2)'};
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const TestResults = styled.div`
  margin-top: 1rem;
  max-height: 300px;
  overflow-y: auto;
`;

const ResultItem = styled.div<{ $passed: boolean }>`
  padding: 0.75rem;
  margin: 0.5rem 0;
  background: ${({ $passed }) => $passed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
  border: 1px solid ${({ $passed }) => $passed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
  border-radius: 0.5rem;
  font-family: monospace;
  font-size: 0.75rem;
`;

const MetricRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin: 0.25rem 0;
`;

const ProgressIndicator = styled.div`
  padding: 1rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
`;

export const PerformanceTestSuite: React.FC<PerformanceTestSuiteProps> = ({
  isVisible,
  onClose
}) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  const runSingleTest = useCallback(async (
    testName: string,
    testFn: () => Promise<void> | void,
    expectedThresholds = DEFAULT_THRESHOLDS
  ): Promise<TestResult> => {
    setCurrentTest(testName);

    const profiler = new PerformanceProfiler();
    profiler.startProfiling();

    try {
      await testFn();
    } catch (error) {
      console.error(`Test ${testName} failed:`, error);
    }

    // Wait a frame to ensure all updates are complete
    await new Promise(resolve => requestAnimationFrame(resolve));

    const metrics = profiler.endProfiling();
    const passed = profiler.validateMetrics(metrics, expectedThresholds);

    return {
      testName,
      metrics,
      passed,
      timestamp: Date.now()
    };
  }, []);

  const runInteractionTest = useCallback(async () => {
    return runSingleTest('Button Click Response Time', async () => {
      // Simulate button click
      const button = document.querySelector('[data-testid="visual-effects-button"]') as HTMLElement;
      if (button) {
        button.click();
        // Wait for any state updates
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, { maxInteractionTime: 200, maxRenderTime: 16.67, maxMainThreadBlocking: 50 });
  }, [runSingleTest]);

  const runGlowAnimationTest = useCallback(async () => {
    return runSingleTest('Glow Animation Performance', async () => {
      // Enable glow and let it animate for a short period
      const glowToggle = document.querySelector('[data-testid="glow-toggle"]') as HTMLElement;
      if (glowToggle) {
        glowToggle.click();
        // Let glow animate for 500ms
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }, { maxInteractionTime: 100, maxRenderTime: 16.67, maxMainThreadBlocking: 30 });
  }, [runSingleTest]);

  const runFilterScrollTest = useCallback(async () => {
    return runSingleTest('Virtual Scroll Performance', async () => {
      // Simulate scrolling through filter list
      const scrollContainer = document.querySelector('[data-testid="filter-scroll-container"]') as HTMLElement;
      if (scrollContainer) {
        // Simulate multiple scroll events
        for (let i = 0; i < 10; i++) {
          scrollContainer.scrollTop = i * 20;
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }
    }, { maxInteractionTime: 150, maxRenderTime: 16.67, maxMainThreadBlocking: 40 });
  }, [runSingleTest]);

  const runMemoryLeakTest = useCallback(async () => {
    return runSingleTest('Memory Usage Stability', async () => {
      const initialMemory = (performance as Record<string, unknown>).memory ? ((performance as Record<string, unknown>).memory as { usedJSHeapSize: number }).usedJSHeapSize : 0;

      // Perform multiple operations that could cause memory leaks
      for (let i = 0; i < 20; i++) {
        // Toggle visual effects menu
        const toggleButton = document.querySelector('[data-testid="visual-effects-button"]') as HTMLElement;
        if (toggleButton) {
          toggleButton.click();
          await new Promise(resolve => setTimeout(resolve, 10));
          toggleButton.click();
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Force garbage collection if available
      const windowGlobal = window as Record<string, unknown>;
      if (windowGlobal.gc && typeof windowGlobal.gc === 'function') {
        (windowGlobal.gc as () => void)();
      }

      const finalMemory = (performance as Record<string, unknown>).memory ? ((performance as Record<string, unknown>).memory as { usedJSHeapSize: number }).usedJSHeapSize : 0;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      if (memoryIncrease > 5) { // More than 5MB increase is concerning
        throw new Error(`Memory increased by ${memoryIncrease.toFixed(2)}MB`);
      }
    });
  }, [runSingleTest]);

  const runFullTestSuite = useCallback(async () => {
    setIsRunning(true);
    setTestResults([]);

    const tests = [
      runInteractionTest,
      runGlowAnimationTest,
      runFilterScrollTest,
      runMemoryLeakTest
    ];

    const results: TestResult[] = [];

    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
        setTestResults([...results]);

        // Brief pause between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Test failed:', error);
      }
    }

    setCurrentTest('');
    setIsRunning(false);
  }, [runInteractionTest, runGlowAnimationTest, runFilterScrollTest, runMemoryLeakTest]);

  const clearResults = useCallback(() => {
    setTestResults([]);
  }, []);

  const formatMetric = (value: number, unit: string, threshold: number) => {
    const passed = value <= threshold;
    return (
      <span style={{ color: passed ? '#22c55e' : '#ef4444' }}>
        {value.toFixed(2)}{unit} (threshold: {threshold}{unit})
      </span>
    );
  };

  return (
    <TestSuiteContainer $isVisible={isVisible}>
      <TestHeader>
        <TestTitle>Performance Test Suite</TestTitle>
        <CloseButton onClick={onClose}>✕</CloseButton>
      </TestHeader>

      <TestContent>
        <div style={{ marginBottom: '1rem' }}>
          <TestButton $variant="primary" onClick={runFullTestSuite} disabled={isRunning}>
            {isRunning ? 'Running Tests...' : 'Run Full Test Suite'}
          </TestButton>
          <TestButton onClick={clearResults} disabled={isRunning}>
            Clear Results
          </TestButton>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <TestButton onClick={runInteractionTest} disabled={isRunning}>
            Interaction Test
          </TestButton>
          <TestButton onClick={runGlowAnimationTest} disabled={isRunning}>
            Glow Animation Test
          </TestButton>
          <TestButton onClick={runFilterScrollTest} disabled={isRunning}>
            Virtual Scroll Test
          </TestButton>
          <TestButton onClick={runMemoryLeakTest} disabled={isRunning}>
            Memory Test
          </TestButton>
        </div>

        {isRunning && (
          <ProgressIndicator>
            Running: {currentTest || 'Preparing tests...'}
          </ProgressIndicator>
        )}

        <TestResults>
          {testResults.map((result, index) => (
            <ResultItem key={index} $passed={result.passed}>
              <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {result.passed ? '✅' : '❌'} {result.testName}
              </div>
              <MetricRow>
                <span>Interaction Time:</span>
                {formatMetric(result.metrics.interactionTime, 'ms', DEFAULT_THRESHOLDS.maxInteractionTime)}
              </MetricRow>
              <MetricRow>
                <span>Render Time:</span>
                {formatMetric(result.metrics.renderTime, 'ms', DEFAULT_THRESHOLDS.maxRenderTime)}
              </MetricRow>
              <MetricRow>
                <span>Main Thread Blocking:</span>
                {formatMetric(result.metrics.mainThreadBlocking, 'ms', DEFAULT_THRESHOLDS.maxMainThreadBlocking)}
              </MetricRow>
              {result.metrics.memoryUsage && (
                <MetricRow>
                  <span>Memory Usage:</span>
                  <span>{result.metrics.memoryUsage.toFixed(2)}MB</span>
                </MetricRow>
              )}
            </ResultItem>
          ))}
        </TestResults>

        {testResults.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Summary: {testResults.filter(r => r.passed).length}/{testResults.length} tests passed
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              Target: Interaction &lt;200ms, Render &lt;16.67ms (60fps), Main Thread &lt;50ms
            </div>
          </div>
        )}
      </TestContent>
    </TestSuiteContainer>
  );
};