/**
 * Search query over the IndexedDB-cached library catalog.
 *
 * Returns categorized results (tracks, albums, artists, playlists) for a
 * non-empty query string by reading already-cached records — never makes
 * network calls and never triggers lazy provider catalog loads.
 *
 * Artists are derived from cached tracks + albums (the cache does not store
 * a dedicated artist entity).
 */

import type { AlbumInfo, Track } from '../spotify';
import type { CachedPlaylistInfo } from './cacheTypes';
import {
  getAllAlbums,
  getAllPlaylists,
  getTrackList,
  _testing as cacheInternals,
} from './libraryCache';

const DEFAULT_LIMIT_PER_CATEGORY = 10;
const LIKED_SONGS_TRACK_LIST_ID = 'liked-songs';

/**
 * Lightweight artist record produced by the search query.
 *
 * The cache does not store artists as a first-class entity; we synthesize
 * them from the artist names that appear on cached tracks and albums.
 * `id` is a stable slug derived from `name`.
 */
export interface SearchArtist {
  id: string;
  name: string;
}

export interface LibrarySearchResult {
  tracks: Track[];
  albums: AlbumInfo[];
  artists: SearchArtist[];
  playlists: CachedPlaylistInfo[];
}

export interface LibrarySearchOptions {
  /** Maximum results returned per category. Defaults to 10. */
  limitPerCategory?: number;
}

const EMPTY_RESULT: LibrarySearchResult = Object.freeze({
  tracks: [],
  albums: [],
  artists: [],
  playlists: [],
}) as LibrarySearchResult;

function isBlank(query: string): boolean {
  return query.trim().length === 0;
}

function includesCI(haystack: string | undefined | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle);
}

function artistSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

function splitArtists(rawArtists: string | undefined): string[] {
  if (!rawArtists) return [];
  return rawArtists
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Collect every cached track. Reads from all stored track lists (per-playlist,
 * per-album, and the liked-songs list). Strictly cache-only — no network.
 */
async function collectAllCachedTracks(
  playlists: CachedPlaylistInfo[],
  albums: AlbumInfo[],
): Promise<Track[]> {
  const trackListIds = new Set<string>();
  trackListIds.add(LIKED_SONGS_TRACK_LIST_ID);
  for (const p of playlists) trackListIds.add(`playlist:${p.id}`);
  for (const a of albums) trackListIds.add(`album:${a.id}`);

  const lists = await Promise.all(Array.from(trackListIds).map((id) => getTrackList(id)));
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const list of lists) {
    if (!list) continue;
    for (const track of list.tracks) {
      if (!track?.id || seen.has(track.id)) continue;
      seen.add(track.id);
      out.push(track);
    }
  }
  return out;
}

function deriveArtists(
  tracks: Track[],
  albums: AlbumInfo[],
  needle: string,
  limit: number,
): SearchArtist[] {
  const seen = new Map<string, SearchArtist>();

  const consider = (name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!includesCI(trimmed, needle)) return;
    const id = artistSlug(trimmed);
    if (!seen.has(id)) {
      seen.set(id, { id, name: trimmed });
    }
  };

  for (const track of tracks) {
    if (track.artistsData?.length) {
      for (const a of track.artistsData) consider(a.name);
    } else {
      for (const name of splitArtists(track.artists)) consider(name);
    }
    if (seen.size >= limit) break;
  }

  if (seen.size < limit) {
    for (const album of albums) {
      for (const name of splitArtists(album.artists)) consider(name);
      if (seen.size >= limit) break;
    }
  }

  return Array.from(seen.values()).slice(0, limit);
}

/**
 * Run a categorized search across the IndexedDB-cached library catalog.
 *
 * - Case-insensitive substring match.
 * - Tracks match on `name` or `artists`.
 * - Albums match on `name` or `artists`.
 * - Artists match on `name` (derived from cached tracks + albums).
 * - Playlists match on `name`.
 * - Each category is capped (default: 10).
 * - Empty/whitespace queries return an empty result without reading the cache.
 */
export async function searchLibraryCache(
  query: string,
  options: LibrarySearchOptions = {},
): Promise<LibrarySearchResult> {
  if (isBlank(query)) {
    return { tracks: [], albums: [], artists: [], playlists: [] };
  }

  const limit = Math.max(1, options.limitPerCategory ?? DEFAULT_LIMIT_PER_CATEGORY);
  const needle = query.trim().toLowerCase();

  const [playlistsAll, albumsAll] = await Promise.all([getAllPlaylists(), getAllAlbums()]);
  const tracksAll = await collectAllCachedTracks(playlistsAll, albumsAll);

  const tracks: Track[] = [];
  for (const t of tracksAll) {
    if (includesCI(t.name, needle) || includesCI(t.artists, needle)) {
      tracks.push(t);
      if (tracks.length >= limit) break;
    }
  }

  const albums: AlbumInfo[] = [];
  for (const a of albumsAll) {
    if (includesCI(a.name, needle) || includesCI(a.artists, needle)) {
      albums.push(a);
      if (albums.length >= limit) break;
    }
  }

  const playlists: CachedPlaylistInfo[] = [];
  for (const p of playlistsAll) {
    if (includesCI(p.name, needle)) {
      playlists.push(p);
      if (playlists.length >= limit) break;
    }
  }

  const artists = deriveArtists(tracksAll, albumsAll, needle, limit);

  return { tracks, albums, artists, playlists };
}

/** Frozen empty-result singleton for hooks/consumers. */
export function emptySearchResult(): LibrarySearchResult {
  return EMPTY_RESULT;
}

/** Internal handle for tests — exposes the underlying cache state. */
export const _searchTesting = {
  cacheInternals,
};
