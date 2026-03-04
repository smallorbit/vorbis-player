import type { MediaTrack } from '@/types/domain';
import { getDb } from './dropboxArtCache';

const STORE = 'likes';

/** Custom event name dispatched when likes change (add/remove/clear/import). */
export const LIKES_CHANGED_EVENT = 'vorbis-dropbox-likes-changed';

function notifyLikesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LIKES_CHANGED_EVENT));
  }
}

interface LikedEntry {
  trackId: string;
  track: MediaTrack;
  likedAt: number;
}

/**
 * Open a transaction on the likes store and run the callback.
 * Returns `fallback` if the database is unavailable or the transaction fails.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  fallback: T,
  fn: (store: IDBObjectStore, resolve: (value: T) => void) => void,
): Promise<T> {
  const database = await getDb();
  if (!database) return fallback;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      fn(store, resolve);
      tx.onerror = () => resolve(fallback);
    } catch {
      resolve(fallback);
    }
  });
}

export async function getLikedTracks(): Promise<MediaTrack[]> {
  return withStore<MediaTrack[]>('readonly', [], (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const entries = (req.result as LikedEntry[]) ?? [];
      entries.sort((a, b) => b.likedAt - a.likedAt);
      resolve(entries.map((e) => e.track));
    };
    req.onerror = () => resolve([]);
  });
}

export async function getLikedCount(): Promise<number> {
  return withStore('readonly', 0, (store, resolve) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

export async function isTrackLiked(trackId: string): Promise<boolean> {
  return withStore('readonly', false, (store, resolve) => {
    const req = store.get(trackId);
    req.onsuccess = () => resolve(req.result !== undefined);
    req.onerror = () => resolve(false);
  });
}

export async function setTrackLiked(
  trackId: string,
  track: MediaTrack | null,
  liked: boolean,
): Promise<void> {
  return withStore('readwrite', undefined, (store, resolve) => {
    const tx = store.transaction;
    if (liked && track) {
      const entry: LikedEntry = { trackId, track, likedAt: Date.now() };
      store.put(entry);
    } else {
      store.delete(trackId);
    }
    tx.oncomplete = () => { notifyLikesChanged(); resolve(undefined); };
  });
}

export async function clearLikes(): Promise<void> {
  return withStore('readwrite', undefined, (store, resolve) => {
    const tx = store.transaction;
    store.clear();
    tx.oncomplete = () => { notifyLikesChanged(); resolve(undefined); };
  });
}

export async function exportLikes(): Promise<string> {
  return withStore('readonly', '[]', (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(JSON.stringify(req.result ?? []));
    req.onerror = () => resolve('[]');
  });
}

export async function importLikes(json: string): Promise<number> {
  let entries: LikedEntry[];
  try {
    entries = JSON.parse(json);
    if (!Array.isArray(entries)) return 0;
  } catch {
    return 0;
  }

  return withStore('readwrite', 0, (store, resolve) => {
    const tx = store.transaction;
    let count = 0;
    for (const entry of entries) {
      if (entry.trackId && entry.track) {
        store.put(entry);
        count++;
      }
    }
    tx.oncomplete = () => { notifyLikesChanged(); resolve(count); };
  });
}

/**
 * Updates metadata for liked tracks using freshly scanned track data.
 * Returns the number of liked tracks that were updated. Tracks whose IDs
 * are no longer found in `freshTracks` are removed from likes.
 */
export async function refreshLikedTrackMetadata(
  freshTracks: MediaTrack[],
): Promise<{ updated: number; removed: number }> {
  const freshMap = new Map(freshTracks.map((t) => [t.id, t]));

  return withStore('readwrite', { updated: 0, removed: 0 }, (store, resolve) => {
    const tx = store.transaction;
    const req = store.getAll();
    let updated = 0;
    let removed = 0;

    req.onsuccess = () => {
      const entries = (req.result as LikedEntry[]) ?? [];
      for (const entry of entries) {
        const fresh = freshMap.get(entry.trackId);
        if (fresh) {
          store.put({ ...entry, track: fresh });
          updated++;
        } else {
          store.delete(entry.trackId);
          removed++;
        }
      }
    };

    tx.oncomplete = () => { if (updated > 0 || removed > 0) notifyLikesChanged(); resolve({ updated, removed }); };
  });
}
