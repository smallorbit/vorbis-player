import type { MediaTrack } from '@/types/domain';
import { DROPBOX_LIKES_CHANGED_EVENT, dispatchAppEvent } from '@/constants/events';
import { logCaughtError } from '@/utils/logCaughtError';
import { getDb, runDropboxWrite } from './dropboxIdb';

const STORE = 'likes';

function notifyLikesChanged(): void {
  dispatchAppEvent(DROPBOX_LIKES_CHANGED_EVENT);
}

export interface LikedEntry {
  trackId: string;
  track: MediaTrack;
  likedAt: number;
}

function isLikedEntry(value: unknown): value is LikedEntry {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.trackId === 'string' &&
    typeof record.likedAt === 'number' &&
    typeof record.track === 'object' &&
    record.track !== null
  );
}

const TOMBSTONE_STORE = 'tombstones';

/**
 * Open a readonly transaction. Returns `fallback` if the database is
 * unavailable or the transaction fails.
 */
async function withIdbRead<T>(
  storeName: string,
  fallback: T,
  fn: (store: IDBObjectStore, resolve: (value: T) => void) => void,
): Promise<T> {
  const database = await getDb();
  if (!database) return fallback;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      fn(store, resolve);
      tx.onerror = () => resolve(fallback);
    } catch (err) {
      logCaughtError('dropboxLikesCache.withIdbRead', err);
      resolve(fallback);
    }
  });
}

/**
 * Run a readwrite transaction under the shared Dropbox degradation policy.
 * Likes/tombstones are not quota-evictable; exhausted writes soft-fail to `fallback`.
 *
 * `fn` must settle via `resolve` (typically from `tx.oncomplete`).
 */
async function withIdbWrite<T>(
  storeName: string,
  label: string,
  fallback: T,
  fn: (store: IDBObjectStore, resolve: (value: T) => void) => void,
): Promise<T> {
  let value = fallback;

  const ok = await runDropboxWrite(
    `dropboxLikesCache.${label}`,
    // Likes/tombstones are marked non-evictable; eviction no-ops for these names.
    [storeName],
    async (database) => {
      value = await new Promise<T>((resolve, reject) => {
        try {
          const tx = database.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          fn(store, resolve);
          tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
        } catch (err) {
          reject(err);
        }
      });
    },
  );

  return ok ? value : fallback;
}

function withStoreRead<T>(
  fallback: T,
  fn: (store: IDBObjectStore, resolve: (value: T) => void) => void,
): Promise<T> {
  return withIdbRead(STORE, fallback, fn);
}

function withTombstoneRead<T>(
  fallback: T,
  fn: (store: IDBObjectStore, resolve: (value: T) => void) => void,
): Promise<T> {
  return withIdbRead(TOMBSTONE_STORE, fallback, fn);
}

export async function getLikedTracks(): Promise<MediaTrack[]> {
  return withStoreRead<MediaTrack[]>([], (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const entries = (req.result as LikedEntry[]) ?? [];
      entries.sort((a, b) => b.likedAt - a.likedAt);
      resolve(entries.map((e) => ({ ...e.track, addedAt: e.likedAt })));
    };
    req.onerror = () => resolve([]);
  });
}

export async function getLikedCount(): Promise<number> {
  return withStoreRead(0, (store, resolve) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });
}

export async function isTrackLiked(trackId: string): Promise<boolean> {
  return withStoreRead(false, (store, resolve) => {
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
  await withIdbWrite(STORE, 'setTrackLiked', undefined, (store, resolve) => {
    const tx = store.transaction;
    if (liked && track) {
      const entry: LikedEntry = { trackId, track, likedAt: Date.now() };
      store.put(entry);
    } else {
      store.delete(trackId);
    }
    tx.oncomplete = () => {
      notifyLikesChanged();
      resolve(undefined);
    };
  });
  if (!liked) {
    await addTombstone(trackId);
  }
}

export async function clearLikes(): Promise<void> {
  return withIdbWrite(STORE, 'clearLikes', undefined, (store, resolve) => {
    const tx = store.transaction;
    store.clear();
    tx.oncomplete = () => {
      notifyLikesChanged();
      resolve(undefined);
    };
  });
}

export async function exportLikes(): Promise<string> {
  return withStoreRead('[]', (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(JSON.stringify(req.result ?? []));
    req.onerror = () => resolve('[]');
  });
}

export async function importLikes(json: string): Promise<number> {
  let entries: LikedEntry[];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return 0;
    entries = parsed.filter(isLikedEntry);
  } catch (err) {
    logCaughtError('dropboxLikesCache.importLikes', err);
    return 0;
  }

  return withIdbWrite(STORE, 'importLikes', 0, (store, resolve) => {
    const tx = store.transaction;
    let count = 0;
    for (const entry of entries) {
      if (entry.trackId && entry.track) {
        store.put(entry);
        count++;
      }
    }
    tx.oncomplete = () => {
      notifyLikesChanged();
      resolve(count);
    };
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

  return withIdbWrite(STORE, 'refreshLikedTrackMetadata', { updated: 0, removed: 0 }, (store, resolve) => {
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

    tx.oncomplete = () => {
      if (updated > 0 || removed > 0) notifyLikesChanged();
      resolve({ updated, removed });
    };
  });
}

// ── Bulk operations for sync ────────────────────────────────────────

export async function getLikedEntries(): Promise<LikedEntry[]> {
  return withStoreRead<LikedEntry[]>([], (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as LikedEntry[]) ?? []);
    req.onerror = () => resolve([]);
  });
}

export async function replaceLikes(entries: LikedEntry[]): Promise<void> {
  return withIdbWrite(STORE, 'replaceLikes', undefined, (store, resolve) => {
    const tx = store.transaction;
    store.clear();
    for (const entry of entries) {
      if (entry.trackId && entry.track) {
        store.put(entry);
      }
    }
    tx.oncomplete = () => {
      notifyLikesChanged();
      resolve(undefined);
    };
  });
}

// ── Tombstones (track unlike deletions for sync) ────────────────────

export interface Tombstone {
  trackId: string;
  deletedAt: number;
}

export async function addTombstone(trackId: string): Promise<void> {
  return withIdbWrite(TOMBSTONE_STORE, 'addTombstone', undefined, (store, resolve) => {
    const tx = store.transaction;
    store.put({ trackId, deletedAt: Date.now() });
    tx.oncomplete = () => resolve(undefined);
  });
}

export async function getTombstones(): Promise<Tombstone[]> {
  return withTombstoneRead<Tombstone[]>([], (store, resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as Tombstone[]) ?? []);
    req.onerror = () => resolve([]);
  });
}

export async function clearTombstones(): Promise<void> {
  return withIdbWrite(TOMBSTONE_STORE, 'clearTombstones', undefined, (store, resolve) => {
    const tx = store.transaction;
    store.clear();
    tx.oncomplete = () => resolve(undefined);
  });
}

export async function setTombstones(entries: Tombstone[]): Promise<void> {
  return withIdbWrite(TOMBSTONE_STORE, 'setTombstones', undefined, (store, resolve) => {
    const tx = store.transaction;
    store.clear();
    for (const entry of entries) {
      store.put(entry);
    }
    tx.oncomplete = () => resolve(undefined);
  });
}
