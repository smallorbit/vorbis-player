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
import { logError } from '../services/errorLogger';
import type { CachedPlaylistInfo, SyncState } from '../services/cache/cacheTypes';
import type { AlbumInfo } from '../services/spotify';

interface UseLibrarySyncResult {
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
      logError(`Failed to start sync engine: ${err instanceof Error ? err.message : String(err)}`, 'useLibrarySync');
    });

    return () => {
      unsubscribe();
      // Do not stop the singleton engine here — it should keep running in the
      // background (polling every ~90s) regardless of which component is mounted.
      // Stopping it caused a race where isInitialLoadComplete stayed true in the
      // engine's state but the next subscriber got no data, showing a false
      // "no playlists found" error until the async IndexedDB read completed.
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
