/**
 * IndexedDB-based persistent cache for Spotify library data.
 *
 * Stores playlists, albums, and track lists as individual records so that
 * incremental updates (add/remove/update single entries) are efficient.
 *
 * Falls back to in-memory Maps if IndexedDB is unavailable.
 */

import type { AlbumInfo, Track } from '../spotify';
import type {
  CachedPlaylistInfo,
  CachedTrackList,
  LibraryCacheMeta,
} from './cacheTypes';
import { STORAGE_KEYS } from '@/constants/storage';

const DB_NAME = 'vorbis-player-library';
const DB_VERSION = 1;

const STORE_PLAYLISTS = 'playlists';
const STORE_ALBUMS = 'albums';
const STORE_TRACK_LISTS = 'trackLists';
const STORE_META = 'meta';

// =============================================================================
// In-Memory Fallback
// =============================================================================

interface FallbackStores {
  playlists: Map<string, CachedPlaylistInfo>;
  albums: Map<string, AlbumInfo>;
  trackLists: Map<string, CachedTrackList>;
  meta: Map<string, LibraryCacheMeta>;
}

const fallbackStores: FallbackStores = {
  playlists: new Map(),
  albums: new Map(),
  trackLists: new Map(),
  meta: new Map(),
};

// =============================================================================
// State
// =============================================================================

let db: IDBDatabase | null = null;
let fallbackMode = false;
let initPromise: Promise<void> | null = null;

// =============================================================================
// Database Lifecycle
// =============================================================================

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

// =============================================================================
// Internal Helpers
// =============================================================================

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

function idbGetAll<T>(storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
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

function idbDelete(storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
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

function idbPutAll<T>(storeName: string, items: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Atomically replace all records in a store: clear + putAll in a single transaction. */
function idbReplaceAll<T>(storeName: string, items: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// =============================================================================
// Generic Store Operations Factory
// =============================================================================

interface StoreOps<T extends { id: string }> {
  getAll: () => Promise<T[]>;
  put: (item: T) => Promise<void>;
  remove: (id: string) => Promise<void>;
  replaceAll: (items: T[]) => Promise<void>;
}

function createStoreOps<T extends { id: string }>(
  storeName: string,
  fallback: Map<string, T>,
): StoreOps<T> {
  return {
    async getAll(): Promise<T[]> {
      await initCache();
      if (fallbackMode) return Array.from(fallback.values());
      try {
        return await idbGetAll<T>(storeName);
      } catch {
        return Array.from(fallback.values());
      }
    },

    async put(item: T): Promise<void> {
      await initCache();
      if (fallbackMode) { fallback.set(item.id, item); return; }
      try {
        await idbPut(storeName, item);
      } catch {
        fallback.set(item.id, item);
      }
    },

    async remove(id: string): Promise<void> {
      await initCache();
      if (fallbackMode) { fallback.delete(id); return; }
      try {
        await idbDelete(storeName, id);
      } catch {
        fallback.delete(id);
      }
    },

    async replaceAll(items: T[]): Promise<void> {
      await initCache();
      if (fallbackMode) {
        fallback.clear();
        for (const item of items) fallback.set(item.id, item);
        return;
      }
      try {
        await idbReplaceAll(storeName, items);
      } catch {
        for (const item of items) fallback.set(item.id, item);
      }
    },
  };
}

// =============================================================================
// Playlist Operations
// =============================================================================

const playlistOps = createStoreOps<CachedPlaylistInfo>(STORE_PLAYLISTS, fallbackStores.playlists);

export async function getAllPlaylists(): Promise<CachedPlaylistInfo[]> {
  return playlistOps.getAll();
}

export async function putAllPlaylists(playlists: CachedPlaylistInfo[]): Promise<void> {
  return playlistOps.replaceAll(playlists);
}

export async function putPlaylist(playlist: CachedPlaylistInfo): Promise<void> {
  return playlistOps.put(playlist);
}

export async function removePlaylist(id: string): Promise<void> {
  return playlistOps.remove(id);
}

// =============================================================================
// Album Operations
// =============================================================================

const albumOps = createStoreOps<AlbumInfo>(STORE_ALBUMS, fallbackStores.albums);

export async function getAllAlbums(): Promise<AlbumInfo[]> {
  return albumOps.getAll();
}

export async function putAllAlbums(albums: AlbumInfo[]): Promise<void> {
  return albumOps.replaceAll(albums);
}

export async function putAlbum(album: AlbumInfo): Promise<void> {
  return albumOps.put(album);
}

export async function removeAlbum(id: string): Promise<void> {
  return albumOps.remove(id);
}

// =============================================================================
// Track List Operations
// =============================================================================

export async function getTrackList(id: string): Promise<CachedTrackList | undefined> {
  await initCache();
  if (fallbackMode) return fallbackStores.trackLists.get(id);
  try {
    return await idbGet<CachedTrackList>(STORE_TRACK_LISTS, id);
  } catch {
    return fallbackStores.trackLists.get(id);
  }
}

export async function putTrackList(id: string, tracks: Track[], snapshotId?: string): Promise<void> {
  const entry: CachedTrackList = { id, tracks, timestamp: Date.now(), snapshotId };
  await initCache();
  if (fallbackMode) { fallbackStores.trackLists.set(id, entry); return; }
  try {
    await idbPut(STORE_TRACK_LISTS, entry);
  } catch {
    fallbackStores.trackLists.set(id, entry);
  }
}

export async function removeTrackList(id: string): Promise<void> {
  await initCache();
  if (fallbackMode) { fallbackStores.trackLists.delete(id); return; }
  try {
    await idbDelete(STORE_TRACK_LISTS, id);
  } catch {
    fallbackStores.trackLists.delete(id);
  }
}

// =============================================================================
// Metadata Operations
// =============================================================================

export async function getMeta(key: string): Promise<LibraryCacheMeta | undefined> {
  await initCache();
  if (fallbackMode) return fallbackStores.meta.get(key);
  try {
    return await idbGet<LibraryCacheMeta>(STORE_META, key);
  } catch {
    return fallbackStores.meta.get(key);
  }
}

export async function putMeta(key: string, meta: Omit<LibraryCacheMeta, 'key'>): Promise<void> {
  const entry = { ...meta, key };
  await initCache();
  if (fallbackMode) { fallbackStores.meta.set(key, entry); return; }
  try {
    await idbPut(STORE_META, entry);
  } catch {
    fallbackStores.meta.set(key, entry);
  }
}

// =============================================================================
// Migration from localStorage
// =============================================================================

interface LocalStorageCacheEntry<T> {
  data: T;
  timestamp: number;
}

async function migrateFromLocalStorage(): Promise<void> {
  try {
    const playlistsRaw = localStorage.getItem(STORAGE_KEYS.CACHE_PLAYLISTS);
    const albumsRaw = localStorage.getItem(STORAGE_KEYS.CACHE_ALBUMS);

    if (!playlistsRaw && !albumsRaw) return;

    if (playlistsRaw) {
      const entry = JSON.parse(playlistsRaw) as LocalStorageCacheEntry<CachedPlaylistInfo[]>;
      if (entry?.data?.length) {
        await idbPutAll(STORE_PLAYLISTS, entry.data);
        const snapshotIds: Record<string, string> = {};
        for (const p of entry.data) {
          if (p.snapshot_id) snapshotIds[p.id] = p.snapshot_id;
        }
        await idbPut(STORE_META, {
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
        await idbPutAll(STORE_ALBUMS, entry.data);
        const latestAddedAt = entry.data.reduce(
          (latest, a) => (a.added_at && a.added_at > latest ? a.added_at : latest),
          '',
        );
        await idbPut(STORE_META, {
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

// =============================================================================
// Clear All
// =============================================================================

const LIKED_SONGS_TRACK_LIST_ID = 'liked-songs';

interface ClearCacheOptions {
  /** When true, liked songs track list is also cleared. Default: false (preserve). */
  clearLikes?: boolean;
}

/**
 * Clear the library cache with optional preservation of liked songs data.
 * By default, liked songs are preserved so they don't need to be re-fetched.
 */
export async function clearCacheWithOptions(options: ClearCacheOptions = {}): Promise<void> {
  const { clearLikes = false } = options;

  let savedLikedSongs: CachedTrackList | undefined;
  if (!clearLikes) {
    savedLikedSongs = await getTrackList(LIKED_SONGS_TRACK_LIST_ID);
  }

  await clearAll();

  if (!clearLikes && savedLikedSongs) {
    await putTrackList(LIKED_SONGS_TRACK_LIST_ID, savedLikedSongs.tracks, savedLikedSongs.snapshotId);
  }
}

export async function clearAll(): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.playlists.clear();
    fallbackStores.albums.clear();
    fallbackStores.trackLists.clear();
    fallbackStores.meta.clear();
    return;
  }
  try {
    await Promise.all([
      idbClear(STORE_PLAYLISTS),
      idbClear(STORE_ALBUMS),
      idbClear(STORE_TRACK_LISTS),
      idbClear(STORE_META),
    ]);
  } catch {
    fallbackStores.playlists.clear();
    fallbackStores.albums.clear();
    fallbackStores.trackLists.clear();
    fallbackStores.meta.clear();
  }
}

/** Exported for testing only */
export const _testing = {
  get fallbackMode() { return fallbackMode; },
  get db() { return db; },
  fallbackStores,
};
