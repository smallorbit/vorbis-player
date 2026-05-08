import { useState, useEffect, useCallback, useRef } from 'react';
import type { CachedPlaylistInfo, SyncState } from '@/services/cache/cacheTypes';
import type { AlbumInfo } from '@/services/spotify';
import type { MediaCollection, ProviderId } from '@/types/domain';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import { logLibrary } from '@/lib/debugLog';
import { getOrSetFirstSeenAddedAtIso } from '@/utils/libraryFirstSeen';
import { writeLikedCountSnapshot } from '@/services/cache/likedCountSnapshot';
import { useStableSet } from '@/hooks/useStableSet';

export interface PerProviderLikedCount {
  provider: ProviderId;
  count: number;
}

export interface CatalogLibrarySyncResult {
  playlists: CachedPlaylistInfo[];
  albums: AlbumInfo[];
  likedCounts: PerProviderLikedCount[];
  totalLikedCount: number;
  allMusicCount: number;
  syncState: SyncState;
  refresh: (scopeProviderId?: ProviderId) => Promise<void>;
  removeCollection: (collectionId: string) => void;
}

interface PerProviderData {
  playlists: CachedPlaylistInfo[];
  albums: AlbumInfo[];
  likedCount: number;
  allMusicCount: number;
}

const INITIAL_SYNC_STATE: SyncState = {
  isInitialLoadComplete: false,
  isSyncing: false,
  lastSyncTimestamp: null,
  error: null,
};

function collectionToPlaylistInfo(c: MediaCollection, ordinal: number): CachedPlaylistInfo {
  const images: { url: string; height: number | null; width: number | null }[] = c.imageUrl
    ? [{ url: c.imageUrl, height: null, width: null }]
    : [];

  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    images,
    tracks: c.trackCount != null ? { total: c.trackCount } : null,
    owner: c.ownerName ? { display_name: c.ownerName } : null,
    snapshot_id: c.revision ?? undefined,
    provider: c.provider,
    added_at: getOrSetFirstSeenAddedAtIso(c.provider, `playlist:${c.id}`, ordinal),
    mosaicAlbumPaths: c.mosaicAlbumPaths,
  };
}

function collectionToAlbumInfo(c: MediaCollection, ordinal: number): AlbumInfo {
  return {
    id: c.id,
    name: c.name,
    artists: c.ownerName ?? '',
    images: c.imageUrl ? [{ url: c.imageUrl, height: null, width: null }] : [],
    release_date: c.releaseDate ?? '',
    total_tracks: c.trackCount ?? 0,
    uri: '',
    album_type: c.kind === 'folder' ? 'folder' : 'album',
    provider: c.provider,
    added_at: getOrSetFirstSeenAddedAtIso(c.provider, `album:${c.id}`, ordinal),
  };
}

/** Returns true when the collection is the Dropbox "All Music" aggregate row. */
function isAllMusicCollection(c: MediaCollection): boolean {
  return c.provider === 'dropbox' && c.id === '';
}

function splitCollections(collections: MediaCollection[]): {
  playlists: CachedPlaylistInfo[];
  albums: AlbumInfo[];
  allMusicCount: number;
} {
  const playlists: CachedPlaylistInfo[] = [];
  const albums: AlbumInfo[] = [];
  let playlistOrdinal = 0;
  let albumOrdinal = 0;
  let allMusicCount = 0;
  for (const c of collections) {
    if (isAllMusicCollection(c)) {
      allMusicCount = c.trackCount ?? 0;
      continue;
    }
    if (c.kind === 'album') {
      albums.push(collectionToAlbumInfo(c, albumOrdinal++));
    } else {
      playlists.push(collectionToPlaylistInfo(c, playlistOrdinal++));
    }
  }
  return { playlists, albums, allMusicCount };
}

function aggregate(map: Map<ProviderId, PerProviderData>, enabled: readonly ProviderId[]): {
  playlists: CachedPlaylistInfo[];
  albums: AlbumInfo[];
  likedCounts: PerProviderLikedCount[];
  totalLikedCount: number;
  allMusicCount: number;
} {
  const playlists: CachedPlaylistInfo[] = [];
  const albums: AlbumInfo[] = [];
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
    playlists: CachedPlaylistInfo[];
    albums: AlbumInfo[];
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
        logLibrary('[%s] after splitCollections — playlists: %o', providerId,
          playlists.map(p => ({ name: p.name, tracks: p.tracks })));
        logLibrary('[%s] after splitCollections — albums: %o', providerId,
          albums.map(a => ({ name: a.name, total_tracks: a.total_tracks })));
        dataRef.current.set(providerId, { playlists, albums, likedCount, allMusicCount });
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
