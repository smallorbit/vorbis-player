/**
 * IndexedDB-based persistent cache for Apple Music library data.
 *
 * Stores playlists, albums, and metadata as individual records.
 * Falls back to in-memory Maps if IndexedDB is unavailable.
 */

import type { MediaCollection } from '@/types/domain';

const DB_NAME = 'vorbis-apple-music-library';
const DB_VERSION = 1;

const STORE_PLAYLISTS = 'playlists';
const STORE_ALBUMS = 'albums';
const STORE_META = 'meta';

interface FallbackStores {
  playlists: Map<string, MediaCollection>;
  albums: Map<string, MediaCollection>;
  meta: Map<string, AppleMusicCacheMeta>;
}

export interface AppleMusicCacheMeta {
  key: string;
  lastValidated: number;
  totalCount: number;
}

const fallbackStores: FallbackStores = {
  playlists: new Map(),
  albums: new Map(),
  meta: new Map(),
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
      if (!database.objectStoreNames.contains(STORE_PLAYLISTS)) {
        database.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_ALBUMS)) {
        database.createObjectStore(STORE_ALBUMS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_META)) {
        database.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
  });
}

export async function initCache(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB not available');
      }
      db = await openIDB();
    } catch (err) {
      console.warn('[appleMusicCache] IndexedDB unavailable, using in-memory fallback:', err);
      fallbackMode = true;
      db = null;
    }
  })();
  return initPromise;
}

export function closeCache(): void {
  if (db) {
    db.close();
    db = null;
  }
  fallbackMode = false;
  initPromise = null;
  fallbackStores.playlists.clear();
  fallbackStores.albums.clear();
  fallbackStores.meta.clear();
}

// -- IDB helpers --

function idbGetAll<T>(storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

function idbPutAll<T>(storeName: string, items: T[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbClear(storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function idbPut<T>(storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('DB not initialized')); return; }
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// -- Public API --

export async function getAllPlaylists(): Promise<MediaCollection[]> {
  await initCache();
  if (fallbackMode) return Array.from(fallbackStores.playlists.values());
  try {
    return await idbGetAll<MediaCollection>(STORE_PLAYLISTS);
  } catch {
    return Array.from(fallbackStores.playlists.values());
  }
}

export async function putAllPlaylists(playlists: MediaCollection[]): Promise<void> {
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
    for (const p of playlists) fallbackStores.playlists.set(p.id, p);
  }
}

export async function getAllAlbums(): Promise<MediaCollection[]> {
  await initCache();
  if (fallbackMode) return Array.from(fallbackStores.albums.values());
  try {
    return await idbGetAll<MediaCollection>(STORE_ALBUMS);
  } catch {
    return Array.from(fallbackStores.albums.values());
  }
}

export async function putAllAlbums(albums: MediaCollection[]): Promise<void> {
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

export async function getMeta(key: string): Promise<AppleMusicCacheMeta | undefined> {
  await initCache();
  if (fallbackMode) return fallbackStores.meta.get(key);
  try {
    return await idbGet<AppleMusicCacheMeta>(STORE_META, key);
  } catch {
    return fallbackStores.meta.get(key);
  }
}

export async function putMeta(key: string, meta: Omit<AppleMusicCacheMeta, 'key'>): Promise<void> {
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

export async function clearAll(): Promise<void> {
  await initCache();
  if (fallbackMode) {
    fallbackStores.playlists.clear();
    fallbackStores.albums.clear();
    fallbackStores.meta.clear();
    return;
  }
  try {
    await Promise.all([
      idbClear(STORE_PLAYLISTS),
      idbClear(STORE_ALBUMS),
      idbClear(STORE_META),
    ]);
  } catch {
    fallbackStores.playlists.clear();
    fallbackStores.albums.clear();
    fallbackStores.meta.clear();
  }
}
