/**
 * KVStore implementation backed by an IdbDatabaseHandle.
 *
 * Write failures go through the shared degradation policy and, if still
 * failing, land in a per-key session overlay — never flipping the whole DB
 * into memory-only mode (that would hide still-readable IDB data).
 */

import { logCaughtError } from '@/utils/logCaughtError';
import { runWithDegradationPolicy } from './degradation';
import type { IDBMode, IdbDatabaseHandle, KVStore, StoreKeyMode } from './types';

function withStoreRequest<R>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBMode,
  run: (store: IDBObjectStore) => IDBRequest<R> | null,
): Promise<R> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = run(store);
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      return;
    }
    tx.oncomplete = () => resolve(undefined as R);
    tx.onerror = () => reject(tx.error);
  });
}

function putValue(store: IDBObjectStore, keyMode: StoreKeyMode, key: string, value: unknown): void {
  if (keyMode.kind === 'outOfLine') {
    store.put(value, key);
    return;
  }
  // keyPath stores: the key lives on the record.
  store.put(value);
}

export function createKvStore<T>(
  handle: IdbDatabaseHandle,
  storeName: string,
  keyMode: StoreKeyMode,
): KVStore<T> {
  const overlay = (): Map<string, T | undefined> => handle.getOverlayMap(storeName) as Map<string, T | undefined>;

  const readFromIdb = async (key: string): Promise<T | undefined> => {
    const db = handle.getDb();
    if (!db) return undefined;
    return withStoreRequest<T | undefined>(db, storeName, 'readonly', (store) => store.get(key));
  };

  const readAllFromIdb = async (): Promise<Array<{ key: string; value: T }>> => {
    const db = handle.getDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      const rows: Array<{ key: string; value: T }> = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(rows);
          return;
        }
        rows.push({ key: String(cursor.key), value: cursor.value as T });
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  };

  const writeToIdb = async (entries: Array<[string, T]>): Promise<void> => {
    const db = handle.getDb();
    if (!db) throw new Error('DB not initialized');
    await withStoreRequest<void>(db, storeName, 'readwrite', (store) => {
      for (const [key, value] of entries) putValue(store, keyMode, key, value);
      return null;
    });
  };

  const deleteFromIdb = async (key: string): Promise<void> => {
    const db = handle.getDb();
    if (!db) throw new Error('DB not initialized');
    await withStoreRequest<void>(db, storeName, 'readwrite', (store) => {
      store.delete(key);
      return null;
    });
  };

  const clearIdb = async (): Promise<void> => {
    const db = handle.getDb();
    if (!db) throw new Error('DB not initialized');
    await withStoreRequest<void>(db, storeName, 'readwrite', (store) => {
      store.clear();
      return null;
    });
  };

  const degradation = {
    get label() {
      return `${handle.logLabel}.${storeName}`;
    },
    evictForQuota: () => handle.evictForQuota([storeName]),
    recoverFromCorruption: () => handle.recoverFromCorruption(),
    reopenConnection: () => handle.reopenConnection(),
  };

  return {
    async get(key: string): Promise<T | undefined> {
      await handle.init();
      const map = overlay();
      if (map.has(key)) return map.get(key);

      if (handle.isFallback()) {
        return handle.getFallbackMap(storeName).get(key) as T | undefined;
      }

      try {
        return await readFromIdb(key);
      } catch (err) {
        logCaughtError(`${handle.logLabel}.${storeName}.get`, err);
        return handle.getFallbackMap(storeName).get(key) as T | undefined;
      }
    },

    async getAll(): Promise<T[]> {
      await handle.init();
      const map = overlay();

      if (handle.isFallback()) {
        const base = handle.getFallbackMap(storeName) as Map<string, T>;
        const merged = new Map(base);
        for (const [key, value] of map) {
          if (value === undefined) merged.delete(key);
          else merged.set(key, value);
        }
        return Array.from(merged.values());
      }

      try {
        const rows = await readAllFromIdb();
        const merged = new Map<string, T>();
        for (const row of rows) merged.set(row.key, row.value);
        for (const [key, value] of map) {
          if (value === undefined) merged.delete(key);
          else merged.set(key, value);
        }
        return Array.from(merged.values());
      } catch (err) {
        logCaughtError(`${handle.logLabel}.${storeName}.getAll`, err);
        const merged = new Map(handle.getFallbackMap(storeName) as Map<string, T>);
        for (const [key, value] of map) {
          if (value === undefined) merged.delete(key);
          else merged.set(key, value);
        }
        return Array.from(merged.values());
      }
    },

    async put(key: string, value: T): Promise<void> {
      await handle.init();

      if (handle.isFallback()) {
        handle.getFallbackMap(storeName).set(key, value);
        overlay().delete(key);
        return;
      }

      const result = await runWithDegradationPolicy(degradation, () => writeToIdb([[key, value]]));
      if (result.ok) {
        overlay().delete(key);
        return;
      }
      // Soft-fail into a per-key overlay so the write is visible this session
      // without hiding the rest of the still-readable IDB contents.
      overlay().set(key, value);
    },

    async putAll(entries: Array<[string, T]>): Promise<void> {
      await handle.init();

      if (handle.isFallback()) {
        const fb = handle.getFallbackMap(storeName);
        for (const [key, value] of entries) fb.set(key, value);
        const map = overlay();
        for (const [key] of entries) map.delete(key);
        return;
      }

      const result = await runWithDegradationPolicy(degradation, () => writeToIdb(entries));
      if (result.ok) {
        const map = overlay();
        for (const [key] of entries) map.delete(key);
        return;
      }
      const map = overlay();
      for (const [key, value] of entries) map.set(key, value);
    },

    async remove(key: string): Promise<void> {
      await handle.init();

      if (handle.isFallback()) {
        handle.getFallbackMap(storeName).delete(key);
        overlay().delete(key);
        return;
      }

      const result = await runWithDegradationPolicy(degradation, () => deleteFromIdb(key));
      if (result.ok) {
        overlay().delete(key);
        return;
      }
      // Tombstone in overlay so get/getAll hide the IDB row for this session.
      overlay().set(key, undefined);
    },

    async clear(): Promise<void> {
      await handle.init();

      if (handle.isFallback()) {
        handle.getFallbackMap(storeName).clear();
        overlay().clear();
        return;
      }

      const result = await runWithDegradationPolicy(degradation, () => clearIdb());
      overlay().clear();
      if (!result.ok) {
        // Best-effort: mark every known IDB key deleted in the overlay.
        try {
          const rows = await readAllFromIdb();
          const map = overlay();
          for (const row of rows) map.set(row.key, undefined);
        } catch (err) {
          logCaughtError(`${handle.logLabel}.${storeName}.clear.overlay`, err);
        }
      }
    },
  };
}
