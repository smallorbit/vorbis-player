/**
 * React hook that connects the LibrarySyncEngine to component state.
 *
 * - On mount: reads from IndexedDB immediately (warm start) or falls back
 *   to progressive loading (cold start)
 * - Starts background polling every ~90 seconds
 * - Provides playlists, albums, liked songs count, and sync status
 * - Cleans up on unmount (stops engine)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { librarySyncEngine } from '../services/cache/librarySyncEngine';
import type { CachedPlaylistInfo, SyncState } from '../services/cache/cacheTypes';
import type { AlbumInfo } from '../services/spotify';

export interface UseLibrarySyncResult {
  playlists: CachedPlaylistInfo[];
  albums: AlbumInfo[];
  likedSongsCount: number;
  isInitialLoadComplete: boolean;
  isSyncing: boolean;
  lastSyncTimestamp: number | null;
  syncError: string | null;
  /** Force an immediate sync */
  refreshNow: () => Promise<void>;
}

export function useLibrarySync(): UseLibrarySyncResult {
  const [playlists, setPlaylists] = useState<CachedPlaylistInfo[]>([]);
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>({
    isInitialLoadComplete: false,
    isSyncing: false,
    lastSyncTimestamp: null,
    error: null,
  });

  const engineRef = useRef(librarySyncEngine);

  useEffect(() => {
    const engine = engineRef.current;

    const unsubscribe = engine.subscribe((state, newPlaylists, newAlbums, newLikedCount) => {
      setSyncState(state);
      if (newPlaylists !== undefined) setPlaylists(newPlaylists);
      if (newAlbums !== undefined) setAlbums(newAlbums);
      if (newLikedCount !== undefined) setLikedSongsCount(newLikedCount);
    });

    engine.start().catch((err) => {
      console.error('[useLibrarySync] Failed to start sync engine:', err);
    });

    return () => {
      unsubscribe();
      engine.stop();
    };
  }, []);

  const refreshNow = useCallback(async () => {
    await engineRef.current.syncNow();
  }, []);

  return {
    playlists,
    albums,
    likedSongsCount,
    isInitialLoadComplete: syncState.isInitialLoadComplete,
    isSyncing: syncState.isSyncing,
    lastSyncTimestamp: syncState.lastSyncTimestamp,
    syncError: syncState.error,
    refreshNow,
  };
}
