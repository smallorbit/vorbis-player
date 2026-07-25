/**
 * IndexedDB-based persistent cache for library data (all providers).
 *
 * This module is the public surface: typed per-store CRUD wrappers built on
 * top of `getStore<T>` from `./libraryCacheStorage`. The storage layer hides
 * the IndexedDB / in-memory fallback split, and the lifecycle layer owns the
 * singleton state plus the open/upgrade step.
 *
 * Records are neutral domain shapes keyed by `(provider, id)`:
 * collections under `"{provider}:{id}"`, track lists under the
 * collection-ref key (`collectionRefToKey`).
 */

import type { CollectionRef, MediaCollection, MediaTrack, ProviderId } from '@/types/domain';
import { collectionRefToKey, keyToCollectionRef } from '@/types/domain';
import type {
  CachedTrackList,
  LibraryCacheMeta,
} from './cacheTypes';
import {
  closeCache,
  getDb,
  initCache,
  isFallback,
  STORE_ALBUMS,
  STORE_META,
  STORE_PLAYLISTS,
  STORE_TRACK_LISTS,
} from './libraryCacheLifecycle';
import { fallbackStores, getStore } from './libraryCacheStorage';

export { initCache, closeCache };

const playlists = getStore<MediaCollection>(STORE_PLAYLISTS);
const albums = getStore<MediaCollection>(STORE_ALBUMS);
const trackLists = getStore<CachedTrackList>(STORE_TRACK_LISTS);
const meta = getStore<LibraryCacheMeta>(STORE_META);

function collectionKey(provider: ProviderId, id: string): string {
  return `${provider}:${id}`;
}

type CollectionStore = ReturnType<typeof getStore<MediaCollection>>;

/**
 * Replace every record belonging to `provider` with `items`, leaving other
 * providers' records untouched.
 */
async function replaceProviderCollections(
  store: CollectionStore,
  provider: ProviderId,
  items: MediaCollection[],
): Promise<void> {
  const existing = await store.getAll();
  const nextIds = new Set(items.map((c) => c.id));
  const removals = existing
    .filter((c) => c.provider === provider && !nextIds.has(c.id))
    .map((c) => store.remove(collectionKey(provider, c.id)));
  await Promise.all(removals);
  await store.putAll(items.map((c) => [collectionKey(c.provider, c.id), c]));
}

// =============================================================================
// Playlist Operations
// =============================================================================

export async function getAllPlaylists(): Promise<MediaCollection[]> {
  return playlists.getAll();
}

export async function replaceProviderPlaylists(
  provider: ProviderId,
  items: MediaCollection[],
): Promise<void> {
  return replaceProviderCollections(playlists, provider, items);
}

export async function putPlaylist(playlist: MediaCollection): Promise<void> {
  return playlists.put(collectionKey(playlist.provider, playlist.id), playlist);
}

export async function removePlaylist(provider: ProviderId, id: string): Promise<void> {
  return playlists.remove(collectionKey(provider, id));
}

// =============================================================================
// Album Operations
// =============================================================================

export async function getAllAlbums(): Promise<MediaCollection[]> {
  return albums.getAll();
}

export async function replaceProviderAlbums(
  provider: ProviderId,
  items: MediaCollection[],
): Promise<void> {
  return replaceProviderCollections(albums, provider, items);
}

export async function putAlbum(album: MediaCollection): Promise<void> {
  return albums.put(collectionKey(album.provider, album.id), album);
}

export async function removeAlbum(provider: ProviderId, id: string): Promise<void> {
  return albums.remove(collectionKey(provider, id));
}

// =============================================================================
// Track List Operations
// =============================================================================

export async function getTrackList(ref: CollectionRef): Promise<CachedTrackList | undefined> {
  return trackLists.get(collectionRefToKey(ref));
}

export async function putTrackList(
  ref: CollectionRef,
  tracks: MediaTrack[],
  revision?: string,
): Promise<void> {
  const key = collectionRefToKey(ref);
  const entry: CachedTrackList = {
    key,
    tracks,
    timestamp: Date.now(),
    ...(revision !== undefined && { revision }),
  };
  return trackLists.put(key, entry);
}

export async function removeTrackList(ref: CollectionRef): Promise<void> {
  return trackLists.remove(collectionRefToKey(ref));
}

// =============================================================================
// Metadata Operations
// =============================================================================

export async function getMeta(key: string): Promise<LibraryCacheMeta | undefined> {
  return meta.get(key);
}

export async function putMeta(
  key: string,
  value: Omit<LibraryCacheMeta, 'key'>,
): Promise<void> {
  return meta.put(key, { ...value, key });
}

// =============================================================================
// Clear All
// =============================================================================

interface ClearCacheOptions {
  /** When true, liked songs track lists are also cleared. Default: false (preserve). */
  clearLikes?: boolean;
}

/**
 * Clear the library cache with optional preservation of liked songs data.
 * By default, liked songs are preserved so they don't need to be re-fetched.
 */
export async function clearCacheWithOptions(options: ClearCacheOptions = {}): Promise<void> {
  const { clearLikes = false } = options;

  let savedLikedLists: CachedTrackList[] = [];
  if (!clearLikes) {
    const allLists = await trackLists.getAll();
    savedLikedLists = allLists.filter((list) => keyToCollectionRef(list.key)?.kind === 'liked');
  }

  await clearAll();

  if (savedLikedLists.length > 0) {
    await trackLists.putAll(savedLikedLists.map((list) => [list.key, list]));
  }
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    playlists.clear(),
    albums.clear(),
    trackLists.clear(),
    meta.clear(),
  ]);
}

/** Exported for testing only */
export const _testing = {
  get fallbackMode() {
    return isFallback();
  },
  get db() {
    return getDb();
  },
  fallbackStores,
};
