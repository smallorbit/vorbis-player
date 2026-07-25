import type { CollectionRef, MediaCollection, MediaTrack } from '@/types/domain';
import type { SpotifyAlbum, SpotifyImage, SpotifyTrackItem, PaginatedResponse } from './types';
import { getLargestImage } from './types';
import { spotifyApiRequest, fetchAllPaginated } from './api';
import { spotifyAuth } from './auth';
import { albumSavedCache, trackListCache, TRACK_LIST_CACHE_TTL, TRACK_LIST_PERSIST_TTL, TRACK_SAVED_CACHE_TTL } from './cache';
import { formatArtists, transformTrackItem } from './tracks';
import * as libraryCache from '../cache/libraryCache';
import { collectionRefToKey } from '@/types/domain';
import { logCaughtError } from '@/utils/logCaughtError';

// =============================================================================
// Shared Helpers
// =============================================================================

export interface SavedAlbumItem {
  added_at: string;
  album: SpotifyAlbum;
}

/**
 * Convert a raw saved-album item into the neutral `MediaCollection` shape.
 * This is the single Spotify→domain conversion point for albums.
 */
export function transformSavedAlbumItem(item: SavedAlbumItem): MediaCollection {
  const album = item.album;
  const imageUrl = getLargestImage(album.images);
  return {
    id: album.id ?? '',
    provider: 'spotify',
    kind: 'album',
    name: album.name ?? 'Unknown Album',
    ownerName: formatArtists(album.artists),
    trackCount: album.total_tracks ?? 0,
    genres: album.genres ?? [],
    ...(imageUrl !== undefined && { imageUrl }),
    ...(album.release_date !== undefined && { releaseDate: album.release_date }),
  };
}

function albumRef(albumId: string): CollectionRef {
  return { provider: 'spotify', kind: 'album', id: albumId };
}

// =============================================================================
// Album Functions
// =============================================================================

export async function getAlbumTracks(albumId: string): Promise<MediaTrack[]> {
  const ref = albumRef(albumId);
  const cacheKey = collectionRefToKey(ref);

  // L1: Check in-memory cache (instant)
  const cached = trackListCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TRACK_LIST_CACHE_TTL) {
    return cached.data;
  }

  // L2: Check IndexedDB persistent cache (survives page reload)
  try {
    const idbCached = await libraryCache.getTrackList(ref);
    if (idbCached && Date.now() - idbCached.timestamp < TRACK_LIST_PERSIST_TTL) {
      trackListCache.set(cacheKey, { data: idbCached.tracks, timestamp: idbCached.timestamp });
      return idbCached.tracks;
    }
  } catch (err) {
    // IndexedDB read failed, continue to API fetch
    logCaughtError('spotify.albums.getAlbumTracks.idbRead', err);
  }

  // L3: Fetch from Spotify API
  const token = await spotifyAuth.ensureValidToken();

  interface AlbumResponse {
    id: string;
    name: string;
    images?: SpotifyImage[];
    tracks: { items: SpotifyTrackItem[] };
    /** Genres from the full album object (absent on simplified objects). */
    genres?: string[];
  }

  const album = await spotifyApiRequest<AlbumResponse>(
    `https://api.spotify.com/v1/albums/${albumId}`,
    token
  );

  const albumImage = getLargestImage(album.images);
  const tracks: MediaTrack[] = [];

  for (const trackItem of album.tracks.items ?? []) {
    const track = transformTrackItem(trackItem, {
      name: album.name,
      id: album.id,
      ...(albumImage !== undefined && { image: albumImage }),
    });
    if (track) {
      // Propagate album genres to each track (Spotify genres live at album level)
      if (album.genres?.length) track.genres = album.genres;
      tracks.push(track);
    }
  }

  const sorted = tracks.sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));

  // Write to both L1 and L2
  trackListCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
  libraryCache.putTrackList(ref, sorted).catch(() => {});
  return sorted;
}

export async function checkAlbumSaved(albumId: string): Promise<boolean> {
  const cached = albumSavedCache.get(albumId);
  if (cached && Date.now() - cached.timestamp < TRACK_SAVED_CACHE_TTL) {
    return cached.value;
  }

  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<boolean[]>(
    `https://api.spotify.com/v1/me/albums/contains?ids=${albumId}`,
    token
  );
  const result = data[0] ?? false;
  albumSavedCache.set(albumId, { value: result, timestamp: Date.now() });
  return result;
}

async function modifyAlbumSaved(albumId: string, save: boolean): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();
  const method = save ? 'PUT' : 'DELETE';
  await spotifyApiRequest<void>('https://api.spotify.com/v1/me/albums', token, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [albumId] }),
  });

  albumSavedCache.set(albumId, { value: save, timestamp: Date.now() });
}

export async function saveAlbum(albumId: string): Promise<void> {
  return modifyAlbumSaved(albumId, true);
}

export async function unsaveAlbum(albumId: string): Promise<void> {
  return modifyAlbumSaved(albumId, false);
}

/** Get just the total count of user's saved albums (1 API call, returns 1 item). */
export async function getAlbumCount(signal?: AbortSignal): Promise<number> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<PaginatedResponse<unknown>>(
    'https://api.spotify.com/v1/me/albums?limit=1&offset=0',
    token,
    signal ? { signal } : {},
  );
  return data.total ?? 0;
}

/** Fetch ALL user saved albums with full pagination (not capped at 50). */
export async function getAllUserAlbums(signal?: AbortSignal): Promise<MediaCollection[]> {
  const token = await spotifyAuth.ensureValidToken();
  return fetchAllPaginated<SavedAlbumItem, MediaCollection>(
    'https://api.spotify.com/v1/me/albums?limit=50',
    token,
    transformSavedAlbumItem,
    signal ? { signal } : {},
  );
}
