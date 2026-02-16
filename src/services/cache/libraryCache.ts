/**
 * IndexedDB-based persistent cache for Spotify library data.
 *
 * Stores playlists, albums, and track lists as individual records so that
 * incremental updates (add/remove/update single entries) are efficient.
 *
 * Falls back to in-memory Maps if IndexedDB is unavailable.
 */

import type { AlbumInfo } from '../spotify';
import type {
  CachedPlaylistInfo,
  CachedTrackList,
  LibraryCacheMeta,
} from './cacheTypes';

const DB_NAME = 'vorbis-player-library';
const DB_VERSION = 1;

const STORE_PLAYLISTS = 'playlists';
const STORE_ALBUMS = 'albums';
const STORE_TRACK_LISTS = 'trackLists';
const STORE_META = 'meta';

const LOCALSTORAGE_PLAYLISTS_KEY = 'vorbis-player-cache-playlists';
const LOCALSTORAGE_ALBUMS_KEY = 'vorbis-player-cache-albums';

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

// =============================================================================
// Playlist Operations
// =============================================================================

export async function getAllPlaylists(): Promise<CachedPlaylistInfo[]> {
  await initCache();
  if (fallbackMode) {
    return Array.from(fallbackStores.playlists.values());
  }
  try {
    return await idbGetAll<CachedPlaylistInfo>(STORE_PLAYLISTS);
  } catch {
    return Array.from(fallbackStores.playlists.values());
  }
}

export async function putAllPlaylists(playlists: CachedPlaylistInfo[]): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.playlists.clear();
    for (const p of playlists) fallbackStores.playlists.set(p.id, p);
    return;
  }
  try {
    await idbClear(STORE_PLAYLISTS);
    await idbPutAll(STORE_PLAYLISTS, playlists);
  } catch {
    // Fall through to memory
    for (const p of playlists) fallbackStores.playlists.set(p.id, p);
  }
}

export async function putPlaylist(playlist: CachedPlaylistInfo): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.playlists.set(playlist.id, playlist);
    return;
  }
  try {
    await idbPut(STORE_PLAYLISTS, playlist);
  } catch {
    fallbackStores.playlists.set(playlist.id, playlist);
  }
}

export async function removePlaylist(id: string): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.playlists.delete(id);
    return;
  }
  try {
    await idbDelete(STORE_PLAYLISTS, id);
  } catch {
    fallbackStores.playlists.delete(id);
  }
}

// =============================================================================
// Album Operations
// =============================================================================

export async function getAllAlbums(): Promise<AlbumInfo[]> {
  await initCache();
  if (fallbackMode) {
    return Array.from(fallbackStores.albums.values());
  }
  try {
    return await idbGetAll<AlbumInfo>(STORE_ALBUMS);
  } catch {
    return Array.from(fallbackStores.albums.values());
  }
}

export async function putAllAlbums(albums: AlbumInfo[]): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.albums.clear();
    for (const a of albums) fallbackStores.albums.set(a.id, a);
    return;
  }
  try {
    await idbClear(STORE_ALBUMS);
    await idbPutAll(STORE_ALBUMS, albums);
  } catch {
    for (const a of albums) fallbackStores.albums.set(a.id, a);
  }
}

export async function putAlbum(album: AlbumInfo): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.albums.set(album.id, album);
    return;
  }
  try {
    await idbPut(STORE_ALBUMS, album);
  } catch {
    fallbackStores.albums.set(album.id, album);
  }
}

export async function removeAlbum(id: string): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.albums.delete(id);
    return;
  }
  try {
    await idbDelete(STORE_ALBUMS, id);
  } catch {
    fallbackStores.albums.delete(id);
  }
}

// =============================================================================
// Track List Operations
// =============================================================================

export async function getTrackList(id: string): Promise<CachedTrackList | undefined> {
  await initCache();
  if (fallbackMode) {
    return fallbackStores.trackLists.get(id);
  }
  try {
    return await idbGet<CachedTrackList>(STORE_TRACK_LISTS, id);
  } catch {
    return fallbackStores.trackLists.get(id);
  }
}

export async function putTrackList(id: string, tracks: import('../spotify').Track[], snapshotId?: string): Promise<void> {
  const entry: CachedTrackList = { id, tracks, timestamp: Date.now(), snapshotId };
  await initCache();
  if (fallbackMode) {
    fallbackStores.trackLists.set(id, entry);
    return;
  }
  try {
    await idbPut(STORE_TRACK_LISTS, entry);
  } catch {
    fallbackStores.trackLists.set(id, entry);
  }
}

export async function removeTrackList(id: string): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.trackLists.delete(id);
    return;
  }
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
  if (fallbackMode) {
    return fallbackStores.meta.get(key);
  }
  try {
    return await idbGet<LibraryCacheMeta>(STORE_META, key);
  } catch {
    return fallbackStores.meta.get(key);
  }
}

export async function putMeta(key: string, meta: Omit<LibraryCacheMeta, 'key'>): Promise<void> {
  const entry = { ...meta, key };
  await initCache();
  if (fallbackMode) {
    fallbackStores.meta.set(key, entry);
    return;
  }
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
    const playlistsRaw = localStorage.getItem(LOCALSTORAGE_PLAYLISTS_KEY);
    const albumsRaw = localStorage.getItem(LOCALSTORAGE_ALBUMS_KEY);

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
        localStorage.removeItem(LOCALSTORAGE_PLAYLISTS_KEY);
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
        localStorage.removeItem(LOCALSTORAGE_ALBUMS_KEY);
      }
    }
  } catch (err) {
    console.warn('[libraryCache] localStorage migration failed:', err);
  }
}

// =============================================================================
// Clear All
// =============================================================================

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
