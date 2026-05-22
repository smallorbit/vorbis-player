/**
 * Spotify CatalogProvider adapter.
 * Wraps existing Spotify API functions and maps results to domain types.
 */

import type { CatalogProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, MediaCollection, CollectionRef } from '@/types/domain';
import {
  getUserLibraryInterleaved,
  getPlaylistTracks,
  getAlbumTracks,
  getLikedSongs,
  getLikedSongsCount,
  checkTrackSaved,
  saveTrack,
  unsaveTrack,
  checkAlbumSaved,
  saveAlbum,
  unsaveAlbum,
  unfollowPlaylist,
  getLargestImage,
  searchTrack,
  type Track,
  type PlaylistInfo,
  type AlbumInfo,
} from '@/services/spotify';
import { ALBUM_ID_PREFIX, isAlbumId, extractAlbumId } from '@/constants/playlist';

/** Map a Spotify Track to a MediaTrack. */
function spotifyTrackToMediaTrack(track: Track): MediaTrack {
  const artistsData = track.artistsData?.map((a) =>
    a.url !== undefined ? { name: a.name, url: a.url } : { name: a.name },
  );
  return {
    id: track.id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: track.uri },
    name: track.name,
    artists: track.artists,
    album: track.album,
    durationMs: track.duration_ms,
    genres: track.genres ?? [],
    ...(artistsData !== undefined && { artistsData }),
    ...(track.album_id !== undefined && { albumId: track.album_id }),
    ...(track.track_number !== undefined && { trackNumber: track.track_number }),
    ...(track.image !== undefined && { image: track.image }),
    ...(track.uri ? { externalUrl: `https://open.spotify.com/track/${track.id}` } : {}),
    ...(track.added_at !== undefined && { addedAt: track.added_at }),
  };
}

/** Map a PlaylistInfo to a MediaCollection. */
function spotifyPlaylistToMediaCollection(pl: PlaylistInfo): MediaCollection {
  const imageUrl = getLargestImage(pl.images);
  return {
    id: pl.id,
    provider: 'spotify',
    kind: 'playlist',
    name: pl.name,
    // Spotify playlist API doesn't return genre information
    genres: [],
    ...(pl.description != null && { description: pl.description }),
    ...(imageUrl !== undefined && { imageUrl }),
    ...(pl.tracks?.total !== undefined && { trackCount: pl.tracks.total }),
    ...(pl.owner?.display_name !== undefined && { ownerName: pl.owner.display_name }),
    ...(pl.snapshot_id !== undefined && { revision: pl.snapshot_id }),
  };
}

/** Map an AlbumInfo to a MediaCollection. */
function spotifyAlbumToMediaCollection(album: AlbumInfo): MediaCollection {
  const imageUrl = getLargestImage(album.images);
  return {
    id: `${ALBUM_ID_PREFIX}${album.id}`,
    provider: 'spotify',
    kind: 'album',
    name: album.name,
    description: album.artists,
    trackCount: album.total_tracks,
    // Genres come from the Spotify album object (may be empty for simplified library responses)
    genres: album.genres ?? [],
    ...(imageUrl !== undefined && { imageUrl }),
  };
}

export class SpotifyCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId = 'spotify';

  async listCollections(signal?: AbortSignal): Promise<MediaCollection[]> {
    const collections: MediaCollection[] = [];

    await getUserLibraryInterleaved(
      (fetchedPlaylists, _isComplete) => {
        for (const p of fetchedPlaylists) {
          collections.push(spotifyPlaylistToMediaCollection(p));
        }
      },
      (fetchedAlbums, _isComplete) => {
        for (const a of fetchedAlbums) {
          collections.push(spotifyAlbumToMediaCollection(a));
        }
      },
      signal,
    );

    return collections;
  }

  async listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]> {
    if (collectionRef.provider !== 'spotify') return [];

    let tracks: MediaTrack[] = [];

    switch (collectionRef.kind) {
      case 'playlist':
        tracks = await getPlaylistTracks(collectionRef.id);
        break;
      case 'album': {
        const albumId = isAlbumId(collectionRef.id)
          ? extractAlbumId(collectionRef.id)
          : collectionRef.id;
        tracks = await getAlbumTracks(albumId);
        break;
      }
      case 'liked':
        tracks = await getLikedSongs();
        break;
      default:
        return [];
    }

    // Check signal after async call
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');

    return tracks;
  }

  async getLikedCount(signal?: AbortSignal): Promise<number> {
    return getLikedSongsCount(signal);
  }

  async setTrackSaved(trackId: string, saved: boolean): Promise<void> {
    if (saved) {
      await saveTrack(trackId);
    } else {
      await unsaveTrack(trackId);
    }
  }

  async isTrackSaved(trackId: string): Promise<boolean> {
    return checkTrackSaved(trackId);
  }

  async setAlbumSaved(albumId: string, saved: boolean): Promise<void> {
    if (saved) {
      await saveAlbum(albumId);
    } else {
      await unsaveAlbum(albumId);
    }
  }

  async isAlbumSaved(albumId: string): Promise<boolean> {
    return checkAlbumSaved(albumId);
  }

  async deleteCollection(collectionId: string, kind: 'playlist' | 'album' | 'folder' | 'liked'): Promise<void> {
    if (kind === 'playlist') {
      await unfollowPlaylist(collectionId);
    } else if (kind === 'album') {
      await unsaveAlbum(collectionId);
    }
  }

  async searchTrack(artist: string, title: string): Promise<MediaTrack | null> {
    try {
      const track = await searchTrack(artist, title);
      if (!track) return null;
      return spotifyTrackToMediaTrack(track);
    } catch (err) {
      console.warn('[SpotifyCatalog] searchTrack failed:', err);
      return null;
    }
  }
}
