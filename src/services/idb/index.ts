/**
 * Shared IndexedDB foundation (#1702 / F35).
 *
 * One lifecycle + KVStore + degradation policy for library cache, settings,
 * and Dropbox art/catalog/likes databases.
 */

export type {
  CreateIdbDatabaseOptions,
  IDBMode,
  IdbErrorKind,
  KVStore,
  StoreKeyMode,
  StoreSpec,
} from './types';
export type { IdbDatabaseHandle } from './createDatabase';
export type { DegradationContext, DegradationResult } from './degradation';

export { createIdbDatabase } from './createDatabase';
export { classifyIdbError, runWithDegradationPolicy } from './degradation';
export { deleteIdbDatabase, openIdbDatabase } from './openDatabase';
