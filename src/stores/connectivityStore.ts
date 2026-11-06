/**
 * ConnectivityStore — the app's single online/offline listener (#1716).
 *
 * One pair of window listeners, attached on first use, feeds every consumer:
 * the library sync engine pauses polling while offline and re-syncs on
 * reconnect, and `useConnectivityToast` tells the user. Consumers never add
 * their own `online`/`offline` listeners.
 */

type ConnectivityListener = (isOnline: boolean) => void;

const listeners = new Set<ConnectivityListener>();
let online = true;
let attached = false;

function readNavigatorOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function handleConnectivityChange(): void {
  const next = readNavigatorOnline();
  if (next === online) return;
  online = next;
  for (const listener of listeners) {
    listener(online);
  }
}

function ensureAttached(): void {
  if (attached || typeof window === 'undefined') return;
  attached = true;
  online = readNavigatorOnline();
  window.addEventListener('online', handleConnectivityChange);
  window.addEventListener('offline', handleConnectivityChange);
}

export const connectivityStore = {
  isOnline(): boolean {
    ensureAttached();
    return online;
  },

  /** Called only on transitions, with the new state. */
  subscribe(listener: ConnectivityListener): () => void {
    ensureAttached();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
