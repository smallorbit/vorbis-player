import { useRef } from 'react';
import { useProfilingContext } from '@/contexts/ProfilingContext';

export function useRenderTracking(componentId: string, props?: Record<string, unknown>): void {
  const { enabled, collector } = useProfilingContext();
  const renderCountRef = useRef(0);
  const prevPropsRef = useRef<Record<string, unknown> | undefined>(undefined);

  if (!enabled) return;

  renderCountRef.current++;
  collector?.recordRender(componentId, 'update', 0, 0);

  if (props) {
    const prev = prevPropsRef.current;
    if (prev) {
      const changedKeys = Object.keys(props).filter((key) => props[key] !== prev[key]);
      const removedKeys = Object.keys(prev).filter((key) => !(key in props));
      const allChanged = [...changedKeys, ...removedKeys];
      if (allChanged.length > 0) {
        console.log(`[Profiling] ${componentId} render #${renderCountRef.current} — changed: ${allChanged.join(', ')}`);
      }
    }
    prevPropsRef.current = props;
  }
}
