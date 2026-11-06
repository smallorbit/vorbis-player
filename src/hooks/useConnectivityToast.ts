import { useEffect } from 'react';
import { toast } from 'sonner';
import { connectivityStore } from '@/stores/connectivityStore';

const CONNECTIVITY_TOAST_ID = 'connectivity';
const BACK_ONLINE_DURATION_MS = 3000;

/** Persistent toast while offline; replaced by a brief confirmation on reconnect. */
export function useConnectivityToast(): void {
  useEffect(() => {
    const showOffline = () =>
      toast("You're offline. Library sync is paused until you reconnect.", {
        id: CONNECTIVITY_TOAST_ID,
        duration: Infinity,
      });

    if (!connectivityStore.isOnline()) showOffline();

    return connectivityStore.subscribe((isOnline) => {
      if (isOnline) {
        toast.success('Back online', { id: CONNECTIVITY_TOAST_ID, duration: BACK_ONLINE_DURATION_MS });
      } else {
        showOffline();
      }
    });
  }, []);
}
