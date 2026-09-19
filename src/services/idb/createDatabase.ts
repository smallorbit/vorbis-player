/**
 * Factory for a shared IndexedDB handle: lifecycle, fallback, degradation hooks,
 * and typed KVStore accessors.
 */

import { logCaughtError } from '@/utils/logCaughtError';
import { createKvStore } from './kvStore';
import { deleteIdbDatabase, openIdbDatabase } from './openDatabase';
import type { CreateIdbDatabaseOptions, KVStore, StoreSpec } from './types';

export interface IdbDatabaseHandle {
  readonly name: string;
  readonly logLabel: string;
  init(): Promise<void>;
  close(): void;
  isFallback(): boolean;
  enterFallback(): void;
  getDb(): IDBDatabase | null;
  getStore<T>(storeName: string): KVStore<T>;
  getFallbackMap(storeName: string): Map<string, unknown>;
  /** Per-key session overlay after a write soft-fail (`undefined` = tombstone). */
  getOverlayMap(storeName: string): Map<string, unknown>;
  evictForQuota(): Promise<void>;
  recoverFromCorruption(): Promise<void>;
  /** Testing / logout purge. */
  deleteDatabase(): Promise<void>;
}

function buildFallbackStores(stores: readonly StoreSpec[]): Record<string, Map<string, unknown>> {
  const out: Record<string, Map<string, unknown>> = {};
  for (const spec of stores) {
    out[spec.name] = new Map();
  }
  return out;
}

function buildOverlayStores(stores: readonly StoreSpec[]): Record<string, Map<string, unknown>> {
  return buildFallbackStores(stores);
}

export function createIdbDatabase(options: CreateIdbDatabaseOptions): IdbDatabaseHandle {
  const storeByName = new Map(options.stores.map((s) => [s.name, s]));
  const fallbackStores = buildFallbackStores(options.stores);
  const overlayStores = buildOverlayStores(options.stores);

  let db: IDBDatabase | null = null;
  let fallbackMode = false;
  let initPromise: Promise<void> | null = null;

  const ensureStore = (storeName: string): StoreSpec => {
    const spec = storeByName.get(storeName);
    if (!spec) {
      throw new Error(`[${options.logLabel}] Unknown store: ${storeName}`);
    }
    return spec;
  };

  const clearMaps = (maps: Record<string, Map<string, unknown>>): void => {
    for (const map of Object.values(maps)) map.clear();
  };

  const handle: IdbDatabaseHandle = {
    name: options.name,
    logLabel: options.logLabel,

    async init(): Promise<void> {
      if (initPromise) return initPromise;

      initPromise = (async () => {
        try {
          if (typeof indexedDB === 'undefined') {
            throw new Error('IndexedDB not available');
          }
          db = await openIdbDatabase(options);
          fallbackMode = false;
        } catch (err) {
          console.warn(`[${options.logLabel}] IndexedDB unavailable, using in-memory fallback:`, err);
          fallbackMode = true;
          db = null;
        }
      })();

      return initPromise;
    },

    close(): void {
      if (db) {
        db.close();
        db = null;
      }
      fallbackMode = false;
      initPromise = null;
      clearMaps(fallbackStores);
      clearMaps(overlayStores);
    },

    isFallback(): boolean {
      return fallbackMode;
    },

    enterFallback(): void {
      fallbackMode = true;
    },

    getDb(): IDBDatabase | null {
      return db;
    },

    getStore<T>(storeName: string): KVStore<T> {
      const spec = ensureStore(storeName);
      return createKvStore<T>(handle, storeName, spec.keyMode);
    },

    getFallbackMap(storeName: string): Map<string, unknown> {
      ensureStore(storeName);
      const store = fallbackStores[storeName];
      if (!store) throw new Error(`[${options.logLabel}] Unknown store: ${storeName}`);
      return store;
    },

    getOverlayMap(storeName: string): Map<string, unknown> {
      ensureStore(storeName);
      const store = overlayStores[storeName];
      if (!store) throw new Error(`[${options.logLabel}] Unknown store: ${storeName}`);
      return store;
    },

    async evictForQuota(): Promise<void> {
      const database = db;
      if (!database) return;
      try {
        const names = Array.from(database.objectStoreNames);
        if (names.length === 0) return;
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(names, 'readwrite');
          for (const name of names) tx.objectStore(name).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        clearMaps(overlayStores);
      } catch (err) {
        logCaughtError(`${options.logLabel}.evictForQuota`, err);
      }
    },

    async recoverFromCorruption(): Promise<void> {
      if (db) {
        try {
          db.close();
        } catch (err) {
          logCaughtError(`${options.logLabel}.recover.close`, err);
        }
        db = null;
      }
      initPromise = null;
      clearMaps(overlayStores);
      try {
        await deleteIdbDatabase(options.name);
      } catch (err) {
        logCaughtError(`${options.logLabel}.recover.delete`, err);
      }
      // Re-open synchronously within this recovery so the caller's retry can proceed.
      initPromise = (async () => {
        try {
          db = await openIdbDatabase(options);
          fallbackMode = false;
        } catch (err) {
          console.warn(`[${options.logLabel}] IndexedDB reopen after corruption failed:`, err);
          fallbackMode = true;
          db = null;
        }
      })();
      await initPromise;
    },

    async deleteDatabase(): Promise<void> {
      handle.close();
      await deleteIdbDatabase(options.name);
    },
  };

  return handle;
}
