/**
 * Spotify CatalogProvider adapter.
 * The underlying Spotify services already return neutral domain shapes
 * (conversion happens once at the wire boundary in `src/services/spotify/`),
 * so this adapter is a thin routing layer.
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
  searchTrack,
} from '@/services/spotify';

export class SpotifyCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId = 'spotify';

  async listCollections(signal?: AbortSignal): Promise<MediaCollection[]> {
    let playlists: MediaCollection[] = [];
    let albums: MediaCollection[] = [];

    await getUserLibraryInterleaved(
      (fetchedPlaylists, _isComplete) => {
        playlists = fetchedPlaylists;
      },
      (fetchedAlbums, _isComplete) => {
        albums = fetchedAlbums;
      },
      signal,
    );

    return [...playlists, ...albums];
  }

  async listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]> {
    if (collectionRef.provider !== 'spotify') return [];

    let tracks: MediaTrack[] = [];

    switch (collectionRef.kind) {
      case 'playlist':
        tracks = await getPlaylistTracks(collectionRef.id);
        break;
      case 'album':
        tracks = await getAlbumTracks(collectionRef.id);
        break;
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

  async searchTrack(artist: string, title: string): Promise<MediaTrack | null> {
    try {
      return await searchTrack(artist, title);
    } catch (err) {
      console.warn('[SpotifyCatalog] searchTrack failed:', err);
      return null;
    }
  }
}
