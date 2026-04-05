import type { ProviderId, MediaTrack } from '@/types/domain';
import type { ArtistInfo, Track, SpotifyArtist, SpotifyTrackItem } from './types';
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

// =============================================================================
// Shared Utilities
// =============================================================================

export function formatArtists(artists?: SpotifyArtist[]): string {
  if (!artists || artists.length === 0) {
    return 'Unknown Artist';
  }
  return artists.map(function (artist) {
    return artist.name;
  }).join(', ');
}

export function buildArtistsData(artists?: SpotifyArtist[]): ArtistInfo[] | undefined {
  if (!artists || artists.length === 0) return undefined;

  const data: ArtistInfo[] = [];
  for (const artist of artists) {
    const url = artist.external_urls?.spotify
      ?? (artist.id ? `https://open.spotify.com/artist/${artist.id}` : '');
    if (url) {
      data.push({ name: artist.name, url });
    }
  }
  return data.length > 0 ? data : undefined;
}

export function transformTrackItem(
  item: SpotifyTrackItem,
  albumOverride?: { name: string; id?: string; image?: string }
): Track | null {
  if (!item.id || item.type !== 'track') return null;

  const albumImage = albumOverride?.image ?? getLargestImage(item.album?.images);

  return {
    id: item.id,
    provider: 'spotify',
    name: item.name,
    artists: formatArtists(item.artists),
    artistsData: buildArtistsData(item.artists),
    album: albumOverride?.name ?? item.album?.name ?? 'Unknown Album',
    album_id: albumOverride?.id ?? item.album?.id,
    track_number: item.track_number,
    duration_ms: item.duration_ms ?? 0,
    uri: item.uri,
    preview_url: item.preview_url,
    image: albumImage,
  };
}

export function backfillProvider(tracks: Track[]): Track[] {
  for (const t of tracks) {
    if (!t.provider) t.provider = 'spotify';
  }
  return tracks;
}

/**
 * Convert Spotify Track objects to provider-neutral MediaTrack format.
 */
export function tracksToMediaTracks(tracks: Track[]): MediaTrack[] {
  return tracks.map((t: any) => ({
    id: t.id,
    provider: t.provider as ProviderId,
    playbackRef: { provider: 'spotify' as ProviderId, ref: t.uri },
    name: t.name,
    artists: t.artists,
    artistsData: t.artistsData,
    album: t.album,
    albumId: t.album_id,
    trackNumber: t.track_number,
    durationMs: t.duration_ms,
    image: t.image,
    externalUrl: t.preview_url,
    addedAt: t.added_at,
  }));
}

// =============================================================================
// Track Functions
// =============================================================================

export async function getLikedSongs(limit?: number): Promise<MediaTrack[]> {
  const likedSongsCache = getLikedSongsCache();
  if (likedSongsCache && Date.now() - likedSongsCache.timestamp < LIKED_SONGS_CACHE_TTL) {
    const data = tracksToMediaTracks(likedSongsCache.data);
    if (limit === undefined && likedSongsCache.limit === Infinity) {
      return data;
    }
    if (limit !== undefined && likedSongsCache.limit >= limit) {
      return data.slice(0, limit);
    }
  }

  if (limit === undefined) {
    try {
      const idbCached = await libraryCache.getTrackList('liked-songs');
      if (idbCached && Date.now() - idbCached.timestamp < TRACK_LIST_PERSIST_TTL) {
        setLikedSongsCache({ data: idbCached.tracks, limit: Infinity, timestamp: idbCached.timestamp });
        return tracksToMediaTracks(idbCached.tracks);
      }
    } catch { /* IndexedDB unavailable — fall through to API */ }
  }

  const token = await spotifyAuth.ensureValidToken();

  interface SavedTrackItem {
    added_at?: string;
    track: SpotifyTrackItem | null;
  }

  function transformSavedTrack(item: SavedTrackItem): Track | null {
    if (!item.track) {
      return null;
    }
    const track = transformTrackItem(item.track);
    if (!track) return null;
    if (item.added_at) {
      track.added_at = new Date(item.added_at).getTime();
    }
    return track;
  }

  const tracks = await fetchAllPaginated<SavedTrackItem, Track>(
    'https://api.spotify.com/v1/me/tracks?limit=50',
    token,
    transformSavedTrack,
    limit !== undefined ? { maxItems: limit } : undefined
  );

  setLikedSongsCache({ data: tracks, limit: limit ?? Infinity, timestamp: Date.now() });
  if (limit === undefined) {
    libraryCache.putTrackList('liked-songs', tracks).catch(() => {});
  }
  return tracksToMediaTracks(tracks);
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
    { signal }
  );

  const count = data.total ?? 0;
  setLikedSongsCountCache({ count, timestamp: Date.now() });
  return count;
}

export async function checkTrackSaved(trackId: string): Promise<boolean> {
  const cached = trackSavedCache.get(trackId);
  if (cached && Date.now() - cached.timestamp < TRACK_SAVED_CACHE_TTL) {
    return cached.value;
  }

  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<boolean[]>(
    `https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`,
    token
  );
  const result = data[0] ?? false;
  trackSavedCache.set(trackId, { value: result, timestamp: Date.now() });
  return result;
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
