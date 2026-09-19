/**
 * Shared IndexedDB types for the single foundation used by library cache,
 * settings, and Dropbox caches (#1702 / F35).
 */

export interface KVStore<T> {
  get(key: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  put(key: string, value: T): Promise<void>;
  putAll(entries: Array<[string, T]>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export type StoreKeyMode =
  | { readonly kind: 'outOfLine' }
  | { readonly kind: 'keyPath'; readonly keyPath: string };

export interface StoreSpec {
  readonly name: string;
  readonly keyMode: StoreKeyMode;
  /**
   * When false, quota eviction leaves this store intact (user data such as
   * Dropbox likes / tombstones). Defaults to true (cache-safe to clear).
   */
  readonly evictableForQuota?: boolean | undefined;
}

export interface CreateIdbDatabaseOptions {
  readonly name: string;
  readonly version: number;
  readonly stores: readonly StoreSpec[];
  /** Prefix for console / logCaughtError labels, e.g. `libraryCache`. */
  readonly logLabel: string;
  /**
   * Custom schema migration. When provided with `customUpgradeOnly: true`,
   * this is the sole upgrade path (e.g. library v1→v2 drop-and-recreate).
   * Otherwise missing stores from `stores` are still created afterwards.
   */
  readonly onUpgrade?:
    | ((db: IDBDatabase, oldVersion: number, transaction: IDBTransaction) => void)
    | undefined;
  readonly customUpgradeOnly?: boolean | undefined;
}

export type IdbErrorKind = 'quota' | 'corruption' | 'transient' | 'unknown';

export type IDBMode = 'readonly' | 'readwrite';
