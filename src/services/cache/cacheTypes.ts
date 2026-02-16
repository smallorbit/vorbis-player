/**
 * Shared TypeScript types for the Spotify library cache system.
 */

import type { PlaylistInfo, AlbumInfo, Track } from '../spotify';

/** Extends PlaylistInfo with Spotify's snapshot_id for change detection */
export interface CachedPlaylistInfo extends PlaylistInfo {
  snapshot_id?: string;
}

/** A cached track list entry stored in IndexedDB */
export interface CachedTrackList {
  id: string; // "playlist:{playlistId}" or "album:{albumId}"
  tracks: Track[];
  timestamp: number;
  /** snapshot_id for playlists — used to detect when tracks need re-fetch */
  snapshotId?: string;
}

/** Metadata stored alongside each cached collection for change detection */
export interface LibraryCacheMeta {
  key: string; // 'playlists' | 'albums' | 'likedSongs'
  /** When this cache entry was last validated against the API */
  lastValidated: number;
  /** Total count from the API (used for quick change detection) */
  totalCount: number;
  /** For playlists: map of playlistId -> snapshot_id */
  snapshotIds?: Record<string, string>;
  /** For albums: most recent added_at timestamp */
  latestAddedAt?: string;
}

/** Result of the lightweight change detection phase */
export interface LibraryChanges {
  playlistsChanged: boolean;
  albumsChanged: boolean;
  likedSongsChanged: boolean;
  /** Specific playlist IDs whose snapshot_id changed (need track list re-fetch) */
  changedPlaylistIds: string[];
  /** New counts from the API */
  newPlaylistCount: number;
  newAlbumCount: number;
  newLikedSongsCount: number;
}

/** Sync engine state exposed to React via useLibrarySync */
export interface SyncState {
  isInitialLoadComplete: boolean;
  isSyncing: boolean;
  lastSyncTimestamp: number | null;
  error: string | null;
}

/** Callback types for progressive loading during cold start */
export type PlaylistsUpdateCallback = (playlists: CachedPlaylistInfo[], isComplete: boolean) => void;
export type AlbumsUpdateCallback = (albums: AlbumInfo[], isComplete: boolean) => void;
