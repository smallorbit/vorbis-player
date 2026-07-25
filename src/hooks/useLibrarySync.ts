import { useEffect, useCallback, useMemo, useRef } from 'react';
import type { MediaCollection, ProviderId } from '@/types/domain';
import { useProviderContext } from '@/contexts/ProviderContext';
import { spotifyLibrarySyncEngine } from '@/services/cache/librarySyncEngine';
import { readLikedCountSnapshots } from '@/services/cache/likedCountSnapshot';
import { useEngineLibrarySync } from '@/hooks/useEngineLibrarySync';
import { useCatalogLibrarySync, type PerProviderLikedCount } from '@/hooks/useCatalogLibrarySync';

export const ART_REFRESHED_EVENT = 'vorbis-art-refreshed';
export const LIBRARY_REFRESH_EVENT = 'vorbis-library-refresh';

interface UseLibrarySyncResult {
  playlists: MediaCollection[];
  albums: MediaCollection[];
  likedSongsCount: number;
  /** Liked counts broken down by provider (for multi-provider liked songs cards). */
  likedSongsPerProvider: PerProviderLikedCount[];
  /** Total track count for the Dropbox "All Music" aggregate row, or 0 when Dropbox is not enabled. */
  allMusicCount: number;
  isInitialLoadComplete: boolean;
  isSyncing: boolean;
  /** True while liked counts from the synchronous cache seed are being verified by async sources. */
  isLikedSongsSyncing: boolean;
  lastSyncTimestamp: number | null;
  syncError: string | null;
  /** Force an immediate sync */
  refreshNow: () => Promise<void>;
  /** Optimistically remove a collection from the local list (instant UI update). */
  removeCollection: (collectionId: string) => void;
}

function initialLikedTotalFromSnapshot(): number {
  const snapshots = readLikedCountSnapshots();
  let total = 0;
  for (const entry of Object.values(snapshots)) {
    if (entry.count > 0) total += entry.count;
  }
  return total;
}

export function useLibrarySync(): UseLibrarySyncResult {
  const { enabledProviderIds, getDescriptor } = useProviderContext();
  const initialLikedSnapshotTotal = useMemo(() => initialLikedTotalFromSnapshot(), []);

  // Route each provider by its catalog's shape: a provider whose adapter has
  // no `listCollections` delegates library listing to the background sync
  // engine (the real Spotify adapter); everyone else — including the mock
  // spotify adapter — takes the registry-aware catalog path.
  const engineCandidateId = spotifyLibrarySyncEngine.providerId;
  const candidateDescriptor = getDescriptor(engineCandidateId);
  const rawEngineProviderId: ProviderId | undefined =
    candidateDescriptor && typeof candidateDescriptor.catalog.listCollections !== 'function'
      ? engineCandidateId
      : undefined;
  const engineProviderId = rawEngineProviderId && enabledProviderIds.includes(rawEngineProviderId)
    ? rawEngineProviderId
    : undefined;

  const catalogProviderIds = enabledProviderIds.filter((id) => id !== rawEngineProviderId);

  const engine = useEngineLibrarySync(engineProviderId);
  const catalog = useCatalogLibrarySync(catalogProviderIds);

  const merged = useMemo(() => {
    const playlists: MediaCollection[] = [];
    const albums: MediaCollection[] = [];
    const likedSongsPerProvider: PerProviderLikedCount[] = [];
    let likedSongsCount = 0;

    if (engineProviderId) {
      playlists.push(...engine.playlists);
      albums.push(...engine.albums);
      likedSongsCount += engine.likedCount;
      if (engine.likedCount > 0) {
        likedSongsPerProvider.push({ provider: engineProviderId, count: engine.likedCount });
      }
    }

    playlists.push(...catalog.playlists);
    albums.push(...catalog.albums);
    likedSongsCount += catalog.totalLikedCount;
    likedSongsPerProvider.push(...catalog.likedCounts);

    return { playlists, albums, likedSongsCount, likedSongsPerProvider };
  }, [
    engineProviderId,
    engine.playlists,
    engine.albums,
    engine.likedCount,
    catalog.playlists,
    catalog.albums,
    catalog.totalLikedCount,
    catalog.likedCounts,
  ]);

  const stickyInitialLoadRef = useRef(false);
  const isInitialLoadComplete = stickyInitialLoadRef.current
    || engine.syncState.isInitialLoadComplete
    || catalog.syncState.isInitialLoadComplete;
  if (isInitialLoadComplete) {
    stickyInitialLoadRef.current = true;
  }

  const isSyncing = engine.syncState.isSyncing || catalog.syncState.isSyncing;
  const lastSyncTimestamp = Math.max(
    engine.syncState.lastSyncTimestamp ?? 0,
    catalog.syncState.lastSyncTimestamp ?? 0,
  ) || null;
  const syncError = catalog.syncState.error ?? engine.syncState.error;

  const engineRefresh = engine.refresh;
  const catalogRefresh = catalog.refresh;
  const refreshNow = useCallback(async (scopeProviderId?: ProviderId) => {
    if (!scopeProviderId || scopeProviderId === engineProviderId) {
      await engineRefresh();
    }
    if (!scopeProviderId || scopeProviderId !== engineProviderId) {
      await catalogRefresh(scopeProviderId);
    }
  }, [engineProviderId, engineRefresh, catalogRefresh]);

  useEffect(() => {
    const handleArtRefresh = () => { refreshNow().catch(() => {}); };
    const handleLibraryRefresh = (e: Event) => {
      const providerId = (e as CustomEvent<{ providerId?: ProviderId }>).detail?.providerId;
      refreshNow(providerId).catch(() => {});
    };
    window.addEventListener(ART_REFRESHED_EVENT, handleArtRefresh);
    window.addEventListener(LIBRARY_REFRESH_EVENT, handleLibraryRefresh);
    return () => {
      window.removeEventListener(ART_REFRESHED_EVENT, handleArtRefresh);
      window.removeEventListener(LIBRARY_REFRESH_EVENT, handleLibraryRefresh);
    };
  }, [refreshNow]);

  const engineRemove = engine.removeCollection;
  const catalogRemove = catalog.removeCollection;
  const removeCollection = useCallback((collectionId: string) => {
    engineRemove(collectionId);
    catalogRemove(collectionId);
  }, [engineRemove, catalogRemove]);

  const isLikedSongsSyncing = enabledProviderIds.length > 0
    && !isInitialLoadComplete
    && initialLikedSnapshotTotal > 0;

  return {
    playlists: merged.playlists,
    albums: merged.albums,
    likedSongsCount: merged.likedSongsCount,
    likedSongsPerProvider: merged.likedSongsPerProvider,
    allMusicCount: catalog.allMusicCount,
    isInitialLoadComplete,
    isSyncing,
    isLikedSongsSyncing,
    lastSyncTimestamp,
    syncError,
    refreshNow,
    removeCollection,
  };
}
