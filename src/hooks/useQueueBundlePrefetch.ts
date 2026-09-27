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
      // Lazy queue UI lives in the component layer; dynamic import keeps the
      // hook module out of the static bundle graph (see #1733 layering).
      // eslint-disable-next-line import/no-restricted-paths -- intentional cross-layer prefetch
      void import('@/components/QueueDrawer');
      // eslint-disable-next-line import/no-restricted-paths -- intentional cross-layer prefetch
      void import('@/components/QueueBottomSheet');
    });
  }, [isPlaying]);
}
