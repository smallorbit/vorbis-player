import type { MediaTrack } from '@/types/domain';
import type { Track, PlaylistInfo, AlbumInfo, SpotifyTrackItem, PaginatedResponse } from './types';
import { spotifyApiRequest, fetchAllPaginated } from './api';
import { spotifyAuth } from './auth';
import { trackListCache, albumSavedCache, TRACK_LIST_CACHE_TTL, TRACK_LIST_PERSIST_TTL } from './cache';
import { transformTrackItem, backfillProvider, tracksToMediaTracks } from './tracks';
import { type SavedAlbumItem, transformSavedAlbumItem } from './albums';
import * as libraryCache from '../cache/libraryCache';

// =============================================================================
// Callback Types
// =============================================================================

type PlaylistsIncrementalCallback = (playlistsSoFar: PlaylistInfo[], isComplete: boolean) => void;
type AlbumsIncrementalCallback = (albumsSoFar: AlbumInfo[], isComplete: boolean) => void;

// =============================================================================
// Playlist Functions
// =============================================================================

export async function getUserLibraryInterleaved(
  onPlaylistsUpdate: PlaylistsIncrementalCallback,
  onAlbumsUpdate: AlbumsIncrementalCallback,
  signal?: AbortSignal
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();

  const fetchTimestamp = new Date().toISOString();

  function transformPlaylist(playlist: PlaylistInfo): PlaylistInfo {
    return {
      ...playlist,
      added_at: playlist.added_at || fetchTimestamp,
      tracks: playlist.tracks ?? { total: 0 },
      owner: playlist.owner ?? { display_name: '' },
    };
  }

  // Pagination state
  let playlistNextUrl: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';
  let albumNextUrl: string | null = 'https://api.spotify.com/v1/me/albums?limit=50';
  const playlistResults: PlaylistInfo[] = [];
  const albumResults: AlbumInfo[] = [];

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
        spotifyApiRequest<PaginatedResponse<PlaylistInfo>>(url, token, { signal })
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
        spotifyApiRequest<PaginatedResponse<SavedAlbumItem>>(url, token, { signal })
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
  const cacheKey = `playlist:${playlistId}`;

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

  interface PlaylistTrackItem {
    track: SpotifyTrackItem | null;
  }

  function transformPlaylistTrack(item: PlaylistTrackItem): Track | null {
    if (!item.track) {
      return null;
    }
    return transformTrackItem(item.track);
  }

  const tracks = await fetchAllPaginated<PlaylistTrackItem, Track>(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
    token,
    transformPlaylistTrack
  );

  // Write to both L1 and L2
  trackListCache.set(cacheKey, { data: tracks, timestamp: Date.now() });
  libraryCache.putTrackList(cacheKey, tracks).catch(() => {});
  return tracksToMediaTracks(tracks);
}

/** Get just the total count of user's playlists (1 API call, returns 1 item). */
export async function getPlaylistCount(signal?: AbortSignal): Promise<number> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<PaginatedResponse<unknown>>(
    'https://api.spotify.com/v1/me/playlists?limit=1&offset=0',
    token,
    { signal }
  );
  return data.total ?? 0;
}

/** Fetch first page of playlists with snapshot_ids for change comparison. */
export async function getPlaylistsPage(
  limit: number = 50,
  signal?: AbortSignal
): Promise<{ playlists: PlaylistInfo[]; total: number; hasMore: boolean }> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<PaginatedResponse<PlaylistInfo>>(
    `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=0`,
    token,
    { signal }
  );
  const playlists = (data.items ?? []).map((p, i) => ({
    ...p,
    added_at: p.added_at || new Date(Date.now() - i * 60000).toISOString(),
  }));
  return {
    playlists,
    total: data.total ?? 0,
    hasMore: data.next !== null,
  };
}

/** Fetch ALL user playlists with full pagination (not capped at 50). */
export async function getAllUserPlaylists(signal?: AbortSignal): Promise<PlaylistInfo[]> {
  const token = await spotifyAuth.ensureValidToken();
  let index = 0;

  return fetchAllPaginated<PlaylistInfo, PlaylistInfo>(
    'https://api.spotify.com/v1/me/playlists?limit=50',
    token,
    (item) => ({
      ...item,
      added_at: item.added_at || new Date(Date.now() - index++ * 60000).toISOString(),
    }),
    { signal },
  );
}
