/**
 * Persistent cache for Dropbox album art images.
 * Stores image data URLs in IndexedDB so art loads instantly across sessions
 * without hitting the Dropbox API.
 */

const DB_NAME = 'vorbis-dropbox-art';
const DB_VERSION = 5;
const STORE = 'art';
const ART_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedArt {
  path: string;
  dataUrl: string;
  cachedAt: number;
}

let db: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'path' });
      }
      if (!database.objectStoreNames.contains('catalog')) {
        database.createObjectStore('catalog', { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains('likes')) {
        database.createObjectStore('likes', { keyPath: 'trackId' });
      }
      if (!database.objectStoreNames.contains('durations')) {
        database.createObjectStore('durations', { keyPath: 'trackId' });
      }
      if (!database.objectStoreNames.contains('tags')) {
        database.createObjectStore('tags', { keyPath: 'trackId' });
      }
    };
  });
  return dbPromise;
}

export async function getDb(): Promise<IDBDatabase | null> {
  return db ?? openDb();
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
    } catch {
      resolve(null);
    }
  });
}

export async function putArt(path: string, dataUrl: string): Promise<void> {
  const database = await getDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const entry: CachedArt = { path, dataUrl, cachedAt: Date.now() };
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearArt(): Promise<void> {
  const database = await getDb();
  if (!database) return;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function putDurationMs(trackId: string, durationMs: number): Promise<void> {
  const database = await getDb();
  if (!database) return;
  try {
    const tx = database.transaction('durations', 'readwrite');
    tx.objectStore('durations').put({ trackId, durationMs });
  } catch {
    // fire-and-forget
  }
}

export interface CachedTagMetadata {
  trackId: string;
  name?: string;
  artists?: string;
  album?: string;
}

export async function putTagMetadata(trackId: string, tags: Omit<CachedTagMetadata, 'trackId'>): Promise<void> {
  const database = await getDb();
  if (!database) return;
  try {
    const tx = database.transaction('tags', 'readwrite');
    tx.objectStore('tags').put({ trackId, ...tags });
  } catch {
    // fire-and-forget
  }
}

export async function getTagsMap(trackIds: string[]): Promise<Map<string, CachedTagMetadata>> {
  const result = new Map<string, CachedTagMetadata>();
  if (trackIds.length === 0) return result;
  const database = await getDb();
  if (!database) return result;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction('tags', 'readonly');
      const store = tx.objectStore('tags');
      let pending = trackIds.length;
      for (const id of trackIds) {
        const req = store.get(id);
        req.onsuccess = () => {
          const entry = req.result as CachedTagMetadata | undefined;
          if (entry) result.set(id, entry);
          if (--pending === 0) resolve(result);
        };
        req.onerror = () => {
          if (--pending === 0) resolve(result);
        };
      }
    } catch {
      resolve(result);
    }
  });
}

export async function getDurationsMap(trackIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (trackIds.length === 0) return result;
  const database = await getDb();
  if (!database) return result;
  return new Promise((resolve) => {
    try {
      const tx = database.transaction('durations', 'readonly');
      const store = tx.objectStore('durations');
      let pending = trackIds.length;
      for (const id of trackIds) {
        const req = store.get(id);
        req.onsuccess = () => {
          const entry = req.result as { trackId: string; durationMs: number } | undefined;
          if (entry && entry.durationMs > 0) result.set(id, entry.durationMs);
          if (--pending === 0) resolve(result);
        };
        req.onerror = () => {
          if (--pending === 0) resolve(result);
        };
      }
    } catch {
      resolve(result);
    }
  });
}
