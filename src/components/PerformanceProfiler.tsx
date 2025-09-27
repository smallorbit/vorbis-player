/**
 * React Profiler component for measuring component performance
 */

import React, { Profiler, useCallback, useState } from 'react';
import type { ProfilerOnRenderCallback } from 'react';
import type { ProfilerData } from '../hooks/useProfilerData';



interface PerformanceProfilerProps {
  id: string;
  children: React.ReactNode;
  onRender?: (data: ProfilerData) => void;
  enabled?: boolean;
}

export const PerformanceProfilerComponent: React.FC<PerformanceProfilerProps> = ({ 
  id, 
  children, 
  onRender,
  enabled = import.meta.env.DEV
}) => {
  const handleRender: ProfilerOnRenderCallback = useCallback((
    id: string,
    phase: 'mount' | 'update' | 'nested-update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    const data: ProfilerData = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      interactions: new Set()
    };
    
    if (onRender) {
      onRender(data);
    }

    // Log performance warnings
    if (actualDuration > 16.67) { // Slower than 60fps
      console.warn(`[Performance] Component ${id} took ${actualDuration.toFixed(2)}ms to render (>${16.67}ms threshold)`);
    }
  }, [onRender]);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Profiler id={id} onRender={handleRender}>
      {children}
    </Profiler>
  );
};



/**
 * Performance debugging component
 */
export const PerformanceDebugger: React.FC<{ 
  visible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> = ({ 
  visible = import.meta.env.DEV,
  position = 'bottom-right'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!visible) return null;

  const positionStyles = {
    'top-left': { top: '1rem', left: '1rem' },
    'top-right': { top: '1rem', right: '1rem' },
    'bottom-left': { bottom: '1rem', left: '1rem' },
    'bottom-right': { bottom: '1rem', right: '1rem' }
  };

  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles[position],
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '0.5rem',
        borderRadius: '0.5rem',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        zIndex: 10000,
        minWidth: '200px',
        backdropFilter: 'blur(10px)'
      }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left'
        }}
      >
        🔍 Performance Monitor {isExpanded ? '▼' : '▶'}
      </button>
      
      {isExpanded && (
        <div style={{ marginTop: '0.5rem' }}>
          <div>Memory: {(performance as unknown as { memory?: { usedJSHeapSize: number } }).memory ? 
            `${(((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024 / 1024).toFixed(1))}MB` : 
            'N/A'
          }</div>
          <div>Frame Rate: ~{Math.round(1000 / 16.67)}fps target</div>
          <div>Press Ctrl+Shift+P for Performance Tests</div>
        </div>
      )}
    </div>
  );
};