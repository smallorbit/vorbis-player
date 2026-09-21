/**
 * Database lifecycle for the library cache.
 *
 * Thin adapter over the shared IndexedDB foundation (`src/services/idb`).
 */

import { createIdbDatabase, type IdbDatabaseHandle, type KVStore } from '@/services/idb';
import { STORAGE_KEYS } from '@/constants/storage';

const DB_NAME = STORAGE_KEYS.LIBRARY;

// v2: stores hold neutral domain shapes (MediaCollection / MediaTrack) with
// out-of-line keys of the form "{provider}:{id}" (collections) or a
// collection-ref key (track lists). The v1 stores held Spotify wire shapes
// keyed by bare id; on upgrade they are dropped and repopulated by the next
// sync — this is a cache, not a source of truth.
const DB_VERSION = 2;

export const STORE_PLAYLISTS = 'playlists';
export const STORE_ALBUMS = 'albums';
export const STORE_TRACK_LISTS = 'trackLists';
export const STORE_META = 'meta';

const ALL_STORES = [STORE_PLAYLISTS, STORE_ALBUMS, STORE_TRACK_LISTS, STORE_META] as const;

const handle: IdbDatabaseHandle = createIdbDatabase({
  name: DB_NAME,
  version: DB_VERSION,
  logLabel: 'libraryCache',
  customUpgradeOnly: true,
  stores: ALL_STORES.map((name) => ({ name, keyMode: { kind: 'outOfLine' as const } })),
  onUpgrade(database) {
    // Drop any pre-v2 stores: the record shapes and key scheme changed
    // incompatibly, and the cache repopulates itself from the providers.
    for (const storeName of Array.from(database.objectStoreNames)) {
      database.deleteObjectStore(storeName);
    }
    for (const storeName of ALL_STORES) {
      database.createObjectStore(storeName);
    }
  },
});

export function getDb(): IDBDatabase | null {
  return handle.getDb();
}

export function isFallback(): boolean {
  return handle.isFallback();
}

/**
 * Live view of the in-memory fallback maps (same Map instances the handle owns).
 * Proxy so `_testing.fallbackStores[name]` and `Object.values` keep working.
 */
export const fallbackStores: Record<string, Map<string, unknown>> = new Proxy(
  {} as Record<string, Map<string, unknown>>,
  {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      return handle.getFallbackMap(prop);
    },
    ownKeys() {
      return [...ALL_STORES];
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'string' && (ALL_STORES as readonly string[]).includes(prop)) {
        return { configurable: true, enumerable: true, value: handle.getFallbackMap(prop) };
      }
      return undefined;
    },
  },
);

/**
 * Initialize the cache. Opens IndexedDB or activates the in-memory fallback.
 * Safe to call multiple times — subsequent calls return the same promise.
 */
export async function initCache(): Promise<void> {
  return handle.init();
}

/** Close the database connection (primarily for testing). */
export function closeCache(): void {
  handle.close();
}

export function getLibraryStore<T>(storeName: string): KVStore<T> {
  return handle.getStore<T>(storeName);
}
