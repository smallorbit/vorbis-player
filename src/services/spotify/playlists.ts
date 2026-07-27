import type { CollectionRef, MediaCollection, MediaTrack } from '@/types/domain';
import { collectionRefToKey } from '@/types/domain';
import type { PlaylistInfo, SpotifyTrackItem, PaginatedResponse } from './types';
import { getLargestImage } from './types';
import { spotifyApiRequest, fetchAllPaginated } from './api';
import { spotifyAuth } from './auth';
import { trackListCache, albumSavedCache, TRACK_LIST_CACHE_TTL, TRACK_LIST_PERSIST_TTL } from './cache';
import { transformTrackItem } from './tracks';
import { type SavedAlbumItem, transformSavedAlbumItem } from './albums';
import * as libraryCache from '../cache/libraryCache';
import { logCaughtError } from '@/utils/logCaughtError';

// =============================================================================
// Callback Types
// =============================================================================

type CollectionsIncrementalCallback = (collectionsSoFar: MediaCollection[], isComplete: boolean) => void;

// =============================================================================
// Playlist Functions
// =============================================================================

/**
 * Convert a raw playlist object into the neutral `MediaCollection` shape.
 * This is the single Spotify→domain conversion point for playlists.
 */
function transformPlaylist(playlist: PlaylistInfo): MediaCollection {
  const imageUrl = getLargestImage(playlist.images);
  return {
    id: playlist.id,
    provider: 'spotify',
    kind: 'playlist',
    name: playlist.name,
    trackCount: playlist.tracks?.total ?? 0,
    // Spotify playlist API doesn't return genre information
    genres: [],
    ...(playlist.owner?.display_name && { ownerName: playlist.owner.display_name }),
    ...(playlist.description != null && playlist.description !== '' && { description: playlist.description }),
    ...(imageUrl !== undefined && { imageUrl }),
    ...(playlist.snapshot_id !== undefined && { revision: playlist.snapshot_id }),
  };
}

export async function getUserLibraryInterleaved(
  onPlaylistsUpdate: CollectionsIncrementalCallback,
  onAlbumsUpdate: CollectionsIncrementalCallback,
  signal?: AbortSignal
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();

  // Pagination state
  let playlistNextUrl: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';
  let albumNextUrl: string | null = 'https://api.spotify.com/v1/me/albums?limit=50';
  const playlistResults: MediaCollection[] = [];
  const albumResults: MediaCollection[] = [];

  // Interleave: fetch one page of each per round
  while (playlistNextUrl || albumNextUrl) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    // Fetch one page of each concurrently (max 2 requests at a time)
    const fetches: Promise<void>[] = [];

    if (playlistNextUrl) {
      const url = playlistNextUrl;
      fetches.push(
        spotifyApiRequest<PaginatedResponse<PlaylistInfo>>(url, token, signal ? { signal } : {})
          .then((data) => {
            for (const item of data.items ?? []) {
              playlistResults.push(transformPlaylist(item));
            }
            playlistNextUrl = data.next;
            const isComplete = playlistNextUrl === null;
            onPlaylistsUpdate([...playlistResults], isComplete);
          })
      );
    }

    if (albumNextUrl) {
      const url = albumNextUrl;
      fetches.push(
        spotifyApiRequest<PaginatedResponse<SavedAlbumItem>>(url, token, signal ? { signal } : {})
          .then((data) => {
            const now = Date.now();
            for (const item of data.items ?? []) {
              albumResults.push(transformSavedAlbumItem(item));
              if (item.album.id) {
                albumSavedCache.set(item.album.id, { value: true, timestamp: now });
              }
            }
            albumNextUrl = data.next;
            const isComplete = albumNextUrl === null;
            onAlbumsUpdate([...albumResults], isComplete);
          })
      );
    }

    // Wait for both pages of this round to complete before starting the next round.
    // This keeps the two streams in lockstep: neither can race ahead and starve the other.
    await Promise.all(fetches);
  }
}

export async function getPlaylistTracks(playlistId: string): Promise<MediaTrack[]> {
  const ref: CollectionRef = { provider: 'spotify', kind: 'playlist', id: playlistId };
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
    logCaughtError('spotify.playlists.getPlaylistTracks.idbRead', err);
  }

  // L3: Fetch from Spotify API
  const token = await spotifyAuth.ensureValidToken();

  interface PlaylistTrackItem {
    track: SpotifyTrackItem | null;
  }

  function transformPlaylistTrack(item: PlaylistTrackItem): MediaTrack | null {
    if (!item.track) {
      return null;
    }
    return transformTrackItem(item.track);
  }

  const tracks = await fetchAllPaginated<PlaylistTrackItem, MediaTrack>(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
    token,
    transformPlaylistTrack
  );

  // Write to both L1 and L2
  trackListCache.set(cacheKey, { data: tracks, timestamp: Date.now() });
  libraryCache.putTrackList(ref, tracks).catch(() => {});
  return tracks;
}

/** Get just the total count of user's playlists (1 API call, returns 1 item). */
export async function getPlaylistCount(signal?: AbortSignal): Promise<number> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<PaginatedResponse<unknown>>(
    'https://api.spotify.com/v1/me/playlists?limit=1&offset=0',
    token,
    signal ? { signal } : {},
  );
  return data.total ?? 0;
}

/** Fetch ALL user playlists with full pagination (not capped at 50). */
export async function getAllUserPlaylists(signal?: AbortSignal): Promise<MediaCollection[]> {
  const token = await spotifyAuth.ensureValidToken();

  return fetchAllPaginated<PlaylistInfo, MediaCollection>(
    'https://api.spotify.com/v1/me/playlists?limit=50',
    token,
    transformPlaylist,
    signal ? { signal } : {},
  );
}
