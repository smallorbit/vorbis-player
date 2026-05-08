/**
 * Storage abstraction for the library cache.
 *
 * `getStore<T>(storeName)` returns a typed key-value interface that internally
 * dispatches to IndexedDB (when open) or to the in-memory fallback Map.
 * Consumers don't see the branching.
 */

import { logCaughtError } from '@/utils/logCaughtError';
import {
  fallbackStores,
  getDb,
  getFallbackMap,
  initCache,
  isFallback,
  STORE_ALBUMS,
  STORE_META,
  STORE_PLAYLISTS,
  STORE_TRACK_LISTS,
} from './libraryCacheLifecycle';

export interface KVStore<T> {
  get(key: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  put(key: string, value: T): Promise<void>;
  putAll(entries: Array<[string, T]>): Promise<void>;
  remove(key: string): Promise<void>;
  replaceAll(entries: Array<[string, T]>): Promise<void>;
  clear(): Promise<void>;
}

type IDBMode = 'readonly' | 'readwrite';

function withStore<R>(
  storeName: string,
  mode: IDBMode,
  run: (store: IDBObjectStore, tx: IDBTransaction) => IDBRequest<R> | null,
): Promise<R> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) {
      reject(new Error('DB not initialized'));
      return;
    }
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = run(store, tx);
    if (request) {
      request.onsuccess = () => resolve(request.result as R);
      request.onerror = () => reject(request.error);
      return;
    }
    tx.oncomplete = () => resolve(undefined as R);
    tx.onerror = () => reject(tx.error);
  });
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return withStore<T | undefined>(storeName, 'readonly', (store) => store.get(key));
}

function idbGetAll<T>(storeName: string): Promise<T[]> {
  return withStore<T[]>(storeName, 'readonly', (store) => store.getAll());
}

function idbPut<T>(storeName: string, value: T): Promise<void> {
  return withStore<void>(storeName, 'readwrite', (store) => {
    store.put(value);
    return null;
  });
}

function idbDelete(storeName: string, key: string): Promise<void> {
  return withStore<void>(storeName, 'readwrite', (store) => {
    store.delete(key);
    return null;
  });
}

function idbClear(storeName: string): Promise<void> {
  return withStore<void>(storeName, 'readwrite', (store) => {
    store.clear();
    return null;
  });
}

function idbPutAll<T>(storeName: string, items: T[]): Promise<void> {
  return withStore<void>(storeName, 'readwrite', (store) => {
    for (const item of items) store.put(item);
    return null;
  });
}

function idbReplaceAll<T>(storeName: string, items: T[]): Promise<void> {
  return withStore<void>(storeName, 'readwrite', (store) => {
    store.clear();
    for (const item of items) store.put(item);
    return null;
  });
}

const KNOWN_STORES = new Set<string>([
  STORE_PLAYLISTS,
  STORE_ALBUMS,
  STORE_TRACK_LISTS,
  STORE_META,
]);

export function getStore<T>(storeName: string): KVStore<T> {
  if (!KNOWN_STORES.has(storeName)) {
    throw new Error(`[libraryCache] Unknown store: ${storeName}`);
  }

  const fallback = (): Map<string, T> => getFallbackMap(storeName) as Map<string, T>;

  return {
    async get(key: string): Promise<T | undefined> {
      await initCache();
      if (isFallback()) return fallback().get(key);
      try {
        return await idbGet<T>(storeName, key);
      } catch (err) {
        logCaughtError(`libraryCacheStorage.${storeName}.get`, err);
        return fallback().get(key);
      }
    },

    async getAll(): Promise<T[]> {
      await initCache();
      if (isFallback()) return Array.from(fallback().values());
      try {
        return await idbGetAll<T>(storeName);
      } catch (err) {
        logCaughtError(`libraryCacheStorage.${storeName}.getAll`, err);
        return Array.from(fallback().values());
      }
    },

    async put(key: string, value: T): Promise<void> {
      await initCache();
      if (isFallback()) {
        fallback().set(key, value);
        return;
      }
      try {
        await idbPut(storeName, value);
      } catch (err) {
        logCaughtError(`libraryCacheStorage.${storeName}.put`, err);
        fallback().set(key, value);
      }
    },

    async putAll(entries: Array<[string, T]>): Promise<void> {
      await initCache();
      const items = entries.map(([, value]) => value);
      if (isFallback()) {
        const map = fallback();
        for (const [key, value] of entries) map.set(key, value);
        return;
      }
      try {
        await idbPutAll(storeName, items);
      } catch (err) {
        logCaughtError(`libraryCacheStorage.${storeName}.putAll`, err);
        const map = fallback();
        for (const [key, value] of entries) map.set(key, value);
      }
    },

    async remove(key: string): Promise<void> {
      await initCache();
      if (isFallback()) {
        fallback().delete(key);
        return;
      }
      try {
        await idbDelete(storeName, key);
      } catch (err) {
        logCaughtError(`libraryCacheStorage.${storeName}.remove`, err);
        fallback().delete(key);
      }
    },

    async replaceAll(entries: Array<[string, T]>): Promise<void> {
      await initCache();
      const items = entries.map(([, value]) => value);
      if (isFallback()) {
        const map = fallback();
        map.clear();
        for (const [key, value] of entries) map.set(key, value);
        return;
      }
      try {
        await idbReplaceAll(storeName, items);
      } catch (err) {
        logCaughtError(`libraryCacheStorage.${storeName}.replaceAll`, err);
        const map = fallback();
        map.clear();
        for (const [key, value] of entries) map.set(key, value);
      }
    },

    async clear(): Promise<void> {
      await initCache();
      if (isFallback()) {
        fallback().clear();
        return;
      }
      try {
        await idbClear(storeName);
      } catch (err) {
        logCaughtError(`libraryCacheStorage.${storeName}.clear`, err);
        fallback().clear();
      }
    },
  };
}

/** Re-export fallback container for the _testing handle. */
export { fallbackStores };
