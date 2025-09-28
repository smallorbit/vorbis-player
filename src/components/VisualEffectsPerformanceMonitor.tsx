/**
 * Real-time performance monitoring component for VisualEffectsMenu
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { PerformanceProfilerComponent } from './PerformanceProfiler';
import {
  useVisualEffectsPerformance,
  type VisualEffectsPerformanceMetrics,
  VISUAL_EFFECTS_THRESHOLDS
} from '../utils/visualEffectsPerformance';
import { usePlayerSizing } from '../hooks/usePlayerSizing';

interface VisualEffectsPerformanceMonitorProps {
  isEnabled?: boolean;
  onMetricsUpdate?: (metrics: VisualEffectsPerformanceMetrics) => void;
  filterCount: number;
}

const MonitorContainer = styled.div<{ $visible: boolean; $width: number }>`
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 1rem;
  border-radius: 0.5rem;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
  width: ${({ $width }) => $width}px;
  z-index: 10001;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  opacity: ${({ $visible }) => $visible ? 1 : 0};
  pointer-events: ${({ $visible }) => $visible ? 'auto' : 'none'};
  transition: all 0.3s ease;
`;

const MonitorHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 0.5rem;
`;

const MonitorTitle = styled.h4`
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #00ff88;
`;

const ToggleButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.7rem;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const MetricRow = styled.div<{ $status: 'good' | 'warning' | 'error' }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
  border-left: 3px solid ${({ $status }) => {
    switch ($status) {
      case 'good': return '#00ff88';
      case 'warning': return '#ffaa00';
      case 'error': return '#ff4444';
      default: return 'transparent';
    }
  }};
  padding-left: 0.5rem;
`;

const MetricLabel = styled.span`
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
`;

const MetricValue = styled.span<{ $status: 'good' | 'warning' | 'error' }>`
  color: ${({ $status }) => {
    switch ($status) {
      case 'good': return '#00ff88';
      case 'warning': return '#ffaa00';
      case 'error': return '#ff4444';
      default: return 'white';
    }
  }};
  font-weight: 600;
`;

const TestButton = styled.button`
  background: linear-gradient(135deg, #00ff88, #00cc66);
  border: none;
  color: black;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 0.75rem;
  width: 100%;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
  }

  &:disabled {
    background: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ResultsContainer = styled.div`
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  max-height: 200px;
  overflow-y: auto;
`;

export const VisualEffectsPerformanceMonitor: React.FC<VisualEffectsPerformanceMonitorProps> = ({
  isEnabled = import.meta.env.DEV,
  onMetricsUpdate,
  filterCount
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<VisualEffectsPerformanceMetrics | null>(null);
  // Removed unused state for real-time metrics

  const { runTest, validateMetrics, generateReport } = useVisualEffectsPerformance();

  // Get responsive sizing information
  const { viewport, isMobile, isTablet } = usePlayerSizing();

  // Calculate responsive width for the monitor
  const monitorWidth = useMemo(() => {
    if (isMobile) return Math.min(viewport.width * 0.9, 300);
    if (isTablet) return Math.min(viewport.width * 0.4, 350);
    return Math.min(viewport.width * 0.25, 400);
  }, [viewport.width, isMobile, isTablet]);

  // Toggle visibility with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    if (isEnabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isEnabled]);

  const runPerformanceTest = useCallback(async () => {
    if (isTesting) return;

    setIsTesting(true);
    try {
      const metrics = await runTest(filterCount);
      setCurrentMetrics(metrics);

      if (onMetricsUpdate) {
        onMetricsUpdate(metrics);
      }

      console.log('Visual Effects Performance Test Results:');
      console.log(generateReport(metrics));
    } catch (error) {
      console.error('Performance test failed:', error);
    } finally {
      setIsTesting(false);
    }
  }, [runTest, filterCount, onMetricsUpdate, generateReport, isTesting]);

  const getMetricStatus = (value: number, threshold: number, isReverse = false): 'good' | 'warning' | 'error' => {
    const isGood = isReverse ? value >= threshold : value <= threshold;
    const isWarning = isReverse ?
      value >= threshold * 0.9 :
      value <= threshold * 1.2;

    if (isGood) return 'good';
    if (isWarning) return 'warning';
    return 'error';
  };

  const formatValue = (value: number, unit: string, decimals = 2): string => {
    return `${value.toFixed(decimals)}${unit}`;
  };

  if (!isEnabled) {
    return null;
  }

  return (
    <PerformanceProfilerComponent id="visual-effects-performance-monitor">
      <MonitorContainer $visible={isVisible} $width={monitorWidth}>
        <MonitorHeader>
          <MonitorTitle>VFX Performance Monitor</MonitorTitle>
          <ToggleButton onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </ToggleButton>
        </MonitorHeader>

        {isExpanded && (
          <>
            {currentMetrics && (
              <div>
                <MetricRow $status={getMetricStatus(currentMetrics.interactionTime, VISUAL_EFFECTS_THRESHOLDS.maxInteractionTime)}>
                  <MetricLabel>Interaction Time:</MetricLabel>
                  <MetricValue $status={getMetricStatus(currentMetrics.interactionTime, VISUAL_EFFECTS_THRESHOLDS.maxInteractionTime)}>
                    {formatValue(currentMetrics.interactionTime, 'ms')}
                  </MetricValue>
                </MetricRow>

                <MetricRow $status={getMetricStatus(currentMetrics.renderTime, VISUAL_EFFECTS_THRESHOLDS.maxRenderTime)}>
                  <MetricLabel>Render Time:</MetricLabel>
                  <MetricValue $status={getMetricStatus(currentMetrics.renderTime, VISUAL_EFFECTS_THRESHOLDS.maxRenderTime)}>
                    {formatValue(currentMetrics.renderTime, 'ms')}
                  </MetricValue>
                </MetricRow>

                <MetricRow $status={getMetricStatus(currentMetrics.scrollDuration, VISUAL_EFFECTS_THRESHOLDS.maxScrollDuration)}>
                  <MetricLabel>Scroll Duration:</MetricLabel>
                  <MetricValue $status={getMetricStatus(currentMetrics.scrollDuration, VISUAL_EFFECTS_THRESHOLDS.maxScrollDuration)}>
                    {formatValue(currentMetrics.scrollDuration, 'ms')}
                  </MetricValue>
                </MetricRow>

                <MetricRow $status={getMetricStatus(currentMetrics.glowAnimationFrameRate, VISUAL_EFFECTS_THRESHOLDS.minGlowFrameRate, true)}>
                  <MetricLabel>Glow Frame Rate:</MetricLabel>
                  <MetricValue $status={getMetricStatus(currentMetrics.glowAnimationFrameRate, VISUAL_EFFECTS_THRESHOLDS.minGlowFrameRate, true)}>
                    {formatValue(currentMetrics.glowAnimationFrameRate, 'fps')}
                  </MetricValue>
                </MetricRow>

                <MetricRow $status={getMetricStatus(currentMetrics.virtualListRenderTime, VISUAL_EFFECTS_THRESHOLDS.maxVirtualListRenderTime)}>
                  <MetricLabel>Virtual List Render:</MetricLabel>
                  <MetricValue $status={getMetricStatus(currentMetrics.virtualListRenderTime, VISUAL_EFFECTS_THRESHOLDS.maxVirtualListRenderTime)}>
                    {formatValue(currentMetrics.virtualListRenderTime, 'ms')}
                  </MetricValue>
                </MetricRow>

                <MetricRow $status={getMetricStatus(currentMetrics.mainThreadBlocking, VISUAL_EFFECTS_THRESHOLDS.maxMainThreadBlocking)}>
                  <MetricLabel>Main Thread Block:</MetricLabel>
                  <MetricValue $status={getMetricStatus(currentMetrics.mainThreadBlocking, VISUAL_EFFECTS_THRESHOLDS.maxMainThreadBlocking)}>
                    {formatValue(currentMetrics.mainThreadBlocking, 'ms')}
                  </MetricValue>
                </MetricRow>

                {currentMetrics.memoryUsage && (
                  <MetricRow $status="good">
                    <MetricLabel>Memory Usage:</MetricLabel>
                    <MetricValue $status="good">
                      {formatValue(currentMetrics.memoryUsage, 'MB')}
                    </MetricValue>
                  </MetricRow>
                )}
              </div>
            )}

            <TestButton
              onClick={runPerformanceTest}
              disabled={isTesting}
            >
              {isTesting ? 'Running Test...' : 'Run Performance Test'}
            </TestButton>

            {currentMetrics && (
              <ResultsContainer>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Test completed at {new Date(currentMetrics.timestamp).toLocaleTimeString()}
                </div>
                <div style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
                  Status: {validateMetrics(currentMetrics).passed ?
                    <span style={{ color: '#00ff88' }}>✅ PASSED</span> :
                    <span style={{ color: '#ff4444' }}>❌ NEEDS OPTIMIZATION</span>
                  }
                </div>
              </ResultsContainer>
            )}
          </>
        )}

        {!isExpanded && (
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            Press Ctrl+Shift+P to toggle • Click to expand
          </div>
        )}
      </MonitorContainer>
    </PerformanceProfilerComponent>
  );
};

export default VisualEffectsPerformanceMonitor;