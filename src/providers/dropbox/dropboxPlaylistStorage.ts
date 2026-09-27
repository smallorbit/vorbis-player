/**
 * Stores and retrieves user-created playlists as JSON files in Dropbox.
 * Files are saved at /.vorbis/playlists/<name>.json.
 */

import type { DropboxAuthHandle } from './dropboxAuthHandle';
import type { MediaTrack, MediaCollection, ProviderId, PlaybackItemRef } from '@/types/domain';
import { logLibrary } from '@/lib/debugLog';
import { buildAlbumCoverMap, selectMosaicCovers } from '@/utils/mosaicSelection';
import { logCaughtError } from '@/utils/logCaughtError';
import { contentApiRequest } from './dropboxContentApiClient';
import {
  downloadRemoteJson,
  uploadRemoteJson,
  jsonToHttpHeader,
} from './remoteJsonFileStore';

// ── Types ────────────────────────────────────────────────────────────

interface SavedTrack {
  id: string;
  provider: ProviderId;
  playbackRef: PlaybackItemRef;
  name: string;
  artists: string;
  album: string;
  albumId?: string;
  durationMs: number;
  externalUrl?: string;
  image?: string;
}

interface PlaylistFile {
  version: 1;
  name: string;
  createdAt: string;
  updatedAt: string;
  tracks: SavedTrack[];
}

// ── Constants ────────────────────────────────────────────────────────

const PLAYLISTS_FOLDER = '/.vorbis/playlists';
const LOG_LABEL = 'DropboxPlaylistStorage';

// ── Folder management ────────────────────────────────────────────────

let playlistsFolderConfirmed = false;

async function ensurePlaylistsFolder(auth: DropboxAuthHandle): Promise<boolean> {
  if (playlistsFolderConfirmed) return true;

  const response = await contentApiRequest(auth, (token) =>
    fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: PLAYLISTS_FOLDER, autorename: false }),
    }),
  );

  if (!response) return false;

  // 409 = folder already exists
  if (response.status === 409 || response.ok) {
    playlistsFolderConfirmed = true;
    return true;
  }

  console.warn('[DropboxPlaylistStorage] Failed to ensure playlists folder:', response.status);
  return false;
}

/** Reset cached state (for logout or testing). */
export function resetPlaylistsFolderCache(): void {
  playlistsFolderConfirmed = false;
}

// ── Helpers ──────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function mediaTrackToSavedTrack(track: MediaTrack): SavedTrack {
  // Exclude base64 data URIs (e.g. Dropbox album art) — only store URL references
  const image = track.image?.startsWith('data:') ? undefined : track.image;
  return {
    id: track.id,
    provider: track.provider,
    playbackRef: track.playbackRef,
    name: track.name,
    artists: track.artists,
    album: track.album,
    durationMs: track.durationMs,
    ...(track.albumId !== undefined && { albumId: track.albumId }),
    ...(track.externalUrl !== undefined && { externalUrl: track.externalUrl }),
    ...(image !== undefined && { image }),
  };
}

function savedTrackToMediaTrack(track: SavedTrack): MediaTrack {
  return {
    id: track.id,
    provider: track.provider,
    playbackRef: track.playbackRef,
    name: track.name,
    artists: track.artists,
    album: track.album,
    durationMs: track.durationMs,
    ...(track.albumId !== undefined && { albumId: track.albumId }),
    ...(track.externalUrl !== undefined && { externalUrl: track.externalUrl }),
    ...(track.image !== undefined && { image: track.image }),
    genres: [],
  };
}

function playlistTransport(auth: DropboxAuthHandle, path: string) {
  return {
    auth,
    path,
    expectedVersion: 1 as const,
    logLabel: LOG_LABEL,
    encodeApiArg: jsonToHttpHeader,
    ensureFolder: ensurePlaylistsFolder,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Save the current queue as a playlist file in Dropbox.
 * Returns the file path on success, or null on failure.
 */
export async function saveQueueAsPlaylist(
  auth: DropboxAuthHandle,
  name: string,
  mediaTracks: MediaTrack[],
): Promise<string | null> {
  const sanitized = sanitizeFilename(name);
  if (!sanitized) return null;

  const filePath = `${PLAYLISTS_FOLDER}/${sanitized}.json`;
  const now = new Date().toISOString();

  // Preserve createdAt from existing file on overwrite
  let createdAt = now;
  try {
    const existing = await loadPlaylistFile(auth, filePath);
    if (existing?.createdAt) createdAt = existing.createdAt;
  } catch (err) {
    // New file — use current time
    logCaughtError('dropboxPlaylistStorage.savePlaylist.loadExisting', err);
  }

  const data: PlaylistFile = {
    version: 1,
    name,
    createdAt,
    updatedAt: now,
    tracks: mediaTracks.map(mediaTrackToSavedTrack),
  };

  const success = await uploadRemoteJson(playlistTransport(auth, filePath), data);
  return success ? filePath : null;
}

/**
 * List all saved playlists from /.vorbis/playlists/ as MediaCollections.
 */
export async function listSavedPlaylists(
  auth: DropboxAuthHandle,
): Promise<MediaCollection[]> {
  interface ListResult {
    entries: Array<{ '.tag': string; name: string; path_lower: string; path_display: string }>;
    has_more: boolean;
    cursor: string;
  }

  const response = await contentApiRequest(auth, (token) =>
    fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: PLAYLISTS_FOLDER, recursive: false }),
    }),
  );

  if (!response) return [];

  // 409 = folder doesn't exist yet → no playlists
  if (response.status === 409) return [];

  if (!response.ok) {
    console.warn('[DropboxPlaylistStorage] List folder failed:', response.status);
    return [];
  }

  const result = (await response.json()) as ListResult;
  const collections: MediaCollection[] = [];

  const filePaths: string[] = [];

  const collectEntries = (entries: ListResult['entries']) => {
    for (const entry of entries) {
      if (entry['.tag'] !== 'file' || !entry.name.endsWith('.json')) continue;
      collections.push({
        // The file path is the id; `kind: 'playlist'` distinguishes saved
        // playlists from folders, so no prefix encoding is needed.
        id: entry.path_lower,
        provider: 'dropbox',
        kind: 'playlist',
        name: entry.name.replace(/\.json$/, ''),
        genres: [],
      });
      filePaths.push(entry.path_lower);
    }
  };

  collectEntries(result.entries);

  // Handle pagination
  let cursor = result.cursor;
  let hasMore = result.has_more;

  while (hasMore) {
    const continueResp = await contentApiRequest(auth, (token) =>
      fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cursor }),
      }),
    );
    if (!continueResp || !continueResp.ok) break;
    const cont = (await continueResp.json()) as ListResult;
    collectEntries(cont.entries);
    cursor = cont.cursor;
    hasMore = cont.has_more;
  }

  // Download each playlist file in parallel to get track counts
  logLibrary('listSavedPlaylists: fetching track counts for %d playlists, paths: %o', collections.length, filePaths);
  await Promise.all(
    collections.map(async (collection, i) => {
      try {
        const path = filePaths[i];
        if (!path) return;
        const data = await loadPlaylistFile(auth, path);
        logLibrary('listSavedPlaylists: "%s" file=%s data=%s tracks=%d',
          collection.name, path, data ? 'loaded' : 'null', data?.tracks?.length ?? -1);
        if (data) {
          collection.trackCount = data.tracks.length;
          const albumMap = buildAlbumCoverMap(data.tracks);
          if (albumMap.size >= 2) {
            const selected = selectMosaicCovers(albumMap, collection.id);
            collection.mosaicAlbumPaths = selected;
          }
        }
      } catch (err) {
        logLibrary('listSavedPlaylists: "%s" failed to load: %o', collection.name, err);
      }
    }),
  );

  logLibrary('listSavedPlaylists: final collections: %o', collections.map(c => ({ name: c.name, trackCount: c.trackCount })));
  collections.sort((a, b) => a.name.localeCompare(b.name));
  return collections;
}

/**
 * Download and parse a playlist file from Dropbox.
 * Returns null if the file doesn't exist or can't be parsed.
 */
async function loadPlaylistFile(
  auth: DropboxAuthHandle,
  playlistPath: string,
): Promise<PlaylistFile | null> {
  return downloadRemoteJson<PlaylistFile>(playlistTransport(auth, playlistPath));
}

/**
 * Load tracks from a saved playlist file.
 * @param playlistPath The Dropbox file path (e.g. /.vorbis/playlists/my-playlist.json)
 */
export async function loadPlaylistTracks(
  auth: DropboxAuthHandle,
  playlistPath: string,
): Promise<MediaTrack[]> {
  const data = await loadPlaylistFile(auth, playlistPath);
  if (!data) return [];

  return data.tracks.map(savedTrackToMediaTrack);
}
