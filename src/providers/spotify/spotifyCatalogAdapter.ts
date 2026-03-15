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
  getLargestImage,
  type Track,
  type PlaylistInfo,
  type AlbumInfo,
} from '@/services/spotify';
import { ALBUM_ID_PREFIX, isAlbumId, extractAlbumId } from '@/constants/playlist';

/** Map a Spotify Track to a MediaTrack. */
function spotifyTrackToMediaTrack(track: Track): MediaTrack {
  return {
    id: track.id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: track.uri },
    name: track.name,
    artists: track.artists,
    artistsData: track.artistsData?.map((a) => ({
      name: a.name,
      url: a.url,
    })),
    album: track.album,
    albumId: track.album_id,
    trackNumber: track.track_number,
    durationMs: track.duration_ms,
    image: track.image,
    externalUrl: track.uri
      ? `https://open.spotify.com/track/${track.id}`
      : undefined,
    addedAt: track.added_at,
  };
}

/** Map a PlaylistInfo to a MediaCollection. */
function spotifyPlaylistToMediaCollection(pl: PlaylistInfo): MediaCollection {
  return {
    id: pl.id,
    provider: 'spotify',
    kind: 'playlist',
    name: pl.name,
    description: pl.description,
    imageUrl: getLargestImage(pl.images),
    trackCount: pl.tracks?.total ?? undefined,
    ownerName: pl.owner?.display_name ?? undefined,
    revision: pl.snapshot_id,
  };
}

/** Map an AlbumInfo to a MediaCollection. */
function spotifyAlbumToMediaCollection(album: AlbumInfo): MediaCollection {
  return {
    id: `${ALBUM_ID_PREFIX}${album.id}`,
    provider: 'spotify',
    kind: 'album',
    name: album.name,
    description: album.artists,
    imageUrl: getLargestImage(album.images),
    trackCount: album.total_tracks,
  };
}

export class SpotifyCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId = 'spotify';

  async listCollections(signal?: AbortSignal): Promise<MediaCollection[]> {
    const collections: MediaCollection[] = [];

    await getUserLibraryInterleaved(
      (fetchedPlaylists, _isComplete) => {
        for (const p of fetchedPlaylists) {
          collections.push(spotifyPlaylistToMediaCollection(p as PlaylistInfo));
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

    let tracks: Track[] = [];

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

    return tracks.map(spotifyTrackToMediaTrack);
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
}
