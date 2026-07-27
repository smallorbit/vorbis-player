/**
 * Shared TypeScript types for the library cache system.
 *
 * The cache stores only neutral domain shapes (`MediaCollection` /
 * `MediaTrack`), keyed by `(provider, id)` — provider wire shapes never
 * cross this boundary.
 */

import type { MediaCollection, MediaTrack } from '@/types/domain';

/** A cached track list entry stored in IndexedDB */
export interface CachedTrackList {
  /** Collection-ref key (`collectionRefToKey`), e.g. "spotify:album:xxx" or "dropbox:liked:". */
  key: string;
  tracks: MediaTrack[];
  timestamp: number;
  /** Collection revision (e.g. Spotify snapshot_id) — used to detect when tracks need re-fetch */
  revision?: string;
}

/** Metadata stored alongside each cached collection for change detection */
export interface LibraryCacheMeta {
  key: string; // 'playlists' | 'albums' | 'likedSongs'
  /** When this cache entry was last validated against the API */
  lastValidated: number;
  /** Total count from the API (used for quick change detection) */
  totalCount: number;
  /** For playlists: map of playlistId -> revision */
  revisions?: Record<string, string>;
}

/** Result of the lightweight change detection phase */
export interface LibraryChanges {
  playlistsChanged: boolean;
  albumsChanged: boolean;
  likedSongsChanged: boolean;
  /** Specific playlist IDs whose revision changed (need track list re-fetch) */
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

/** Callback type for progressive loading during cold start */
export type CollectionsUpdateCallback = (collections: MediaCollection[], isComplete: boolean) => void;
