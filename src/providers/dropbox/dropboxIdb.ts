/**
 * Shared Dropbox IndexedDB handle (art / catalog / likes / … on one DB).
 * Domain modules import `getDb` from here or via `dropboxArtCache` re-exports.
 */

import { createIdbDatabase, type IdbDatabaseHandle } from '@/services/idb';

const DB_NAME = 'vorbis-dropbox-art';
const DB_VERSION = 7;

const DROPBOX_STORES = [
  { name: 'art', keyMode: { kind: 'keyPath' as const, keyPath: 'path' } },
  { name: 'catalog', keyMode: { kind: 'keyPath' as const, keyPath: 'key' } },
  { name: 'likes', keyMode: { kind: 'keyPath' as const, keyPath: 'trackId' } },
  { name: 'durations', keyMode: { kind: 'keyPath' as const, keyPath: 'trackId' } },
  { name: 'tags', keyMode: { kind: 'keyPath' as const, keyPath: 'trackId' } },
  { name: 'tombstones', keyMode: { kind: 'keyPath' as const, keyPath: 'trackId' } },
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

export function closeDropboxCache(): void {
  dropboxIdbHandle.close();
}
