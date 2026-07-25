import { useState, useEffect, useCallback, useRef } from 'react';
import type { SyncState } from '@/services/cache/cacheTypes';
import type { MediaCollection, ProviderId } from '@/types/domain';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import { logLibrary } from '@/lib/debugLog';
import { replaceProviderAlbums, replaceProviderPlaylists } from '@/services/cache/libraryCache';
import { writeLikedCountSnapshot } from '@/services/cache/likedCountSnapshot';
import { logCaughtError } from '@/utils/logCaughtError';
import { useStableSet } from '@/hooks/useStableSet';

export interface PerProviderLikedCount {
  provider: ProviderId;
  count: number;
}

interface CatalogLibrarySyncResult {
  playlists: MediaCollection[];
  albums: MediaCollection[];
  likedCounts: PerProviderLikedCount[];
  totalLikedCount: number;
  allMusicCount: number;
  syncState: SyncState;
  refresh: (scopeProviderId?: ProviderId) => Promise<void>;
  removeCollection: (collectionId: string) => void;
}

interface PerProviderData {
  playlists: MediaCollection[];
  albums: MediaCollection[];
  likedCount: number;
  allMusicCount: number;
}

const INITIAL_SYNC_STATE: SyncState = {
  isInitialLoadComplete: false,
  isSyncing: false,
  lastSyncTimestamp: null,
  error: null,
};

/** Returns true when the collection is the Dropbox "All Music" aggregate row. */
function isAllMusicCollection(c: MediaCollection): boolean {
  return c.provider === 'dropbox' && c.id === '';
}

function splitCollections(collections: MediaCollection[]): {
  playlists: MediaCollection[];
  albums: MediaCollection[];
  allMusicCount: number;
} {
  const playlists: MediaCollection[] = [];
  const albums: MediaCollection[] = [];
  let allMusicCount = 0;
  for (const c of collections) {
    if (isAllMusicCollection(c)) {
      allMusicCount = c.trackCount ?? 0;
      continue;
    }
    if (c.kind === 'album') {
      albums.push(c);
    } else {
      playlists.push(c);
    }
  }
  return { playlists, albums, allMusicCount };
}

/**
 * Persist a provider's collections into the shared library cache so
 * cache-backed consumers (e.g. CmdK search) can see them.
 */
function writeCollectionsToCache(
  providerId: ProviderId,
  playlists: MediaCollection[],
  albums: MediaCollection[],
): void {
  replaceProviderPlaylists(providerId, playlists).catch((err) => {
    logCaughtError('useCatalogLibrarySync.writePlaylistsToCache', err);
  });
  replaceProviderAlbums(providerId, albums).catch((err) => {
    logCaughtError('useCatalogLibrarySync.writeAlbumsToCache', err);
  });
}

function aggregate(map: Map<ProviderId, PerProviderData>, enabled: readonly ProviderId[]): {
  playlists: MediaCollection[];
  albums: MediaCollection[];
  likedCounts: PerProviderLikedCount[];
  totalLikedCount: number;
  allMusicCount: number;
} {
  const playlists: MediaCollection[] = [];
  const albums: MediaCollection[] = [];
  const likedCounts: PerProviderLikedCount[] = [];
  let totalLikedCount = 0;
  let allMusicCount = 0;
  for (const [providerId, data] of map) {
    if (!enabled.includes(providerId)) continue;
    playlists.push(...data.playlists);
    albums.push(...data.albums);
    totalLikedCount += data.likedCount;
    allMusicCount += data.allMusicCount;
    if (data.likedCount > 0) {
      likedCounts.push({ provider: providerId, count: data.likedCount });
    }
  }
  return { playlists, albums, likedCounts, totalLikedCount, allMusicCount };
}

/**
 * Hook for the catalog-adapter path (any provider that exposes
 * `descriptor.catalog.listCollections`).
 *
 * Owns the per-provider listCollections effect, the likes-changed event
 * listeners, and the in-memory data store.
 *
 * The input array is stabilized internally via `useStableSet`, so callers
 * may pass a fresh array each render without re-firing the load effect.
 */
export function useCatalogLibrarySync(catalogProviderIdsInput: readonly ProviderId[]): CatalogLibrarySyncResult {
  const catalogProviderIds = useStableSet(catalogProviderIdsInput);
  const { getDescriptor } = useProviderContext();
  const [aggregated, setAggregated] = useState<{
    playlists: MediaCollection[];
    albums: MediaCollection[];
    likedCounts: PerProviderLikedCount[];
    totalLikedCount: number;
    allMusicCount: number;
  }>(() => ({ playlists: [], albums: [], likedCounts: [], totalLikedCount: 0, allMusicCount: 0 }));
  const [syncState, setSyncState] = useState<SyncState>(INITIAL_SYNC_STATE);

  const dataRef = useRef<Map<ProviderId, PerProviderData>>(new Map());
  const enabledRef = useRef<readonly ProviderId[]>(catalogProviderIds);
  enabledRef.current = catalogProviderIds;

  const recomputeAggregate = useCallback(() => {
    setAggregated(aggregate(dataRef.current, enabledRef.current));
  }, []);

  useEffect(() => {
    if (catalogProviderIds.length === 0) {
      dataRef.current.clear();
      recomputeAggregate();
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadProviderCollections(providerId: ProviderId) {
      const descriptor = getDescriptor(providerId);
      const catalog = descriptor?.catalog;
      const auth = descriptor?.auth;
      if (!catalog || !auth || !auth.isAuthenticated()) {
        dataRef.current.set(providerId, { playlists: [], albums: [], likedCount: 0, allMusicCount: 0 });
        return;
      }

      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

      try {
        const [collections, likedCount] = await Promise.all([
          catalog.listCollections(controller.signal),
          catalog.getLikedCount ? catalog.getLikedCount(controller.signal) : Promise.resolve(0),
        ]);
        if (cancelled) return;

        logLibrary('[%s] raw collections from catalog: %o', providerId,
          collections.map(c => ({ name: c.name, kind: c.kind, trackCount: c.trackCount })));

        const { playlists, albums, allMusicCount } = splitCollections(collections);
        dataRef.current.set(providerId, { playlists, albums, likedCount, allMusicCount });
        writeCollectionsToCache(providerId, playlists, albums);
        writeLikedCountSnapshot(providerId, likedCount);
        recomputeAggregate();
        setSyncState(prev => ({
          ...prev,
          isInitialLoadComplete: true,
          isSyncing: false,
          lastSyncTimestamp: Date.now(),
        }));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error(`[useCatalogLibrarySync] Failed to load collections for ${providerId}:`, err);
        setSyncState(prev => ({
          ...prev,
          isInitialLoadComplete: true,
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Failed to load library',
        }));
      }
    }

    Promise.all(catalogProviderIds.map(loadProviderCollections)).catch(() => {});

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [catalogProviderIds, getDescriptor, recomputeAggregate]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    for (const providerId of catalogProviderIds) {
      const descriptor = getDescriptor(providerId);
      const catalog = descriptor?.catalog;
      if (!catalog?.getLikedCount) continue;

      const registryDescriptor = providerRegistry.get(providerId);
      const eventName = registryDescriptor?.likesChangedEvent;
      if (!eventName) continue;

      const handleLikesChanged = () => {
        catalog.getLikedCount!().then(count => {
          const data = dataRef.current.get(providerId);
          if (data) {
            data.likedCount = count;
            recomputeAggregate();
          }
        }).catch(() => {});
      };

      window.addEventListener(eventName, handleLikesChanged);
      cleanups.push(() => window.removeEventListener(eventName, handleLikesChanged));
    }
    return () => cleanups.forEach(cleanup => cleanup());
  }, [catalogProviderIds, getDescriptor, recomputeAggregate]);

  const refresh = useCallback(async (scopeProviderId?: ProviderId) => {
    const providerIdsToRefresh = scopeProviderId
      ? catalogProviderIds.filter(id => id === scopeProviderId)
      : catalogProviderIds;

    for (const providerId of providerIdsToRefresh) {
      const descriptor = getDescriptor(providerId);
      const catalog = descriptor?.catalog;
      if (!catalog) continue;

      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));
      try {
        const [collections, likedCount] = await Promise.all([
          catalog.listCollections(undefined, { forceRefresh: true }),
          catalog.getLikedCount ? catalog.getLikedCount() : Promise.resolve(0),
        ]);
        const { playlists, albums, allMusicCount } = splitCollections(collections);
        dataRef.current.set(providerId, { playlists, albums, likedCount, allMusicCount });
        writeCollectionsToCache(providerId, playlists, albums);
        writeLikedCountSnapshot(providerId, likedCount);
        recomputeAggregate();
        setSyncState(prev => ({
          ...prev,
          isInitialLoadComplete: true,
          isSyncing: false,
          lastSyncTimestamp: Date.now(),
        }));
      } catch (err) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Refresh failed',
        }));
      }
    }
  }, [catalogProviderIds, getDescriptor, recomputeAggregate]);

  const removeCollection = useCallback((collectionId: string) => {
    for (const [, data] of dataRef.current) {
      data.playlists = data.playlists.filter(p => p.id !== collectionId);
      data.albums = data.albums.filter(a => a.id !== collectionId);
    }
    recomputeAggregate();
  }, [recomputeAggregate]);

  return {
    playlists: aggregated.playlists,
    albums: aggregated.albums,
    likedCounts: aggregated.likedCounts,
    totalLikedCount: aggregated.totalLikedCount,
    allMusicCount: aggregated.allMusicCount,
    syncState,
    refresh,
    removeCollection,
  };
}
