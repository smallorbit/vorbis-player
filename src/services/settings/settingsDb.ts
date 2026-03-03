/**
 * IndexedDB-based persistent store for application settings (pins, preferences, etc.).
 *
 * Follows the same singleton + initPromise + in-memory fallback pattern as libraryCache.ts.
 */

export const STORE_NAMES = { PINS: 'pins' } as const;

const DB_NAME = 'vorbis-player-settings';
const DB_VERSION = 1;

// In-memory fallback keyed by store name, then record key.
const fallbackStores: Record<string, Map<string, unknown>> = {
  [STORE_NAMES.PINS]: new Map(),
};

let db: IDBDatabase | null = null;
let fallbackMode = false;
let initPromise: Promise<void> | null = null;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAMES.PINS)) {
        database.createObjectStore(STORE_NAMES.PINS, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Initialize the settings database.
 * Safe to call multiple times -- subsequent calls return the same promise.
 */
export async function initSettingsDb(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB not available');
      }
      db = await openIDB();
    } catch (err) {
      console.warn('[settingsDb] IndexedDB unavailable, using in-memory fallback:', err);
      fallbackMode = true;
      db = null;
    }
  })();

  return initPromise;
}

export async function settingsGet<T>(store: string, key: string): Promise<T | undefined> {
  await initSettingsDb();
  if (fallbackMode) {
    return fallbackStores[store]?.get(key) as T | undefined;
  }
  try {
    return await idbGet<T>(store, key);
  } catch {
    return fallbackStores[store]?.get(key) as T | undefined;
  }
}

export async function settingsPut<T extends { key: string }>(store: string, value: T): Promise<void> {
  await initSettingsDb();
  if (fallbackMode) {
    ensureFallbackStore(store);
    fallbackStores[store].set(value.key, value);
    return;
  }
  try {
    await idbPut(store, value);
  } catch {
    ensureFallbackStore(store);
    fallbackStores[store].set(value.key, value);
  }
}

export async function settingsClearStore(store: string): Promise<void> {
  await initSettingsDb();
  if (fallbackMode) {
    fallbackStores[store]?.clear();
    return;
  }
  try {
    await idbClear(store);
  } catch {
    fallbackStores[store]?.clear();
  }
}

// ---------------------------------------------------------------------------
// Internal IDB helpers
// ---------------------------------------------------------------------------

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function idbPut<T>(storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function idbClear(storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function ensureFallbackStore(store: string): void {
  if (!fallbackStores[store]) {
    fallbackStores[store] = new Map();
  }
}

/** Exported for testing only. */
export const _settingsDbTesting = {
  get fallbackMode() { return fallbackMode; },
  get db() { return db; },
  fallbackStores,
  reset(): void {
    if (db) {
      db.close();
      db = null;
    }
    fallbackMode = false;
    initPromise = null;
    for (const map of Object.values(fallbackStores)) {
      map.clear();
    }
  },
};
