import type { ArtistRef, CollectionRef, MediaTrack } from '@/types/domain';
import type { SpotifyArtist, SpotifyTrackItem } from './types';
import { getLargestImage } from './types';
import { spotifyApiRequest, fetchAllPaginated } from './api';
import { spotifyAuth } from './auth';
import {
  trackSavedCache,
  TRACK_SAVED_CACHE_TTL,
  LIKED_SONGS_CACHE_TTL,
  LIKED_SONGS_COUNT_TTL,
  TRACK_LIST_PERSIST_TTL,
  invalidateTrackSavedCache,
  getLikedSongsCountCache,
  setLikedSongsCountCache,
  getLikedSongsCache,
  setLikedSongsCache,
} from './cache';
import * as libraryCache from '../cache/libraryCache';
import { logCaughtError } from '@/utils/logCaughtError';

const LIKED_SONGS_REF: CollectionRef = { provider: 'spotify', kind: 'liked' };

// =============================================================================
// Shared Utilities
// =============================================================================

export function formatArtists(artists?: SpotifyArtist[]): string {
  if (!artists || artists.length === 0) {
    return 'Unknown Artist';
  }
  return artists.map((artist) => artist.name).join(', ');
}

export function buildArtistsData(artists?: SpotifyArtist[]): ArtistRef[] | undefined {
  if (!artists || artists.length === 0) return undefined;

  const data: ArtistRef[] = [];
  for (const artist of artists) {
    const url = artist.external_urls?.spotify
      ?? (artist.id ? `https://open.spotify.com/artist/${artist.id}` : '');
    if (url) {
      data.push({ name: artist.name, url });
    }
  }
  return data.length > 0 ? data : undefined;
}

/**
 * Convert a raw Spotify track item into the neutral `MediaTrack` shape.
 * This is the single Spotify→domain conversion point for tracks.
 */
export function transformTrackItem(
  item: SpotifyTrackItem,
  albumOverride?: { name: string; id?: string; image?: string }
): MediaTrack | null {
  if (!item.id || item.type !== 'track') return null;

  const albumImage = albumOverride?.image ?? getLargestImage(item.album?.images);
  const artistsData = buildArtistsData(item.artists);
  const albumId = albumOverride?.id ?? item.album?.id;

  return {
    id: item.id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: item.uri },
    name: item.name,
    artists: formatArtists(item.artists),
    album: albumOverride?.name ?? item.album?.name ?? 'Unknown Album',
    durationMs: item.duration_ms ?? 0,
    externalUrl: `https://open.spotify.com/track/${item.id}`,
    genres: [],
    ...(artistsData !== undefined && { artistsData }),
    ...(albumId !== undefined && { albumId }),
    ...(item.track_number !== undefined && { trackNumber: item.track_number }),
    ...(albumImage !== undefined && { image: albumImage }),
  };
}

// =============================================================================
// Track Functions
// =============================================================================

export async function getLikedSongs(limit?: number): Promise<MediaTrack[]> {
  const likedSongsCache = getLikedSongsCache();
  if (likedSongsCache && Date.now() - likedSongsCache.timestamp < LIKED_SONGS_CACHE_TTL) {
    if (limit === undefined && likedSongsCache.limit === Infinity) {
      return likedSongsCache.data;
    }
    if (limit !== undefined && likedSongsCache.limit >= limit) {
      return likedSongsCache.data.slice(0, limit);
    }
  }

  if (limit === undefined) {
    try {
      const idbCached = await libraryCache.getTrackList(LIKED_SONGS_REF);
      if (idbCached && Date.now() - idbCached.timestamp < TRACK_LIST_PERSIST_TTL) {
        setLikedSongsCache({ data: idbCached.tracks, limit: Infinity, timestamp: idbCached.timestamp });
        return idbCached.tracks;
      }
    } catch (err) {
      /* IndexedDB unavailable — fall through to API */
      logCaughtError('spotify.tracks.getLikedSongs.idbRead', err);
    }
  }

  const token = await spotifyAuth.ensureValidToken();

  interface SavedTrackItem {
    added_at?: string;
    track: SpotifyTrackItem | null;
  }

  function transformSavedTrack(item: SavedTrackItem): MediaTrack | null {
    if (!item.track) {
      return null;
    }
    const track = transformTrackItem(item.track);
    if (!track) return null;
    if (item.added_at) {
      track.addedAt = new Date(item.added_at).getTime();
    }
    return track;
  }

  const tracks = await fetchAllPaginated<SavedTrackItem, MediaTrack>(
    'https://api.spotify.com/v1/me/tracks?limit=50',
    token,
    transformSavedTrack,
    limit !== undefined ? { maxItems: limit } : undefined
  );

  setLikedSongsCache({ data: tracks, limit: limit ?? Infinity, timestamp: Date.now() });
  if (limit === undefined) {
    libraryCache.putTrackList(LIKED_SONGS_REF, tracks).catch(() => {});
  }
  return tracks;
}

export async function getLikedSongsCount(signal?: AbortSignal): Promise<number> {
  const likedSongsCountCache = getLikedSongsCountCache();
  if (likedSongsCountCache && Date.now() - likedSongsCountCache.timestamp < LIKED_SONGS_COUNT_TTL) {
    return likedSongsCountCache.count;
  }

  const token = await spotifyAuth.ensureValidToken();

  interface LikedSongsResponse {
    total: number;
  }

  const data = await spotifyApiRequest<LikedSongsResponse>(
    'https://api.spotify.com/v1/me/tracks?limit=1',
    token,
    signal ? { signal } : {},
  );

  const count = data.total ?? 0;
  setLikedSongsCountCache({ count, timestamp: Date.now() });
  return count;
}

interface BatchEntry {
  id: string;
  resolve: (value: boolean) => void;
  reject: (reason: unknown) => void;
}

const BATCH_SIZE = 50;
const BATCH_COLLECT_DELAY_MS = 50;
const BATCH_INTER_CHUNK_DELAY_MS = 100;

let _batchQueue: BatchEntry[] = [];
let _batchFlushTimer: ReturnType<typeof setTimeout> | null = null;

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function _flushBatch(): Promise<void> {
  _batchFlushTimer = null;
  const queue = _batchQueue;
  _batchQueue = [];

  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    if (i > 0) {
      await _sleep(BATCH_INTER_CHUNK_DELAY_MS);
    }
    const chunk = queue.slice(i, i + BATCH_SIZE);
    const ids = chunk.map((entry) => entry.id);
    try {
      const token = await spotifyAuth.ensureValidToken();
      const data = await spotifyApiRequest<boolean[]>(
        `https://api.spotify.com/v1/me/tracks/contains?ids=${ids.join(',')}`,
        token
      );
      const now = Date.now();
      chunk.forEach((entry, index) => {
        const result = data[index] ?? false;
        trackSavedCache.set(entry.id, { value: result, timestamp: now });
        entry.resolve(result);
      });
    } catch (err) {
      chunk.forEach((entry) => entry.reject(err));
    }
  }
}

export function checkTrackSaved(trackId: string): Promise<boolean> {
  const cached = trackSavedCache.get(trackId);
  if (cached && Date.now() - cached.timestamp < TRACK_SAVED_CACHE_TTL) {
    return Promise.resolve(cached.value);
  }

  return new Promise((resolve, reject) => {
    _batchQueue.push({ id: trackId, resolve, reject });
    if (_batchFlushTimer === null) {
      _batchFlushTimer = setTimeout(_flushBatch, BATCH_COLLECT_DELAY_MS);
    }
  });
}

async function modifyTrackSaved(trackId: string, save: boolean): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();
  const method = save ? 'PUT' : 'DELETE';
  await spotifyApiRequest<void>('https://api.spotify.com/v1/me/tracks', token, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [trackId] }),
  });

  // Optimistically update the saved-track cache
  invalidateTrackSavedCache(trackId);
  trackSavedCache.set(trackId, { value: save, timestamp: Date.now() });

  // Also invalidate liked songs caches since the list changed
  setLikedSongsCache(null);
  setLikedSongsCountCache(null);
}

export async function saveTrack(trackId: string): Promise<void> {
  return modifyTrackSaved(trackId, true);
}

export async function unsaveTrack(trackId: string): Promise<void> {
  return modifyTrackSaved(trackId, false);
}

export function invalidateLikedSongsCaches(): void {
  setLikedSongsCache(null);
  setLikedSongsCountCache(null);
}
