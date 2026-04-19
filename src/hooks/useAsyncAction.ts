import { useState, useCallback, useRef } from 'react';

import { STATUS_RESET_DELAY_MS } from '@/constants/statusTiming';

export const FEEDBACK_DISPLAY_MS = STATUS_RESET_DELAY_MS;

type AsyncStatus = 'idle' | 'working' | 'done';

export function useAsyncAction(
  asyncFn: () => Promise<void>,
  { resetMs = FEEDBACK_DISPLAY_MS, onReset }: { resetMs?: number; onReset?: () => void } = {},
): [AsyncStatus, () => Promise<void>] {
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setStatus('working');
    await asyncFn();
    setStatus('done');
    timerRef.current = setTimeout(() => {
      setStatus('idle');
      onReset?.();
      timerRef.current = null;
    }, resetMs);
  }, [asyncFn, resetMs, onReset]);

  return [status, run];
}
