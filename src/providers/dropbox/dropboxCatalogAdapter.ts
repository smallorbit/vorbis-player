/**
 * Dropbox CatalogProvider adapter.
 * Scans Dropbox folders for audio files and maps them to domain types.
 *
 * Expected folder layout (up to 2 levels of nesting):
 *   <app-root>/
 *     <Artist>/
 *       <Album>/
 *         cover.jpg
 *         01 - Track.mp3
 *         ...
 *
 * A folder that directly contains audio files is treated as an album.
 * Its parent folder (if not the root) is used as the artist name.
 */

import type { CatalogProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, MediaCollection, CollectionRef } from '@/types/domain';
import { DropboxAuthAdapter } from './dropboxAuthAdapter';
import {
  getDurationsMap,
  putDurationMs,
  getTagsMap,
  getTrackDatesMap,
} from './dropboxArtCache';
import { getCachedCatalog, putCatalogCache, clearCatalogCache } from './dropboxCatalogCache';
import { logLibrary } from '@/lib/debugLog';
import {
  getLikedTracks,
  getLikedCount as getLikedCountFromCache,
  isTrackLiked,
  setTrackLiked,
  clearLikes,
  exportLikes as exportLikesFromCache,
  importLikes as importLikesFromCache,
  refreshLikedTrackMetadata,
  clearTombstones,
} from './dropboxLikesCache';
import { getLikesSync } from './dropboxLikesSync';
import { listSavedPlaylists, loadPlaylistTracks, deleteSavedPlaylist } from './dropboxPlaylistStorage';
import type { DropboxFileEntry } from './dropboxCatalogHelpers';
import {
  isAudioFile,
  isImageFile,
  parentDir,
  entryToMediaTrack,
  hydrateCachedDurations,
  hydrateCachedArtwork,
  probeAudioDuration,
} from './dropboxCatalogHelpers';
import { DropboxApiClient } from './dropboxApiClient';
import { DropboxArtworkResolver } from './dropboxArtworkResolver';
import { scanAlbumDatesInBackground } from './dropboxDateScanner';

export class DropboxCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId = 'dropbox';
  private auth: DropboxAuthAdapter;
  private apiClient: DropboxApiClient;
  private artworkResolver: DropboxArtworkResolver;
  private knownTracks = new Map<string, MediaTrack>();

  constructor(auth: DropboxAuthAdapter) {
    this.auth = auth;
    this.apiClient = new DropboxApiClient(auth);
    this.artworkResolver = new DropboxArtworkResolver(this.apiClient);
  }

  async clearArtCache(): Promise<void> {
    await this.artworkResolver.clearArtCache();
  }

  async refreshArtCache(): Promise<void> {
    await Promise.all([this.artworkResolver.clearArtCache(), clearCatalogCache()]);
  }

  async getAlbumArtForAlbum(albumPath: string): Promise<string | null> {
    return this.artworkResolver.getAlbumArtForAlbum(albumPath);
  }

  async cacheAlbumArtForAlbum(albumPath: string, dataUrl: string): Promise<void> {
    await this.artworkResolver.cacheAlbumArtForAlbum(albumPath, dataUrl);
  }

  async listCollections(signal?: AbortSignal, options?: { forceRefresh?: boolean }): Promise<MediaCollection[]> {
    if (!options?.forceRefresh) {
      const cached = await getCachedCatalog();
      if (cached && !cached.isStale) {
        logLibrary('[dropbox] returning cached catalog (%d collections): %o',
          cached.collections.length,
          cached.collections.map(c => ({ name: c.name, kind: c.kind, trackCount: c.trackCount })));
        return cached.collections;
      }
    }

    try {
      const dirDisplayName = new Map<string, string>();
      const dirParent = new Map<string, string>();
      const audioCount = new Map<string, number>();
      const imagesByDir = new Map<string, DropboxFileEntry[]>();
      const firstAudioByDir = new Map<string, string>();

      await this.apiClient.paginateFolder('', (entries) => {
        for (const entry of entries) {
          if (entry['.tag'] === 'folder') {
            dirDisplayName.set(entry.path_lower, entry.name);
            dirParent.set(entry.path_lower, parentDir(entry.path_lower));
          } else if (entry['.tag'] === 'file') {
            const dir = parentDir(entry.path_lower);
            if (isAudioFile(entry.name)) {
              audioCount.set(dir, (audioCount.get(dir) ?? 0) + 1);
              if (!firstAudioByDir.has(dir)) {
                firstAudioByDir.set(dir, entry.path_lower);
              }
            } else if (isImageFile(entry.name)) {
              const list = imagesByDir.get(dir) ?? [];
              list.push(entry);
              imagesByDir.set(dir, list);
            }
          }
        }
      }, signal);

      const dirToImageUrl = await this.artworkResolver.resolveAlbumArtByDir(imagesByDir, audioCount.keys());

      let totalTracks = 0;
      const albums: MediaCollection[] = [];

      for (const [dirPath, count] of audioCount) {
        totalTracks += count;

        const name = dirDisplayName.get(dirPath) ?? (dirPath.split('/').pop() || 'Unknown Album');
        const parentPath = dirParent.get(dirPath) ?? '';
        const artistName = parentPath ? (dirDisplayName.get(parentPath) ?? undefined) : undefined;

        albums.push({
          id: dirPath,
          provider: 'dropbox',
          kind: 'album',
          name,
          trackCount: count,
          ownerName: artistName ?? null,
          imageUrl: dirToImageUrl.get(dirPath),
        });
      }

      const albumIds = albums.map((a) => a.id);
      const cachedDates = await getTrackDatesMap(albumIds);
      for (const album of albums) {
        const year = cachedDates.get(album.id);
        if (year) album.releaseDate = String(year);
      }

      albums.sort((a, b) => a.name.localeCompare(b.name));

      const allMusic: MediaCollection = {
        id: '',
        provider: 'dropbox',
        kind: 'folder',
        name: 'All Music',
        trackCount: totalTracks,
      };

      let savedPlaylists: MediaCollection[] = [];
      try {
        savedPlaylists = await listSavedPlaylists(this.auth);
      } catch {
        // Silently ignore -- saved playlists are optional
      }

      const collections = [allMusic, ...savedPlaylists, ...albums];
      logLibrary('[dropbox] fresh catalog (%d collections), savedPlaylists: %o',
        collections.length,
        savedPlaylists.map(c => ({ name: c.name, trackCount: c.trackCount })));
      await putCatalogCache(collections);

      scanAlbumDatesInBackground(this.apiClient, albums, firstAudioByDir).catch(() => {});

      return collections;
    } catch (error) {
      console.error('[DropboxCatalog] Failed to list collections:', error);
      throw error;
    }
  }

  async listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]> {
    if (collectionRef.provider !== 'dropbox') return [];
    if (collectionRef.kind === 'liked') {
      const tracks = await getLikedTracks();
      await Promise.all([
        hydrateCachedDurations(tracks),
        hydrateCachedArtwork(tracks),
      ]);
      return tracks;
    }

    if (collectionRef.kind === 'playlist') {
      const tracks = await loadPlaylistTracks(this.auth, collectionRef.id);
      await Promise.all([
        hydrateCachedDurations(tracks),
        hydrateCachedArtwork(tracks),
      ]);
      return tracks;
    }

    const folderPath = collectionRef.id;

    try {
      const audioEntries: DropboxFileEntry[] = [];
      const imagesByDir = new Map<string, DropboxFileEntry[]>();

      await this.apiClient.paginateFolder(folderPath, (entries) => {
        for (const entry of entries) {
          if (entry['.tag'] !== 'file') continue;
          if (isAudioFile(entry.name)) {
            audioEntries.push(entry);
          } else if (isImageFile(entry.name)) {
            const dir = parentDir(entry.path_lower);
            const list = imagesByDir.get(dir) ?? [];
            list.push(entry);
            imagesByDir.set(dir, list);
          }
        }
      }, signal);

      const albumDirs = audioEntries.map((entry) => parentDir(entry.path_lower));
      const dirToImageUrl = await this.artworkResolver.resolveAlbumArtByDir(imagesByDir, albumDirs);

      const tracks: MediaTrack[] = audioEntries.map((entry) => {
        const dir = parentDir(entry.path_lower);
        const imageUrl = dirToImageUrl.get(dir) ?? undefined;
        return entryToMediaTrack(entry, imageUrl);
      });

      tracks.sort((a, b) => {
        const aPath = a.playbackRef.ref;
        const bPath = b.playbackRef.ref;
        return aPath.localeCompare(bPath);
      });

      const trackIds = tracks.map((t) => t.id);

      const [, tagsMap] = await Promise.all([
        hydrateCachedDurations(tracks),
        getTagsMap(trackIds),
      ]);
      if (tagsMap.size > 0) {
        for (const t of tracks) {
          const cached = tagsMap.get(t.id);
          if (cached) {
            if (cached.name) t.name = cached.name;
            if (cached.artists) {
              t.artists = cached.artists;
              t.artistsData = [{ name: cached.artists }];
            }
            if (cached.album) t.album = cached.album;
          }
        }
      }

      for (const t of tracks) this.knownTracks.set(t.id, t);

      return tracks;
    } catch (error) {
      console.error('[DropboxCatalog] Failed to list tracks:', error);
      throw error;
    }
  }

  // -- Temporary links (delegated to apiClient) --

  async getTemporaryLink(path: string): Promise<string> {
    return this.apiClient.getTemporaryLink(path);
  }

  prefetchTemporaryLink(path: string): void {
    this.apiClient.prefetchTemporaryLink(path);
  }

  // -- Liked songs --

  async getLikedCount(): Promise<number> {
    return getLikedCountFromCache();
  }

  async isTrackSaved(trackId: string): Promise<boolean> {
    return isTrackLiked(trackId);
  }

  async setTrackSaved(trackId: string, saved: boolean): Promise<void> {
    const track = saved ? (this.knownTracks.get(trackId) ?? null) : null;
    await setTrackLiked(trackId, track, saved);
    getLikesSync()?.schedulePush();
  }

  async clearLikesCache(): Promise<void> {
    await clearLikes();
    await clearTombstones();
    getLikesSync()?.schedulePush();
  }

  async exportLikes(): Promise<string> {
    return exportLikesFromCache();
  }

  async importLikes(json: string): Promise<number> {
    const count = await importLikesFromCache(json);
    if (count > 0) {
      getLikesSync()?.schedulePush();
    }
    return count;
  }

  async initializeSync(): Promise<void> {
    await getLikesSync()?.initialSync();
  }

  async deleteCollection(collectionId: string, kind: 'playlist' | 'album' | 'folder' | 'liked'): Promise<void> {
    if (kind === 'playlist') {
      const success = await deleteSavedPlaylist(this.auth, collectionId);
      if (!success) throw new Error('Failed to delete playlist');
    }
  }

  async refreshLikedMetadata(): Promise<{ updated: number; removed: number }> {
    const allMusicRef: CollectionRef = { provider: 'dropbox', kind: 'folder', id: '' };
    const freshTracks = await this.listTracks(allMusicRef);
    return refreshLikedTrackMetadata(freshTracks);
  }

  // -- CatalogProvider optional interface methods --

  async resolveDuration(track: MediaTrack): Promise<number | null> {
    const cached = await getDurationsMap([track.id]);
    const cachedDuration = cached.get(track.id);
    if (cachedDuration) return cachedDuration;

    try {
      const url = await this.apiClient.getTemporaryLink(track.playbackRef.ref);
      const durationMs = await probeAudioDuration(url);
      if (durationMs) {
        putDurationMs(track.id, durationMs).catch(() => {});
      }
      return durationMs;
    } catch {
      return null;
    }
  }

  async resolveAlbumArt(albumDir: string, signal?: AbortSignal): Promise<string | null> {
    return this.artworkResolver.resolveAlbumArt(albumDir, signal);
  }

  async resolveArtwork(albumId: string, signal?: AbortSignal): Promise<string | null> {
    return this.artworkResolver.resolveAlbumArt(albumId, signal);
  }

  async searchTrack(_artist: string, _title: string): Promise<MediaTrack | null> {
    return null;
  }
}
