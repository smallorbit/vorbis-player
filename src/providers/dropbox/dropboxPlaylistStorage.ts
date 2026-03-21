/**
 * Stores and retrieves user-created playlists as JSON files in Dropbox.
 * Files are saved at /.vorbis/playlists/<name>.json.
 */

import type { DropboxAuthAdapter } from './dropboxAuthAdapter';
import type { MediaTrack, MediaCollection, ProviderId, PlaybackItemRef } from '@/types/domain';
import { toSavedPlaylistId } from '@/constants/playlist';

// ── Helpers ──────────────────────────────────────────────────────────

/** Escape non-ASCII characters for use in HTTP headers (Dropbox-API-Arg). */
function jsonToHttpHeader(json: string): string {
  return json.replace(/[\u0080-\uffff]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return `\\u${code.toString(16).padStart(4, '0')}`;
  });
}

// ── Types ────────────────────────────────────────────────────────────

export interface SavedTrack {
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

export interface PlaylistFile {
  version: 1;
  name: string;
  createdAt: string;
  updatedAt: string;
  tracks: SavedTrack[];
}

// ── Constants ────────────────────────────────────────────────────────

const PLAYLISTS_FOLDER = '/.vorbis/playlists';

// ── Folder management ────────────────────────────────────────────────

let playlistsFolderConfirmed = false;

async function ensurePlaylistsFolder(auth: DropboxAuthAdapter): Promise<boolean> {
  if (playlistsFolderConfirmed) return true;

  let token = await auth.ensureValidToken();
  if (!token) return false;

  const create = async (accessToken: string) =>
    fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: PLAYLISTS_FOLDER, autorename: false }),
    });

  let response = await create(token);

  if (response.status === 401) {
    const refreshed = await auth.refreshAccessToken();
    if (!refreshed) return false;
    token = refreshed;
    response = await create(token);
  }

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
    albumId: track.albumId,
    durationMs: track.durationMs,
    externalUrl: track.externalUrl,
    image,
  };
}

function savedTrackToMediaTrack(track: SavedTrack): MediaTrack {
  return {
    id: track.id,
    provider: track.provider,
    playbackRef: track.playbackRef,
    name: track.name,
    artists: track.artists,
    artistsData: undefined,
    album: track.album,
    albumId: track.albumId,
    durationMs: track.durationMs,
    externalUrl: track.externalUrl,
    image: track.image,
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Save the current queue as a playlist file in Dropbox.
 * Returns the file path on success, or null on failure.
 */
export async function saveQueueAsPlaylist(
  auth: DropboxAuthAdapter,
  name: string,
  mediaTracks: MediaTrack[],
): Promise<string | null> {
  const folderReady = await ensurePlaylistsFolder(auth);
  if (!folderReady) return null;

  const sanitized = sanitizeFilename(name);
  if (!sanitized) return null;

  const filePath = `${PLAYLISTS_FOLDER}/${sanitized}.json`;
  const now = new Date().toISOString();

  // Preserve createdAt from existing file on overwrite
  let createdAt = now;
  try {
    const existing = await loadPlaylistFile(auth, filePath);
    if (existing?.createdAt) createdAt = existing.createdAt;
  } catch {
    // New file — use current time
  }

  const data: PlaylistFile = {
    version: 1,
    name,
    createdAt,
    updatedAt: now,
    tracks: mediaTracks.map(mediaTrackToSavedTrack),
  };

  let token = await auth.ensureValidToken();
  if (!token) return null;

  const apiArg = jsonToHttpHeader(
    JSON.stringify({ path: filePath, mode: 'overwrite' }),
  );
  const body = JSON.stringify(data);

  const upload = (accessToken: string) =>
    fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': apiArg,
        'Content-Type': 'application/octet-stream',
      },
      body,
    });

  let response = await upload(token);

  if (response.status === 401) {
    const refreshed = await auth.refreshAccessToken();
    if (!refreshed) return null;
    response = await upload(refreshed);
  }

  if (!response.ok) {
    console.warn('[DropboxPlaylistStorage] Upload failed:', response.status);
    return null;
  }

  return filePath;
}

/**
 * List all saved playlists from /.vorbis/playlists/ as MediaCollections.
 */
export async function listSavedPlaylists(
  auth: DropboxAuthAdapter,
): Promise<MediaCollection[]> {
  let token = await auth.ensureValidToken();
  if (!token) return [];

  interface ListResult {
    entries: Array<{ '.tag': string; name: string; path_lower: string; path_display: string }>;
    has_more: boolean;
    cursor: string;
  }

  const listFolder = async (accessToken: string) =>
    fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: PLAYLISTS_FOLDER, recursive: false }),
    });

  let response = await listFolder(token);

  if (response.status === 401) {
    const refreshed = await auth.refreshAccessToken();
    if (!refreshed) return [];
    token = refreshed;
    response = await listFolder(token);
  }

  // 409 = folder doesn't exist yet → no playlists
  if (response.status === 409) return [];

  if (!response.ok) {
    console.warn('[DropboxPlaylistStorage] List folder failed:', response.status);
    return [];
  }

  const result: ListResult = await response.json();
  const collections: MediaCollection[] = [];

  const filePaths: string[] = [];

  const collectEntries = (entries: ListResult['entries']) => {
    for (const entry of entries) {
      if (entry['.tag'] !== 'file' || !entry.name.endsWith('.json')) continue;
      collections.push({
        id: toSavedPlaylistId(entry.path_lower),
        provider: 'dropbox',
        kind: 'playlist',
        name: entry.name.replace(/\.json$/, ''),
        imageUrl: undefined,
      });
      filePaths.push(entry.path_lower);
    }
  };

  collectEntries(result.entries);

  // Handle pagination
  let cursor = result.cursor;
  let hasMore = result.has_more;
  const continueFetch = (accessToken: string) =>
    fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cursor }),
    });

  while (hasMore) {
    let continueResp = await continueFetch(token);
    if (continueResp.status === 401) {
      const refreshed = await auth.refreshAccessToken();
      if (!refreshed) break;
      token = refreshed;
      continueResp = await continueFetch(token);
    }
    if (!continueResp.ok) break;
    const cont: ListResult = await continueResp.json();
    collectEntries(cont.entries);
    cursor = cont.cursor;
    hasMore = cont.has_more;
  }

  // Download each playlist file in parallel to get track counts
  await Promise.all(
    collections.map(async (collection, i) => {
      try {
        const data = await loadPlaylistFile(auth, filePaths[i]);
        if (data) {
          collection.trackCount = data.tracks.length;
        }
      } catch {
        // Leave trackCount undefined on failure — UI will show 0
      }
    }),
  );

  collections.sort((a, b) => a.name.localeCompare(b.name));
  return collections;
}

/**
 * Download and parse a playlist file from Dropbox.
 * Returns null if the file doesn't exist or can't be parsed.
 */
async function loadPlaylistFile(
  auth: DropboxAuthAdapter,
  playlistPath: string,
): Promise<PlaylistFile | null> {
  let token = await auth.ensureValidToken();
  if (!token) return null;

  const apiArg = jsonToHttpHeader(JSON.stringify({ path: playlistPath }));

  const download = (accessToken: string) =>
    fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': apiArg,
      },
    });

  let response = await download(token);

  if (response.status === 401) {
    const refreshed = await auth.refreshAccessToken();
    if (!refreshed) return null;
    response = await download(refreshed);
  }

  if (!response.ok) return null;

  try {
    const data: PlaylistFile = await response.json();
    return data.version === 1 ? data : null;
  } catch {
    return null;
  }
}

/**
 * Load tracks from a saved playlist file.
 * @param playlistPath The Dropbox file path (e.g. /.vorbis/playlists/my-playlist.json)
 */
export async function loadPlaylistTracks(
  auth: DropboxAuthAdapter,
  playlistPath: string,
): Promise<MediaTrack[]> {
  const data = await loadPlaylistFile(auth, playlistPath);
  if (!data) return [];

  try {
    return data.tracks.map(savedTrackToMediaTrack);
  } catch {
    console.warn('[DropboxPlaylistStorage] Failed to parse playlist file');
    return [];
  }
}

/**
 * Delete a saved playlist file.
 */
export async function deleteSavedPlaylist(
  auth: DropboxAuthAdapter,
  playlistPath: string,
): Promise<boolean> {
  let token = await auth.ensureValidToken();
  if (!token) return false;

  const deleteFile = (accessToken: string) =>
    fetch('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: playlistPath }),
    });

  let response = await deleteFile(token);

  if (response.status === 401) {
    const refreshed = await auth.refreshAccessToken();
    if (!refreshed) return false;
    response = await deleteFile(refreshed);
  }

  return response.ok;
}
