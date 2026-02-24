import React, { useCallback } from 'react';
import type { ProfilerOnRenderCallback } from 'react';
import { useProfilingContext } from '@/contexts/ProfilingContext';

interface ProfiledComponentProps {
  id: string;
  children: React.ReactNode;
}

export function ProfiledComponent({ id, children }: ProfiledComponentProps): React.ReactElement {
  const { enabled, collector } = useProfilingContext();

  const handleRender: ProfilerOnRenderCallback = useCallback(
    (
      profilerId: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
    ) => {
      collector?.recordRender(profilerId, phase, actualDuration, baseDuration);
    },
    [collector],
  );

  if (!enabled) return <>{children}</>;

  return (
    <React.Profiler id={id} onRender={handleRender}>
      {children}
    </React.Profiler>
  );
}
