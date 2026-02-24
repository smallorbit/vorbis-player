import { useRef, useMemo } from 'react';
import { useProfilingContext } from '@/contexts/ProfilingContext';

interface ProfilingTimer {
  start: () => void;
  end: (label?: string) => void;
}

const NOOP_TIMER: ProfilingTimer = { start: () => {}, end: () => {} };

export function useProfilingTimer(operationName: string): ProfilingTimer {
  const { enabled, collector } = useProfilingContext();
  const startTimeRef = useRef(0);

  return useMemo<ProfilingTimer>(() => {
    if (!enabled || !collector) return NOOP_TIMER;

    return {
      start: () => {
        startTimeRef.current = performance.now();
      },
      end: (label?: string) => {
        if (startTimeRef.current === 0) return;
        const duration = performance.now() - startTimeRef.current;
        const name = label ? `${operationName}:${label}` : operationName;
        collector.recordOperation(name, duration);
        startTimeRef.current = 0;
      },
    };
  }, [enabled, collector, operationName]);
}
