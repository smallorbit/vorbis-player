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

function pickAlbumArtPath(entries: DropboxFileEntry[]): string | null {
  if (entries.length === 0) return null;
  for (const preferred of ALBUM_ART_NAMES) {
    const found = entries.find((e) => baseName(e.name) === preferred || baseName(e.name).includes(preferred));
    if (found) return found.path_lower;
  }
  return entries[0].path_lower;
}

function parseFilename(filename: string): { name: string; trackNumber?: number } {
  const base = filename.replace(/\.[^/.]+$/, '');
  const match = base.match(/^(\d{1,3})\s*[-.\s]\s*(.+)$/);
  if (match) {
    return { name: match[2].trim(), trackNumber: parseInt(match[1], 10) };
  }
  return { name: base };
}

export class DropboxCatalogAdapter implements CatalogProvider {
  readonly providerId: ProviderId = 'dropbox';
  private auth: DropboxAuthAdapter;

  constructor(auth: DropboxAuthAdapter) {
    this.auth = auth;
  }

  private async dropboxApi<T>(
    endpoint: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    let token = await this.auth.ensureValidToken();
    if (!token) throw new Error('Not authenticated with Dropbox');

    let response = await fetch(`https://api.dropboxapi.com/2${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (response.status === 401) {
      token = await this.auth.refreshAccessToken();
      if (!token) throw new Error('Dropbox authentication expired');

      response = await fetch(`https://api.dropboxapi.com/2${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox API error: ${response.status} ${errorText}`);
    }

    return response.json();
  }

  /**
   * Recursively scans the app root to discover albums (folders containing audio files).
   * Each such folder becomes an album collection; its parent folder name is the artist.
   * Also returns a single "All Music" playlist with the total track count.
   */
  async listCollections(signal?: AbortSignal): Promise<MediaCollection[]> {
    try {
      let result = await this.dropboxApi<DropboxListFolderResult>(
        '/files/list_folder',
        { path: '', recursive: true },
        signal,
      );

      // path_lower → display name / parent path
      const dirDisplayName = new Map<string, string>();
      const dirParent = new Map<string, string>();
      // path_lower → audio file count
      const audioCount = new Map<string, number>();
      // path_lower → image file entries
      const imagesByDir = new Map<string, DropboxFileEntry[]>();

      const processBatch = (entries: DropboxFileEntry[]) => {
        for (const entry of entries) {
          if (entry['.tag'] === 'folder') {
            dirDisplayName.set(entry.path_lower, entry.name);
            const parent = entry.path_lower.split('/').slice(0, -1).join('/');
            dirParent.set(entry.path_lower, parent);
          } else if (entry['.tag'] === 'file') {
            const dir = entry.path_lower.split('/').slice(0, -1).join('/') || '/';
            if (isAudioFile(entry.name)) {
              audioCount.set(dir, (audioCount.get(dir) ?? 0) + 1);
            } else if (isImageFile(entry.name)) {
              const list = imagesByDir.get(dir) ?? [];
              list.push(entry);
              imagesByDir.set(dir, list);
            }
          }
        }
      };

      processBatch(result.entries);
      while (result.has_more) {
        if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
        result = await this.dropboxApi<DropboxListFolderResult>(
          '/files/list_folder/continue',
          { cursor: result.cursor },
          signal,
        );
        processBatch(result.entries);
      }

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

      return [allMusic, ...albums];
    } catch (error) {
      console.error('[DropboxCatalog] Failed to list collections:', error);
      return [];
    }
  }

  async listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]> {
    if (collectionRef.provider !== 'dropbox') return [];
    if (collectionRef.kind === 'liked') return [];

    const folderPath = collectionRef.id;

    try {
      let result = await this.dropboxApi<DropboxListFolderResult>(
        '/files/list_folder',
        { path: folderPath, recursive: true },
        signal,
      );

      const audioEntries: DropboxFileEntry[] = [];
      const imagesByDir = new Map<string, DropboxFileEntry[]>();

      const processBatch = (entries: DropboxFileEntry[]) => {
        for (const entry of entries) {
          if (entry['.tag'] !== 'file') continue;
          if (isAudioFile(entry.name)) {
            audioEntries.push(entry);
          } else if (isImageFile(entry.name)) {
            const dir = entry.path_lower.split('/').slice(0, -1).join('/') || '/';
            const list = imagesByDir.get(dir) ?? [];
            list.push(entry);
            imagesByDir.set(dir, list);
          }
        }
      };

      processBatch(result.entries);
      while (result.has_more) {
        if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
        result = await this.dropboxApi<DropboxListFolderResult>(
          '/files/list_folder/continue',
          { cursor: result.cursor },
          signal,
        );
        processBatch(result.entries);
      }

      const dirToImagePath = new Map<string, string>();
      for (const [dir, entries] of imagesByDir) {
        const path = pickAlbumArtPath(entries);
        if (path) dirToImagePath.set(dir, path);
      }

      const dirToImageUrl = new Map<string, string>();
      await Promise.all(
        Array.from(dirToImagePath.entries()).map(async ([dir, path]) => {
          try {
            const url = await this.getTemporaryLink(path);
            dirToImageUrl.set(dir, url);
          } catch {
            // Skip if temp link fails
          }
        }),
      );

      const tracks: MediaTrack[] = audioEntries.map((entry) => {
        const dir = entry.path_lower.split('/').slice(0, -1).join('/') || '/';
        const imageUrl = dirToImageUrl.get(dir) ?? undefined;
        return this.entryToMediaTrack(entry, imageUrl);
      });

      tracks.sort((a, b) => {
        const aPath = a.playbackRef.ref;
        const bPath = b.playbackRef.ref;
        return aPath.localeCompare(bPath);
      });

      return tracks;
    } catch (error) {
      console.error('[DropboxCatalog] Failed to list tracks:', error);
      return [];
    }
  }

  private entryToMediaTrack(entry: DropboxFileEntry, imageUrl?: string): MediaTrack {
    const { name, trackNumber } = parseFilename(entry.name);

    // Derive album and artist from the path hierarchy.
    // Expected: /<artist>/<album>/<track> or /<album>/<track>
    const displayParts = entry.path_display.split('/').filter(Boolean);
    const albumName = displayParts.length >= 2 ? displayParts[displayParts.length - 2] : 'Unknown Album';
    const artistName = displayParts.length >= 3 ? displayParts[displayParts.length - 3] : undefined;

    return {
      id: entry.id,
      provider: 'dropbox',
      playbackRef: { provider: 'dropbox', ref: entry.path_lower },
      name,
      artists: artistName ?? 'Unknown Artist',
      album: albumName,
      trackNumber,
      durationMs: 0,
      image: imageUrl,
    };
  }

  async getTemporaryLink(path: string): Promise<string> {
    const result = await this.dropboxApi<{ link: string }>(
      '/files/get_temporary_link',
      { path },
    );
    return result.link;
  }
}
