/**
 * React Profiler component for measuring component performance
 */

import React, { Profiler, useCallback } from 'react';
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



