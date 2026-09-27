/**
 * Shared IndexedDB foundation (#1702 / F35).
 *
 * One lifecycle + KVStore + degradation policy for library cache, settings,
 * and Dropbox art/catalog/likes databases.
 */

export type { KVStore } from './types';
export type { IdbDatabaseHandle } from './types';

export { createIdbDatabase } from './createDatabase';
export { runWithDegradationPolicy } from './degradation';
export { deleteIdbDatabase } from './openDatabase';
