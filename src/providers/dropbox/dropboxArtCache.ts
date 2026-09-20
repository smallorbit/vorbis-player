/**
 * Persistent cache for Dropbox album art images (and sibling stores on the same DB).
 * Stores image data URLs in IndexedDB so art loads instantly across sessions
 * without hitting the Dropbox API.
 *
 * Lifecycle + degradation policy come from the shared IndexedDB foundation
 * (`src/services/idb`) — see #1702 / F35.
 */

import { logCaughtError } from '@/utils/logCaughtError';
import { getDb, runDropboxWrite } from './dropboxIdb';

const STORE = 'art';
const ART_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ALBUM_ART_KEY_PREFIX = 'album:';

interface CachedArt {
  path: string;
  dataUrl: string;
  cachedAt: number;
}

function idbPut(database: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbClear(database: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getArt(path: string): Promise<string | null> {
  const database = await getDb();
  if (!database) return null;
  return new Promise((resolve) => {
    try {
      const req = database.transaction(STORE, 'readonly').objectStore(STORE).get(path);
      req.onsuccess = () => {
        const entry = req.result as CachedArt | undefined;
        resolve(entry && Date.now() - entry.cachedAt < ART_TTL_MS ? entry.dataUrl : null);
      };
      req.onerror = () => resolve(null);
    } catch (err) {
      logCaughtError('dropboxArtCache.getArt', err);
      resolve(null);
    }
  });
}

export async function putArt(path: string, dataUrl: string): Promise<void> {
  const entry: CachedArt = { path, dataUrl, cachedAt: Date.now() };
  await runDropboxWrite(`dropboxArtCache.putArt`, [STORE], (database) =>
    idbPut(database, STORE, entry),
  );
}

function albumArtCacheKey(albumPath: string): string {
  return `${ALBUM_ART_KEY_PREFIX}${albumPath}`;
}

export async function getAlbumArt(albumPath: string): Promise<string | null> {
  if (!albumPath) return null;
  return getArt(albumArtCacheKey(albumPath));
}

export async function putAlbumArt(albumPath: string, dataUrl: string): Promise<void> {
  if (!albumPath || !dataUrl) return;
  await putArt(albumArtCacheKey(albumPath), dataUrl);
}

export async function clearArt(): Promise<void> {
  await runDropboxWrite(`dropboxArtCache.clearArt`, [STORE], (database) =>
    idbClear(database, STORE),
  );
}

export async function putDurationMs(trackId: string, durationMs: number): Promise<void> {
  await runDropboxWrite(`dropboxArtCache.putDurationMs`, ['durations'], (database) =>
    idbPut(database, 'durations', { trackId, durationMs }),
  );
}

interface CachedTagMetadata {
  trackId: string;
  name?: string;
  artists?: string;
  album?: string;
}

export async function putTagMetadata(trackId: string, tags: Omit<CachedTagMetadata, 'trackId'>): Promise<void> {
  await runDropboxWrite(`dropboxArtCache.putTagMetadata`, ['tags'], (database) =>
    idbPut(database, 'tags', { trackId, ...tags }),
  );
}

function batchGetFromStore<T>(database: IDBDatabase, storeName: string, ids: string[]): Promise<Map<string, T>> {
  if (ids.length === 0) return Promise.resolve(new Map<string, T>());
  return new Promise((resolve) => {
    const result = new Map<string, T>();
    try {
      const store = database.transaction(storeName, 'readonly').objectStore(storeName);
      let pending = ids.length;
      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) result.set(id, req.result as T);
          if (--pending === 0) resolve(result);
        };
        req.onerror = () => {
          if (--pending === 0) resolve(result);
        };
      }
    } catch (err) {
      logCaughtError('dropboxArtCache.batchGetFromStore', err);
      resolve(result);
    }
  });
}

export async function getTagsMap(trackIds: string[]): Promise<Map<string, CachedTagMetadata>> {
  if (trackIds.length === 0) return new Map();
  const database = await getDb();
  if (!database) return new Map();
  return batchGetFromStore<CachedTagMetadata>(database, 'tags', trackIds);
}

export async function getDurationsMap(trackIds: string[]): Promise<Map<string, number>> {
  if (trackIds.length === 0) return new Map();
  const database = await getDb();
  if (!database) return new Map();
  const raw = await batchGetFromStore<{ trackId: string; durationMs: number }>(database, 'durations', trackIds);
  const result = new Map<string, number>();
  for (const [id, entry] of raw) {
    if (entry.durationMs > 0) result.set(id, entry.durationMs);
  }
  return result;
}

// ── Track date (release year) cache ──────────────────────────

interface CachedTrackDate {
  albumId: string;
  releaseYear: number;
}

export async function putTrackDate(albumId: string, releaseYear: number): Promise<void> {
  await runDropboxWrite(`dropboxArtCache.putTrackDate`, ['trackDates'], (database) =>
    idbPut(database, 'trackDates', { albumId, releaseYear }),
  );
}

export async function getTrackDatesMap(albumIds: string[]): Promise<Map<string, number>> {
  if (albumIds.length === 0) return new Map();
  const database = await getDb();
  if (!database) return new Map();
  const raw = await batchGetFromStore<CachedTrackDate>(database, 'trackDates', albumIds);
  const result = new Map<string, number>();
  for (const [id, entry] of raw) {
    if (entry.releaseYear > 0) result.set(id, entry.releaseYear);
  }
  return result;
}
