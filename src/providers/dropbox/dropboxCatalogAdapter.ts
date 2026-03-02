/**
 * Dropbox CatalogProvider adapter.
 * Scans Dropbox folders for audio files and maps them to domain types.
 */

import type { CatalogProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, MediaCollection, CollectionRef } from '@/types/domain';
import { DropboxAuthAdapter } from './dropboxAuthAdapter';

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.wma', '.opus'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
/**
 * Preferred names for album art: filename (without extension) equals or contains one of these.
 * Store one image file (e.g. cover.jpg or "Album Name - album cover.jpeg") in the same folder
 * as the tracks; the player will use it for all tracks in that folder.
 */
const ALBUM_ART_NAMES = ['cover', 'album', 'folder', 'front', 'album cover', 'album_cover', 'artwork'];
const MUSIC_ROOT = import.meta.env.VITE_DROPBOX_MUSIC_ROOT ?? '/Music';

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

/** Base name without extension, lowercased. */
function baseName(pathOrName: string): string {
  const name = pathOrName.split('/').pop() ?? pathOrName;
  return name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
}

/** Pick the best album-art path from a list of file entries (prefer standard names). */
function pickAlbumArtPath(entries: DropboxFileEntry[]): string | null {
  if (entries.length === 0) return null;
  for (const preferred of ALBUM_ART_NAMES) {
    const found = entries.find((e) => baseName(e.name) === preferred || baseName(e.name).includes(preferred));
    if (found) return found.path_lower;
  }
  return entries[0].path_lower;
}

/**
 * Parses a filename like "02 - Song Title.mp3" or "Song Title.mp3"
 * into a track name and optional track number.
 */
function parseFilename(filename: string): { name: string; trackNumber?: number } {
  // Remove extension
  const base = filename.replace(/\.[^/.]+$/, '');

  // Try to extract leading track number: "02 - Song" or "02. Song" or "02 Song"
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

    // If 401, try refreshing the token once
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

  async listCollections(signal?: AbortSignal): Promise<MediaCollection[]> {
    try {
      let result: DropboxListFolderResult;
      let listPath = MUSIC_ROOT;

      try {
        result = await this.dropboxApi<DropboxListFolderResult>(
          '/files/list_folder',
          { path: listPath, recursive: false },
          signal,
        );
      } catch (firstErr) {
        if (!this.isPathNotFound(firstErr)) throw firstErr;
        listPath = '';
        result = await this.dropboxApi<DropboxListFolderResult>(
          '/files/list_folder',
          { path: '', recursive: false },
          signal,
        );
      }

      const folders = result.entries
        .filter((e) => e['.tag'] === 'folder')
        .map((folder): MediaCollection => ({
          id: folder.path_lower,
          provider: 'dropbox',
          kind: 'folder',
          name: folder.name,
        }));

      const rootLabel = listPath ? 'All Music' : 'All (root)';
      const rootId = listPath ? listPath.toLowerCase() : '';
      folders.unshift({
        id: rootId,
        provider: 'dropbox',
        kind: 'folder',
        name: rootLabel,
      });

      return folders;
    } catch (error) {
      console.error('[DropboxCatalog] Failed to list collections:', error);
      return [];
    }
  }

  private isPathNotFound(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    if (!error.message.includes('409')) return false;
    try {
      const match = error.message.match(/\{[\s\S]*\}/);
      const body = match ? (JSON.parse(match[0]) as { error?: { '.tag'?: string; path?: { '.tag'?: string } } }) : null;
      return body?.error?.['.tag'] === 'path' && body?.error?.path?.['.tag'] === 'not_found';
    } catch {
      return error.message.includes('path/not_found') || error.message.includes('not_found');
    }
  }

  async listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]> {
    if (collectionRef.provider !== 'dropbox') return [];
    if (collectionRef.kind === 'liked') return []; // Dropbox has no liked collection

    const folderPath = collectionRef.id;

    try {
      let result = await this.dropboxApi<DropboxListFolderResult>(
        '/files/list_folder',
        { path: folderPath, recursive: true },
        signal,
      );

      const audioEntries: DropboxFileEntry[] = [];
      const imagesByDir = new Map<string, DropboxFileEntry[]>();

      function processBatch(entries: DropboxFileEntry[]) {
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
      }

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
            // Skip if temp link fails (e.g. unsupported format)
          }
        }),
      );

      const tracks: MediaTrack[] = audioEntries.map((entry) => {
        const dir = entry.path_lower.split('/').slice(0, -1).join('/') || '/';
        const imageUrl = dirToImageUrl.get(dir) ?? undefined;
        return this.entryToMediaTrack(entry, folderPath, imageUrl);
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

  private entryToMediaTrack(entry: DropboxFileEntry, folderPath: string, imageUrl?: string): MediaTrack {
    const { name, trackNumber } = parseFilename(entry.name);

    // Infer album from the immediate parent folder name
    const pathParts = entry.path_display.split('/');
    const albumFolder = pathParts.length > 2 ? pathParts[pathParts.length - 2] : 'Unknown Album';

    // Use the path-based folder as "artist" if deeper than root
    const relativePath = entry.path_lower.replace(folderPath, '');
    const relParts = relativePath.split('/').filter(Boolean);
    const artistFolder = relParts.length > 2 ? relParts[0] : undefined;

    return {
      id: entry.id,
      provider: 'dropbox',
      playbackRef: { provider: 'dropbox', ref: entry.path_lower },
      name,
      artists: artistFolder ?? 'Unknown Artist',
      album: albumFolder,
      trackNumber,
      durationMs: 0, // Will be determined during playback
      image: imageUrl,
    };
  }

  /**
   * Get a temporary link for streaming an audio file from Dropbox.
   * Links are valid for 4 hours.
   */
  async getTemporaryLink(path: string): Promise<string> {
    const result = await this.dropboxApi<{ link: string }>(
      '/files/get_temporary_link',
      { path },
    );
    return result.link;
  }
}
