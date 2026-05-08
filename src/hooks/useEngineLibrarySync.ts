import { useState, useEffect, useCallback, useRef } from 'react';
import type { CachedPlaylistInfo, SyncState } from '@/services/cache/cacheTypes';
import type { AlbumInfo } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';
import { spotifyLibrarySyncEngine } from '@/services/cache/librarySyncEngine';
import { logLibrary } from '@/lib/debugLog';

export interface EngineLibrarySyncResult {
  playlists: CachedPlaylistInfo[];
  albums: AlbumInfo[];
  likedCount: number;
  syncState: SyncState;
  refresh: () => Promise<void>;
  removeCollection: (collectionId: string) => void;
}

const INITIAL_SYNC_STATE: SyncState = {
  isInitialLoadComplete: false,
  isSyncing: false,
  lastSyncTimestamp: null,
  error: null,
};

/**
 * Hook for the library-sync-engine path (currently Spotify only).
 *
 * Owns the `spotifyLibrarySyncEngine.subscribe(...)` lifecycle and exposes the most
 * recent playlists/albums/likedCount snapshot the engine has emitted.
 *
 * When `engineProviderId` is undefined or disabled, the hook returns empty
 * data and does not subscribe.
 */
export function useEngineLibrarySync(engineProviderId: ProviderId | undefined): EngineLibrarySyncResult {
  const [playlists, setPlaylists] = useState<CachedPlaylistInfo[]>([]);
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [likedCount, setLikedCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>(INITIAL_SYNC_STATE);

  const engineRef = useRef(spotifyLibrarySyncEngine);

  useEffect(() => {
    if (!engineProviderId) {
      setPlaylists([]);
      setAlbums([]);
      setLikedCount(0);
      return;
    }

    const engine = engineRef.current;
    const epId = engineProviderId;

    const unsubscribe = engine.subscribe((state, newPlaylists, newAlbums, newLikedCount) => {
      setSyncState(prev => ({
        ...prev,
        ...state,
        isInitialLoadComplete: prev.isInitialLoadComplete || state.isInitialLoadComplete,
      }));
      if (newPlaylists !== undefined) {
        logLibrary('[%s] sync engine playlists: %o', epId,
          newPlaylists.map(p => ({ name: p.name, tracks: p.tracks })));
        setPlaylists(newPlaylists.map(p => ({ ...p, provider: epId })));
      }
      if (newAlbums !== undefined) {
        setAlbums(newAlbums.map(a => ({ ...a, provider: epId })));
      }
      if (newLikedCount !== undefined) {
        setLikedCount(newLikedCount);
      }
    });

    engine.start().catch((err) => {
      console.error('[useEngineLibrarySync] Failed to start sync engine:', err);
    });

    return () => {
      unsubscribe();
    };
  }, [engineProviderId]);

  const refresh = useCallback(async () => {
    if (!engineProviderId) return;
    await engineRef.current.syncNow(true);
  }, [engineProviderId]);

  const removeCollection = useCallback((collectionId: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== collectionId));
    setAlbums(prev => prev.filter(a => a.id !== collectionId));
  }, []);

  return {
    playlists,
    albums,
    likedCount,
    syncState,
    refresh,
    removeCollection,
  };
}
