import type { Track } from './types';

// =============================================================================
// In-Memory Caches (short-lived, session-scoped)
// =============================================================================

/** Cache for checkTrackSaved results — keyed by track ID */
export const trackSavedCache = new Map<string, { value: boolean; timestamp: number }>();
export const TRACK_SAVED_CACHE_TTL = 60 * 1000; // 1 minute

/** Cache for checkAlbumSaved results — keyed by album ID */
export const albumSavedCache = new Map<string, { value: boolean; timestamp: number }>();

/** Cache for playlist/album track lists — keyed by playlist/album ID */
export const trackListCache = new Map<string, { data: Track[]; timestamp: number }>();
export const TRACK_LIST_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (in-memory L1)
export const TRACK_LIST_PERSIST_TTL = 24 * 60 * 60 * 1000; // 24 hours (IndexedDB L2)

/** Cache for liked songs count */
let likedSongsCountCacheData: { count: number; timestamp: number } | null = null;
export const LIKED_SONGS_COUNT_TTL = 2 * 60 * 1000; // 2 minutes

/** Cache for liked songs list — limit is Infinity when all songs were fetched */
let likedSongsCacheData: { data: Track[]; limit: number; timestamp: number } | null = null;
export const LIKED_SONGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidate track-saved cache for a given track (called on save/unsave).
 */
export function invalidateTrackSavedCache(trackId: string): void {
  trackSavedCache.delete(trackId);
}

/**
 * Get the current liked songs count cache
 */
export function getLikedSongsCountCache(): { count: number; timestamp: number } | null {
  return likedSongsCountCacheData;
}

/**
 * Set the liked songs count cache
 */
export function setLikedSongsCountCache(value: { count: number; timestamp: number } | null): void {
  likedSongsCountCacheData = value;
}

/**
 * Get the current liked songs cache
 */
export function getLikedSongsCache(): { data: Track[]; limit: number; timestamp: number } | null {
  return likedSongsCacheData;
}

/**
 * Set the liked songs cache
 */
export function setLikedSongsCache(value: { data: Track[]; limit: number; timestamp: number } | null): void {
  likedSongsCacheData = value;
}
