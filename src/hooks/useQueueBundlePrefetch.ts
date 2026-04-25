import { useEffect, useRef } from 'react';

export function useQueueBundlePrefetch(isPlaying: boolean, _currentTrackId?: string): void {
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!isPlaying || hasFiredRef.current) return;
    hasFiredRef.current = true;

    const ric = window.requestIdleCallback;
    const schedule: (cb: IdleRequestCallback) => void = ric
      ? (cb) => { ric(cb); }
      : (cb) => {
          window.setTimeout(
            () => cb({ didTimeout: false, timeRemaining: () => 0 }),
            0,
          );
        };

    schedule(() => {
      void import('@/components/QueueDrawer');
      void import('@/components/QueueBottomSheet');
    });
  }, [isPlaying]);
}
