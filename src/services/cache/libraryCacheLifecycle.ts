/**
 * Database lifecycle for the library cache.
 *
 * Owns the singleton IndexedDB connection and the in-memory fallback flag.
 * Exposes the open/upgrade promise.
 */

const DB_NAME = 'vorbis-player-library';

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

/**
 * In-memory fallback stores keyed by store name (matches the IDB store names).
 * Values are typed as `unknown` because the consumer-facing `getFallbackMap`
 * API has to serve any store, and IDB itself persists structured-cloneable
 * data without per-store typing.
 */
type FallbackStores = Record<string, Map<string, unknown>>;

export const fallbackStores: FallbackStores = {
  [STORE_PLAYLISTS]: new Map(),
  [STORE_ALBUMS]: new Map(),
  [STORE_TRACK_LISTS]: new Map(),
  [STORE_META]: new Map(),
};

let db: IDBDatabase | null = null;
let fallbackMode = false;
let initPromise: Promise<void> | null = null;

export function getDb(): IDBDatabase | null {
  return db;
}

export function isFallback(): boolean {
  return fallbackMode;
}

export function enterFallback(): void {
  fallbackMode = true;
}

export function getFallbackMap(storeName: string): Map<string, unknown> {
  const store = fallbackStores[storeName];
  if (!store) throw new Error(`[libraryCache] Unknown store: ${storeName}`);
  return store;
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      // Drop any pre-v2 stores: the record shapes and key scheme changed
      // incompatibly, and the cache repopulates itself from the providers.
      for (const storeName of Array.from(database.objectStoreNames)) {
        database.deleteObjectStore(storeName);
      }
      for (const storeName of ALL_STORES) {
        database.createObjectStore(storeName);
      }
    };
  });
}

/**
 * Initialize the cache. Opens IndexedDB or activates the in-memory fallback.
 * Safe to call multiple times — subsequent calls return the same promise.
 */
export async function initCache(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB not available');
      }
      db = await openIDB();
    } catch (err) {
      console.warn('[libraryCache] IndexedDB unavailable, using in-memory fallback:', err);
      fallbackMode = true;
      db = null;
    }
  })();

  return initPromise;
}

/** Close the database connection (primarily for testing). */
export function closeCache(): void {
  if (db) {
    db.close();
    db = null;
  }
  fallbackMode = false;
  initPromise = null;
  for (const store of Object.values(fallbackStores)) {
    store.clear();
  }
}
