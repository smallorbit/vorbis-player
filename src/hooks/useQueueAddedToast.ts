import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';

/**
 * Shared "added to queue / play next" toasts with a View → queue action.
 * Collapses the copy-pasted toast blocks in AudioPlayer (F25).
 */
export function useQueueAddedToast(openQueue: () => void) {
  const viewAction = useMemo(
    () =>
      ({
        label: 'View',
        onClick: openQueue,
      }) as const,
    [openQueue],
  );

  const notifyAdded = useCallback(
    (message: string, toastId: string) => {
      toast(message, { id: toastId, action: viewAction });
    },
    [viewAction],
  );

  const trackWord = useCallback((count: number) => (count === 1 ? 'track' : 'tracks'), []);

  return { notifyAdded, trackWord };
}
