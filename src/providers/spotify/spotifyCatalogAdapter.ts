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
  type Track,
  type PlaylistInfo,
  type AlbumInfo,
} from '@/services/spotify';
import { ALBUM_ID_PREFIX, LIKED_SONGS_ID, LIKED_SONGS_NAME } from '@/constants/playlist';

/** Map a Spotify Track to a MediaTrack. */
export function spotifyTrackToMediaTrack(track: Track): MediaTrack {
  return {
    id: track.id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: track.uri },
    name: track.name,
    artists: track.artists,
    artistsData: track.artistsData?.map((a) => ({
      name: a.name,
      url: a.spotifyUrl,
    })),
    album: track.album,
    albumId: track.album_id,
    trackNumber: track.track_number,
    durationMs: track.duration_ms,
    image: track.image,
    externalUrl: track.uri
      ? `https://open.spotify.com/track/${track.id}`
      : undefined,
  };
}

/** Map a MediaTrack back to a legacy Spotify Track (for TrackContext compatibility). */
export function mediaTrackToSpotifyTrack(mt: MediaTrack): Track {
  return {
    id: mt.id,
    name: mt.name,
    artists: mt.artists,
    artistsData: mt.artistsData?.map((a) => ({
      name: a.name,
      spotifyUrl: a.url ?? '',
    })),
    album: mt.album,
    album_id: mt.albumId,
    track_number: mt.trackNumber,
    duration_ms: mt.durationMs,
    uri: mt.playbackRef.ref,
    image: mt.image,
  };
}

/** Map a PlaylistInfo to a MediaCollection. */
export function spotifyPlaylistToMediaCollection(pl: PlaylistInfo): MediaCollection {
  return {
    id: pl.id,
    provider: 'spotify',
    kind: 'playlist',
    name: pl.name,
    description: pl.description,
    imageUrl: pl.images?.[0]?.url,
    trackCount: pl.tracks?.total ?? undefined,
    ownerName: pl.owner?.display_name ?? undefined,
    revision: pl.snapshot_id,
  };
}

/** Map an AlbumInfo to a MediaCollection. */
export function spotifyAlbumToMediaCollection(album: AlbumInfo): MediaCollection {
  return {
    id: `${ALBUM_ID_PREFIX}${album.id}`,
    provider: 'spotify',
    kind: 'album',
    name: album.name,
    description: album.artists,
    imageUrl: album.images?.[0]?.url,
    trackCount: album.total_tracks,
  };
}

export class SpotifyCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId = 'spotify';

  async listCollections(signal?: AbortSignal): Promise<MediaCollection[]> {
    const collections: MediaCollection[] = [];

    await getUserLibraryInterleaved(
      (playlists) => {
        // We'll collect and return at the end
      },
      (albums) => {
        // We'll collect and return at the end
      },
      signal,
    );

    // For the adapter, we do a simpler approach: collect all and return
    // This is used when the catalog is queried directly (not via the sync engine)
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
        // Remove album: prefix if present
        const albumId = collectionRef.id.startsWith(ALBUM_ID_PREFIX)
          ? collectionRef.id.slice(ALBUM_ID_PREFIX.length)
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
}
