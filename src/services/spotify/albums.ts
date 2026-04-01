import type { MediaTrack } from '@/types/domain';
import type { Track, AlbumInfo, SpotifyAlbum, SpotifyImage, SpotifyTrackItem, PaginatedResponse } from './types';
import { getLargestImage } from './types';
import { spotifyApiRequest } from './api';
import { spotifyAuth } from './auth';
import { albumSavedCache, trackListCache, TRACK_LIST_CACHE_TTL, TRACK_LIST_PERSIST_TTL, TRACK_SAVED_CACHE_TTL } from './cache';
import { formatArtists, transformTrackItem, backfillProvider, tracksToMediaTracks } from './tracks';
import * as libraryCache from '../cache/libraryCache';
import { ALBUM_ID_PREFIX } from '@/constants/playlist';

// =============================================================================
// Album Functions
// =============================================================================

export async function getAlbumTracks(albumId: string): Promise<MediaTrack[]> {
  const cacheKey = `${ALBUM_ID_PREFIX}${albumId}`;

  // L1: Check in-memory cache (instant)
  const cached = trackListCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TRACK_LIST_CACHE_TTL) {
    return tracksToMediaTracks(cached.data);
  }

  // L2: Check IndexedDB persistent cache (survives page reload)
  try {
    const idbCached = await libraryCache.getTrackList(cacheKey);
    if (idbCached && Date.now() - idbCached.timestamp < TRACK_LIST_PERSIST_TTL) {
      const tracks = backfillProvider(idbCached.tracks);
      trackListCache.set(cacheKey, { data: tracks, timestamp: idbCached.timestamp });
      return tracksToMediaTracks(tracks);
    }
  } catch {
    // IndexedDB read failed, continue to API fetch
  }

  // L3: Fetch from Spotify API
  const token = await spotifyAuth.ensureValidToken();

  interface AlbumResponse {
    id: string;
    name: string;
    images?: SpotifyImage[];
    tracks: { items: SpotifyTrackItem[] };
  }

  const album = await spotifyApiRequest<AlbumResponse>(
    `https://api.spotify.com/v1/albums/${albumId}`,
    token
  );

  const albumImage = getLargestImage(album.images);
  const tracks: Track[] = [];

  for (const trackItem of album.tracks.items ?? []) {
    const track = transformTrackItem(trackItem, {
      name: album.name,
      id: album.id,
      image: albumImage,
    });
    if (track) {
      tracks.push(track);
    }
  }

  const sorted = tracks.sort((a, b) => (a.track_number ?? 0) - (b.track_number ?? 0));

  // Write to both L1 and L2
  trackListCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
  libraryCache.putTrackList(cacheKey, sorted).catch(() => {});
  return tracksToMediaTracks(sorted);
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
    { signal }
  );
  return data.total ?? 0;
}

/** Fetch first page of albums for change comparison. */
export async function getAlbumsPage(
  limit: number = 50,
  signal?: AbortSignal
): Promise<{ albums: AlbumInfo[]; total: number; hasMore: boolean }> {
  const token = await spotifyAuth.ensureValidToken();

  interface SavedAlbumItem {
    added_at: string;
    album: SpotifyAlbum;
  }

  const data = await spotifyApiRequest<PaginatedResponse<SavedAlbumItem>>(
    `https://api.spotify.com/v1/me/albums?limit=${limit}&offset=0`,
    token,
    { signal }
  );
  const albums = (data.items ?? []).map((item) => {
    const album = item.album;
    return {
      id: album.id ?? '',
      name: album.name ?? 'Unknown Album',
      artists: formatArtists(album.artists),
      images: album.images ?? [],
      release_date: album.release_date ?? '',
      total_tracks: album.total_tracks ?? 0,
      uri: album.uri ?? '',
      album_type: album.album_type,
      added_at: item.added_at,
    } as AlbumInfo;
  });
  return {
    albums,
    total: data.total ?? 0,
    hasMore: data.next !== null,
  };
}

/** Fetch ALL user saved albums with full pagination (not capped at 50). */
export async function getAllUserAlbums(signal?: AbortSignal): Promise<AlbumInfo[]> {
  const token = await spotifyAuth.ensureValidToken();

  interface SavedAlbumItem {
    added_at: string;
    album: SpotifyAlbum;
  }

  const albums: AlbumInfo[] = [];
  let nextUrl: string | null = 'https://api.spotify.com/v1/me/albums?limit=50';

  while (nextUrl) {
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    const url = nextUrl;
    const data: PaginatedResponse<SavedAlbumItem> = await spotifyApiRequest(url, token, { signal });
    for (const item of data.items ?? []) {
      const album = item.album;
      albums.push({
        id: album.id ?? '',
        name: album.name ?? 'Unknown Album',
        artists: formatArtists(album.artists),
        images: album.images ?? [],
        release_date: album.release_date ?? '',
        total_tracks: album.total_tracks ?? 0,
        uri: album.uri ?? '',
        album_type: album.album_type,
        added_at: item.added_at,
      });
    }
    nextUrl = data.next;
  }

  return albums;
}
