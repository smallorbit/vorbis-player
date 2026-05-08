/**
 * Database lifecycle for the library cache.
 *
 * Owns the singleton IndexedDB connection and the in-memory fallback flag.
 * Exposes the open/upgrade promise and the localStorage migration step.
 */

import type { AlbumInfo } from '../spotify';
import type {
  CachedPlaylistInfo,
  CachedTrackList,
  LibraryCacheMeta,
} from './cacheTypes';
import { STORAGE_KEYS } from '@/constants/storage';

const DB_NAME = 'vorbis-player-library';
const DB_VERSION = 1;

export const STORE_PLAYLISTS = 'playlists';
export const STORE_ALBUMS = 'albums';
export const STORE_TRACK_LISTS = 'trackLists';
export const STORE_META = 'meta';

export interface FallbackStores {
  playlists: Map<string, CachedPlaylistInfo>;
  albums: Map<string, AlbumInfo>;
  trackLists: Map<string, CachedTrackList>;
  meta: Map<string, LibraryCacheMeta>;
}

export const fallbackStores: FallbackStores = {
  playlists: new Map(),
  albums: new Map(),
  trackLists: new Map(),
  meta: new Map(),
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

export function getFallbackMap(storeName: string): Map<string, unknown> {
  switch (storeName) {
    case STORE_PLAYLISTS:
      return fallbackStores.playlists as Map<string, unknown>;
    case STORE_ALBUMS:
      return fallbackStores.albums as Map<string, unknown>;
    case STORE_TRACK_LISTS:
      return fallbackStores.trackLists as Map<string, unknown>;
    case STORE_META:
      return fallbackStores.meta as Map<string, unknown>;
    default:
      throw new Error(`[libraryCache] Unknown store: ${storeName}`);
  }
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_PLAYLISTS)) {
        database.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_ALBUMS)) {
        database.createObjectStore(STORE_ALBUMS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_TRACK_LISTS)) {
        database.createObjectStore(STORE_TRACK_LISTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_META)) {
        database.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Initialize the cache. Opens IndexedDB, migrates from localStorage,
 * or activates the in-memory fallback.
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
      await migrateFromLocalStorage();
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
  fallbackStores.playlists.clear();
  fallbackStores.albums.clear();
  fallbackStores.trackLists.clear();
  fallbackStores.meta.clear();
}

interface LocalStorageCacheEntry<T> {
  data: T;
  timestamp: number;
}

function idbPutDirect<T>(storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('DB not initialized'));
      return;
    }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function idbPutAllDirect<T>(storeName: string, items: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('DB not initialized'));
      return;
    }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateFromLocalStorage(): Promise<void> {
  try {
    const playlistsRaw = localStorage.getItem(STORAGE_KEYS.CACHE_PLAYLISTS);
    const albumsRaw = localStorage.getItem(STORAGE_KEYS.CACHE_ALBUMS);

    if (!playlistsRaw && !albumsRaw) return;

    if (playlistsRaw) {
      const entry = JSON.parse(playlistsRaw) as LocalStorageCacheEntry<CachedPlaylistInfo[]>;
      if (entry?.data?.length) {
        await idbPutAllDirect(STORE_PLAYLISTS, entry.data);
        const snapshotIds: Record<string, string> = {};
        for (const p of entry.data) {
          if (p.snapshot_id) snapshotIds[p.id] = p.snapshot_id;
        }
        await idbPutDirect(STORE_META, {
          key: 'playlists',
          lastValidated: entry.timestamp,
          totalCount: entry.data.length,
          snapshotIds,
        } satisfies LibraryCacheMeta);
        localStorage.removeItem(STORAGE_KEYS.CACHE_PLAYLISTS);
      }
    }

    if (albumsRaw) {
      const entry = JSON.parse(albumsRaw) as LocalStorageCacheEntry<AlbumInfo[]>;
      if (entry?.data?.length) {
        await idbPutAllDirect(STORE_ALBUMS, entry.data);
        const latestAddedAt = entry.data.reduce(
          (latest, a) => (a.added_at && a.added_at > latest ? a.added_at : latest),
          '',
        );
        await idbPutDirect(STORE_META, {
          key: 'albums',
          lastValidated: entry.timestamp,
          totalCount: entry.data.length,
          latestAddedAt: latestAddedAt || undefined,
        } satisfies LibraryCacheMeta);
        localStorage.removeItem(STORAGE_KEYS.CACHE_ALBUMS);
      }
    }
  } catch (err) {
    console.warn('[libraryCache] localStorage migration failed:', err);
  }
}
