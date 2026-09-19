/**
 * Storage abstraction for the library cache.
 *
 * `getStore<T>(storeName)` returns a typed key-value interface backed by the
 * shared IndexedDB foundation (IDB with degradation policy, or in-memory
 * fallback when the DB cannot open).
 */

import {
  STORE_ALBUMS,
  STORE_META,
  STORE_PLAYLISTS,
  STORE_TRACK_LISTS,
  getLibraryStore,
  fallbackStores,
} from './libraryCacheLifecycle';
import type { KVStore } from '@/services/idb';

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
  return getLibraryStore<T>(storeName);
}

/** Re-export fallback container for the _testing handle. */
export { fallbackStores };

export type { KVStore };
