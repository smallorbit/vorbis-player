/**
 * Low-level IndexedDB open helper shared by all vorbis IDB consumers.
 */

import type { CreateIdbDatabaseOptions, StoreSpec } from './types';

function createMissingStores(db: IDBDatabase, stores: readonly StoreSpec[]): void {
  for (const spec of stores) {
    if (db.objectStoreNames.contains(spec.name)) continue;
    if (spec.keyMode.kind === 'keyPath') {
      db.createObjectStore(spec.name, { keyPath: spec.keyMode.keyPath });
    } else {
      db.createObjectStore(spec.name);
    }
  }
}

/**
 * Open (or upgrade) an IndexedDB database.
 * Rejects on `onerror` / `onblocked` so callers can enter memory fallback.
 *
 * @param onVersionChange — called when another connection wants to upgrade.
 *   Default closes the DB. Callers should also drop their held reference so
 *   the next `init()` reopens instead of reading through a closed handle.
 */
export function openIdbDatabase(
  options: CreateIdbDatabaseOptions,
  onVersionChange?: ((database: IDBDatabase) => void) | undefined,
): Promise<IDBDatabase> {
  const { name, version, stores, onUpgrade, customUpgradeOnly } = options;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));

    // Another tab still holds a lower-version connection: `success` will never
    // fire until it closes. Reject so the caller can fall back for this session
    // instead of hanging every read forever.
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));

    request.onsuccess = () => {
      const database = request.result;
      // Close when a newer version wants to upgrade elsewhere so this tab
      // never becomes the blocker described above.
      database.onversionchange = () => {
        if (onVersionChange) {
          onVersionChange(database);
        } else {
          database.close();
        }
      };
      resolve(database);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      const oldVersion = event.oldVersion;

      if (onUpgrade && transaction) {
        onUpgrade(database, oldVersion, transaction);
      }

      if (!customUpgradeOnly) {
        createMissingStores(database, stores);
      }
    };
  });
}

export function deleteIdbDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('IndexedDB deleteDatabase failed'));
    // Treat blocked like success for teardown — another connection will finish
    // the delete when it closes; waiting forever is worse than continuing.
    request.onblocked = () => resolve();
  });
}
