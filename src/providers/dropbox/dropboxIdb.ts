/**
 * Shared Dropbox IndexedDB handle (art / catalog / likes / … on one DB).
 * Domain modules import `getDb` / `runDropboxWrite` from here.
 */

import { createIdbDatabase, runWithDegradationPolicy, type IdbDatabaseHandle } from '@/services/idb';
import { logCaughtError } from '@/utils/logCaughtError';

const DB_NAME = 'vorbis-dropbox-art';
const DB_VERSION = 7;

const DROPBOX_STORES = [
  { name: 'art', keyMode: { kind: 'keyPath' as const, keyPath: 'path' } },
  { name: 'catalog', keyMode: { kind: 'keyPath' as const, keyPath: 'key' } },
  // Likes + tombstones are user data — never clear them to free quota for art.
  { name: 'likes', keyMode: { kind: 'keyPath' as const, keyPath: 'trackId' }, evictableForQuota: false },
  { name: 'durations', keyMode: { kind: 'keyPath' as const, keyPath: 'trackId' } },
  { name: 'tags', keyMode: { kind: 'keyPath' as const, keyPath: 'trackId' } },
  { name: 'tombstones', keyMode: { kind: 'keyPath' as const, keyPath: 'trackId' }, evictableForQuota: false },
  { name: 'trackDates', keyMode: { kind: 'keyPath' as const, keyPath: 'albumId' } },
];

export const dropboxIdbHandle: IdbDatabaseHandle = createIdbDatabase({
  name: DB_NAME,
  version: DB_VERSION,
  logLabel: 'dropboxArtCache',
  stores: DROPBOX_STORES,
});

export async function getDb(): Promise<IDBDatabase | null> {
  await dropboxIdbHandle.init();
  return dropboxIdbHandle.getDb();
}

/**
 * Run a Dropbox IDB write under the shared degradation policy.
 * Exhausted writes are logged and dropped (no per-key overlay — art/catalog
 * blobs and likes use domain-specific soft-fail via the caller fallback).
 *
 * @param quotaEvictStores — stores cleared on QuotaExceeded (must be evictable).
 *   Prefer the store being written so an art put never clears catalog, etc.
 */
export async function runDropboxWrite(
  label: string,
  quotaEvictStores: readonly string[],
  operation: (database: IDBDatabase) => Promise<void>,
): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;

  const result = await runWithDegradationPolicy(
    {
      label,
      evictForQuota: () => dropboxIdbHandle.evictForQuota(quotaEvictStores),
      recoverFromCorruption: () => dropboxIdbHandle.recoverFromCorruption(),
      reopenConnection: () => dropboxIdbHandle.reopenConnection(),
    },
    async () => {
      const live = dropboxIdbHandle.getDb();
      if (!live) throw new Error('Dropbox IDB unavailable');
      await operation(live);
    },
  );

  if (!result.ok) {
    logCaughtError(`${label}.exhausted`, result.error);
    return false;
  }
  return true;
}
