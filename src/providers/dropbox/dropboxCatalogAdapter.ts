/**
 * Dropbox CatalogProvider adapter.
 * Scans Dropbox folders for audio files and maps them to domain types.
 */

import type { CatalogProvider } from '@/types/providers';
import type { ProviderId, MediaTrack, MediaCollection, CollectionRef } from '@/types/domain';
import { DropboxAuthAdapter } from './dropboxAuthAdapter';

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.wav', '.aac', '.wma', '.opus'];
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
    // List top-level folders inside the music root as "collections"
    try {
      const result = await this.dropboxApi<DropboxListFolderResult>(
        '/files/list_folder',
        { path: MUSIC_ROOT, recursive: false },
        signal,
      );

      const folders = result.entries
        .filter((e) => e['.tag'] === 'folder')
        .map((folder): MediaCollection => ({
          id: folder.path_lower,
          provider: 'dropbox',
          kind: 'folder',
          name: folder.name,
        }));

      // Also add the root music folder itself as a collection
      folders.unshift({
        id: MUSIC_ROOT.toLowerCase(),
        provider: 'dropbox',
        kind: 'folder',
        name: 'All Music',
      });

      return folders;
    } catch (error) {
      console.error('[DropboxCatalog] Failed to list collections:', error);
      return [];
    }
  }

  async listTracks(collectionRef: CollectionRef, signal?: AbortSignal): Promise<MediaTrack[]> {
    if (collectionRef.provider !== 'dropbox') return [];
    if (collectionRef.kind === 'liked') return []; // Dropbox has no liked collection

    const folderPath = collectionRef.id;
    const tracks: MediaTrack[] = [];

    try {
      let result = await this.dropboxApi<DropboxListFolderResult>(
        '/files/list_folder',
        { path: folderPath, recursive: true },
        signal,
      );

      for (const entry of result.entries) {
        if (entry['.tag'] === 'file' && isAudioFile(entry.name)) {
          tracks.push(this.entryToMediaTrack(entry, folderPath));
        }
      }

      // Paginate
      while (result.has_more) {
        if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError');

        result = await this.dropboxApi<DropboxListFolderResult>(
          '/files/list_folder/continue',
          { cursor: result.cursor },
          signal,
        );

        for (const entry of result.entries) {
          if (entry['.tag'] === 'file' && isAudioFile(entry.name)) {
            tracks.push(this.entryToMediaTrack(entry, folderPath));
          }
        }
      }

      // Sort by path (preserves album/track ordering)
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

  private entryToMediaTrack(entry: DropboxFileEntry, folderPath: string): MediaTrack {
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
      image: undefined, // Dropbox files don't have artwork by default
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
