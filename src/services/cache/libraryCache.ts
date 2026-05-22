/**
 * IndexedDB-based persistent cache for Spotify library data.
 *
 * This module is the public surface: typed per-store CRUD wrappers built on
 * top of `getStore<T>` from `./libraryCacheStorage`. The storage layer hides
 * the IndexedDB / in-memory fallback split, and the lifecycle layer owns the
 * singleton state plus the open/upgrade and migration steps.
 */

import type { AlbumInfo, Track } from '../spotify';
import type {
  CachedPlaylistInfo,
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

const playlists = getStore<CachedPlaylistInfo>(STORE_PLAYLISTS);
const albums = getStore<AlbumInfo>(STORE_ALBUMS);
const trackLists = getStore<CachedTrackList>(STORE_TRACK_LISTS);
const meta = getStore<LibraryCacheMeta>(STORE_META);

// =============================================================================
// Playlist Operations
// =============================================================================

export async function getAllPlaylists(): Promise<CachedPlaylistInfo[]> {
  return playlists.getAll();
}

export async function putAllPlaylists(items: CachedPlaylistInfo[]): Promise<void> {
  return playlists.replaceAll(items.map((p) => [p.id, p]));
}

export async function putPlaylist(playlist: CachedPlaylistInfo): Promise<void> {
  return playlists.put(playlist.id, playlist);
}

export async function removePlaylist(id: string): Promise<void> {
  return playlists.remove(id);
}

// =============================================================================
// Album Operations
// =============================================================================

export async function getAllAlbums(): Promise<AlbumInfo[]> {
  return albums.getAll();
}

export async function putAllAlbums(items: AlbumInfo[]): Promise<void> {
  return albums.replaceAll(items.map((a) => [a.id, a]));
}

export async function putAlbum(album: AlbumInfo): Promise<void> {
  return albums.put(album.id, album);
}

export async function removeAlbum(id: string): Promise<void> {
  return albums.remove(id);
}

// =============================================================================
// Track List Operations
// =============================================================================

export async function getTrackList(id: string): Promise<CachedTrackList | undefined> {
  return trackLists.get(id);
}

export async function putTrackList(
  id: string,
  tracks: Track[],
  snapshotId?: string,
): Promise<void> {
  const entry: CachedTrackList = {
    id,
    tracks,
    timestamp: Date.now(),
    ...(snapshotId !== undefined && { snapshotId }),
  };
  return trackLists.put(id, entry);
}

export async function removeTrackList(id: string): Promise<void> {
  return trackLists.remove(id);
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
