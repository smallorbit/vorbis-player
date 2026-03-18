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
  getArt,
  putArt,
  clearArt,
  getDurationsMap,
  getTagsMap,
  getAlbumArt,
  putAlbumArt,
} from './dropboxArtCache';
import { getCachedCatalog, putCatalogCache } from './dropboxCatalogCache';
import { bytesToDataUrl } from '@/utils/bytesToDataUrl';
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
import { listSavedPlaylists, loadPlaylistTracks } from './dropboxPlaylistStorage';
import { isSavedPlaylistId, extractPlaylistPath } from '@/constants/playlist';

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.wma', '.opus'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALBUM_ART_NAMES = ['cover', 'album', 'folder', 'front', 'album cover', 'album_cover', 'artwork'];

interface DropboxFileEntry {
  '.tag': 'file' | 'folder';
  name: string;
  id: string;
  path_lower: string;
  path_display: string;
  size?: number;
}

interface DropboxListFolderResult {
  entries: DropboxFileEntry[];
  cursor: string;
  has_more: boolean;
}

function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function baseName(name: string): string {
  return name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
}

function findArtByNames(entries: DropboxFileEntry[], names: string[]): string | null {
  for (const preferred of names) {
    const found = entries.find((e) => baseName(e.name) === preferred || baseName(e.name).includes(preferred));
    if (found) return found.path_lower;
  }
  return null;
}

function pickAlbumArtPath(entries: DropboxFileEntry[]): string | null {
  if (entries.length === 0) return null;
  return findArtByNames(entries, ALBUM_ART_NAMES) ?? entries[0].path_lower;
}

function parentDir(path: string): string {
  return path.split('/').slice(0, -1).join('/') || '/';
}

function parseFilename(filename: string): { name: string; trackNumber?: number } {
  const base = filename.replace(/\.[^/.]+$/, '');
  const match = base.match(/^(\d{1,3})\s*[-.\s]\s*(.+)$/);
  if (match) {
    return { name: match[2].trim(), trackNumber: parseInt(match[1], 10) };
  }
  return { name: base };
}

/** Cached temporary link with expiry timestamp. */
interface CachedLink {
  url: string;
  expiresAt: number;
}

/** Dropbox temporary links are valid for 4 hours; cache for 3.5 h to be safe. */
const TEMP_LINK_TTL_MS = 3.5 * 60 * 60 * 1000;

export class DropboxCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId = 'dropbox';
  private auth: DropboxAuthAdapter;
  // Deduplicates concurrent fetch requests for the same image path
  private pendingArtFetches = new Map<string, Promise<string | null>>();
  // Tracks seen during listTracks calls, used to provide full MediaTrack data when liking
  private knownTracks = new Map<string, MediaTrack>();
  /** In-memory cache of Dropbox temporary links keyed by path. */
  private tempLinkCache = new Map<string, CachedLink>();

  constructor(auth: DropboxAuthAdapter) {
    this.auth = auth;
  }

  /**
   * Fetches an image from Dropbox and caches it as a data URL in IndexedDB.
   * Subsequent calls for the same path return the cached value instantly.
   * Concurrent calls for the same path are deduplicated.
   */
  private fetchArtDataUrl(path: string): Promise<string | null> {
    const pending = this.pendingArtFetches.get(path);
    if (pending) return pending;

    const promise = this.doFetchArtDataUrl(path).finally(() => {
      this.pendingArtFetches.delete(path);
    });
    this.pendingArtFetches.set(path, promise);
    return promise;
  }

  private async doFetchArtDataUrl(path: string): Promise<string | null> {
    const cached = await getArt(path);
    if (cached) return cached;

    try {
      const tempUrl = await this.getTemporaryLink(path);
      const resp = await fetch(tempUrl);
      if (!resp.ok) return null;

      const mimeType = resp.headers.get('Content-Type') ?? 'image/jpeg';
      const buffer = await resp.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const dataUrl = bytesToDataUrl(bytes, mimeType);

      await putArt(path, dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }

  /** Clears all cached album art, forcing a fresh download on next library load. */
  async clearArtCache(): Promise<void> {
    await clearArt();
  }

  async getAlbumArtForAlbum(albumPath: string): Promise<string | null> {
    return getAlbumArt(albumPath);
  }

  async cacheAlbumArtForAlbum(albumPath: string, dataUrl: string): Promise<void> {
    await putAlbumArt(albumPath, dataUrl);
  }

  /**
   * Resolve artwork once per album directory, with fallback to album-level cached art.
   * This keeps track/collection artwork consistent and avoids redundant network fetches.
   */
  private async resolveAlbumArtByDir(
    imagesByDir: Map<string, DropboxFileEntry[]>,
    albumDirs: Iterable<string>,
  ): Promise<Map<string, string>> {
    const dirToImageUrl = new Map<string, string>();
    const uniqueDirs = Array.from(new Set(albumDirs));

    await Promise.all(
      uniqueDirs.map(async (dir) => {
        const entries = imagesByDir.get(dir) ?? [];
        const imagePath = pickAlbumArtPath(entries);
        if (imagePath) {
          const imageUrl = await this.fetchArtDataUrl(imagePath);
          if (imageUrl) {
            dirToImageUrl.set(dir, imageUrl);
            // Keep an album-keyed alias so tracks from this album can hydrate instantly.
            await putAlbumArt(dir, imageUrl);
            return;
          }
        }

        const cachedAlbumArt = await getAlbumArt(dir);
        if (cachedAlbumArt) {
          dirToImageUrl.set(dir, cachedAlbumArt);
        }
      }),
    );

    return dirToImageUrl;
  }

  private async dropboxApi<T>(
    endpoint: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    let token = await this.auth.ensureValidToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    const makeRequest = (accessToken: string) =>
      fetch(`https://api.dropboxapi.com/2${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });

    let response = await makeRequest(token);

    if (response.status === 401) {
      token = await this.auth.refreshAccessToken();
      if (!token) throw new Error('Dropbox authentication expired');
      response = await makeRequest(token);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  private async paginateFolder(
    path: string,
    callback: (entries: DropboxFileEntry[]) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    let result = await this.dropboxApi<DropboxListFolderResult>(
      '/files/list_folder',
      { path, recursive: true },
      signal,
    );
    callback(result.entries);
    while (result.has_more) {
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
      result = await this.dropboxApi<DropboxListFolderResult>(
        '/files/list_folder/continue',
        { cursor: result.cursor },
        signal,
      );
      callback(result.entries);
    }
  }

  /**
   * Recursively scans the app root to discover albums (folders containing audio files).
   * Each such folder becomes an album collection; its parent folder name is the artist.
   * Also returns a single "All Music" playlist with the total track count.
   *
   * Results are cached in IndexedDB for 1 hour. Pass `{ forceRefresh: true }` to bypass the cache.
   */
  async listCollections(signal?: AbortSignal, options?: { forceRefresh?: boolean }): Promise<MediaCollection[]> {
    if (!options?.forceRefresh) {
      const cached = await getCachedCatalog();
      if (cached && !cached.isStale) {
        return cached.collections;
      }
    }

    try {
      // path_lower → display name / parent path
      const dirDisplayName = new Map<string, string>();
      const dirParent = new Map<string, string>();
      // path_lower → audio file count
      const audioCount = new Map<string, number>();
      // path_lower → image file entries
      const imagesByDir = new Map<string, DropboxFileEntry[]>();

      await this.paginateFolder('', (entries) => {
        for (const entry of entries) {
          if (entry['.tag'] === 'folder') {
            dirDisplayName.set(entry.path_lower, entry.name);
            dirParent.set(entry.path_lower, parentDir(entry.path_lower));
          } else if (entry['.tag'] === 'file') {
            const dir = parentDir(entry.path_lower);
            if (isAudioFile(entry.name)) {
              audioCount.set(dir, (audioCount.get(dir) ?? 0) + 1);
            } else if (isImageFile(entry.name)) {
              const list = imagesByDir.get(dir) ?? [];
              list.push(entry);
              imagesByDir.set(dir, list);
            }
          }
        }
      }, signal);

      const dirToImageUrl = await this.resolveAlbumArtByDir(imagesByDir, audioCount.keys());

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

      albums.sort((a, b) => a.name.localeCompare(b.name));

      const allMusic: MediaCollection = {
        id: '',
        provider: 'dropbox',
        kind: 'folder',
        name: 'All Music',
        trackCount: totalTracks,
      };

      // Fetch saved playlists from /.vorbis/playlists/ (non-blocking; empty on failure)
      let savedPlaylists: MediaCollection[] = [];
      try {
        savedPlaylists = await listSavedPlaylists(this.auth);
      } catch {
        // Silently ignore — saved playlists are optional
      }

      const collections = [allMusic, ...savedPlaylists, ...albums];
      putCatalogCache(collections);
      return collections;
    } catch (error) {
      console.error('[DropboxCatalog] Failed to list collections:', error);
      throw error;
    }
  }

  async listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]> {
    if (collectionRef.provider !== 'dropbox') return [];
    if (collectionRef.kind === 'liked') return getLikedTracks();

    // Saved playlists: load from JSON file in Dropbox
    if (collectionRef.kind === 'playlist') {
      const playlistPath = isSavedPlaylistId(collectionRef.id)
        ? extractPlaylistPath(collectionRef.id)
        : collectionRef.id;
      return loadPlaylistTracks(this.auth, playlistPath);
    }

    const folderPath = collectionRef.id;

    try {
      const audioEntries: DropboxFileEntry[] = [];
      const imagesByDir = new Map<string, DropboxFileEntry[]>();

      await this.paginateFolder(folderPath, (entries) => {
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
      const dirToImageUrl = await this.resolveAlbumArtByDir(imagesByDir, albumDirs);

      const tracks: MediaTrack[] = audioEntries.map((entry) => {
        const dir = parentDir(entry.path_lower);
        const imageUrl = dirToImageUrl.get(dir) ?? undefined;
        return this.entryToMediaTrack(entry, imageUrl);
      });

      tracks.sort((a, b) => {
        const aPath = a.playbackRef.ref;
        const bPath = b.playbackRef.ref;
        return aPath.localeCompare(bPath);
      });

      const trackIds = tracks.map((t) => t.id);

      // Hydrate any previously-discovered durations from IndexedDB cache.
      const durationsMap = await getDurationsMap(trackIds);
      if (durationsMap.size > 0) {
        for (const t of tracks) {
          const cached = durationsMap.get(t.id);
          if (cached !== undefined) t.durationMs = cached;
        }
      }

      // Hydrate ID3 tag metadata from IndexedDB cache (populated on first playback).
      const tagsMap = await getTagsMap(trackIds);
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

  private entryToMediaTrack(entry: DropboxFileEntry, imageUrl?: string): MediaTrack {
    const { name, trackNumber } = parseFilename(entry.name);

    // Derive album and artist from the path hierarchy.
    // Expected: /<artist>/<album>/<track> or /<album>/<track>
    const displayParts = entry.path_display.split('/').filter(Boolean);
    const albumName = displayParts.length >= 2 ? displayParts[displayParts.length - 2] : 'Unknown Album';
    const artistName = displayParts.length >= 3 ? displayParts[displayParts.length - 3] : undefined;

    // Album ID is the parent directory path — stable per-album identifier used for color overrides.
    const albumId = parentDir(entry.path_lower);

    const artist = artistName ?? 'Unknown Artist';
    return {
      id: entry.id,
      provider: 'dropbox',
      playbackRef: { provider: 'dropbox', ref: entry.path_lower },
      name,
      artists: artist,
      artistsData: [{ name: artist }],
      album: albumName,
      albumId,
      trackNumber,
      durationMs: 0,
      image: imageUrl,
    };
  }

  /**
   * Resolve album art for a single album directory.
   * Checks IndexedDB cache first, then scans the Dropbox directory for image files.
   * Returns a data URL or null.
   */
  async resolveAlbumArt(albumDir: string, signal?: AbortSignal): Promise<string | null> {
    if (!albumDir) return null;

    // Check cache first
    const cached = await getAlbumArt(albumDir);
    if (cached) return cached;

    // Scan the directory for image files
    try {
      const result = await this.dropboxApi<{ entries: DropboxFileEntry[] }>(
        '/files/list_folder',
        { path: albumDir, recursive: false },
        signal,
      );

      const images = result.entries.filter(
        (e) => e['.tag'] === 'file' && isImageFile(e.name),
      );
      const imagePath = pickAlbumArtPath(images);
      if (!imagePath) return null;

      const imageUrl = await this.fetchArtDataUrl(imagePath);
      if (imageUrl) {
        await putAlbumArt(albumDir, imageUrl);
      }
      return imageUrl;
    } catch {
      return null;
    }
  }

  async getTemporaryLink(path: string): Promise<string> {
    const cached = this.tempLinkCache.get(path);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.url;
    }

    const result = await this.dropboxApi<{ link: string }>(
      '/files/get_temporary_link',
      { path },
    );

    this.tempLinkCache.set(path, {
      url: result.link,
      expiresAt: Date.now() + TEMP_LINK_TTL_MS,
    });
    return result.link;
  }

  /**
   * Pre-warm the temporary link cache for a path.
   * Returns immediately if already cached; otherwise fetches in the background.
   */
  prefetchTemporaryLink(path: string): void {
    const cached = this.tempLinkCache.get(path);
    if (cached && Date.now() < cached.expiresAt) return;
    // Fire-and-forget; errors are silently ignored
    this.getTemporaryLink(path).catch(() => {});
  }

  // ── Liked songs ──────────────────────────────────────────────────────

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

  async refreshLikedMetadata(): Promise<{ updated: number; removed: number }> {
    // Scan all Dropbox tracks to get fresh metadata
    const allMusicRef: CollectionRef = { provider: 'dropbox', kind: 'folder', id: '' };
    const freshTracks = await this.listTracks(allMusicRef);
    return refreshLikedTrackMetadata(freshTracks);
  }
}
