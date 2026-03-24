/**
 * React hook that connects the LibrarySyncEngine to component state.
 *
 * Multi-provider aware: fetches collections from ALL enabled providers
 * simultaneously and merges results. Spotify uses the LibrarySyncEngine
 * (with IndexedDB cache and background polling); other providers call
 * catalog.listCollections() directly.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { librarySyncEngine } from '../services/cache/librarySyncEngine';
import type { CachedPlaylistInfo, SyncState } from '../services/cache/cacheTypes';
import type { AlbumInfo } from '../services/spotify';
import { useProviderContext } from '../contexts/ProviderContext';
import type { MediaCollection, ProviderId } from '../types/domain';
import { providerRegistry } from '../providers/registry';
import { logLibrary } from '../lib/debugLog';
import { getOrSetFirstSeenAddedAtIso } from '../utils/libraryFirstSeen';

function splitCollections(collections: MediaCollection[]): { playlists: CachedPlaylistInfo[]; albums: AlbumInfo[] } {
  const playlists: CachedPlaylistInfo[] = [];
  const albums: AlbumInfo[] = [];
  let playlistOrdinal = 0;
  let albumOrdinal = 0;
  for (const c of collections) {
    if (c.kind === 'album') {
      albums.push(collectionToAlbumInfo(c, albumOrdinal++));
    } else {
      playlists.push(collectionToPlaylistInfo(c, playlistOrdinal++));
    }
  }
  return { playlists, albums };
}

export const ART_REFRESHED_EVENT = 'vorbis-art-refreshed';
export const LIBRARY_REFRESH_EVENT = 'vorbis-library-refresh';

/** Per-provider liked songs count for rendering separate cards. */
export interface PerProviderLikedCount {
  provider: ProviderId;
  count: number;
}

interface UseLibrarySyncResult {
  playlists: CachedPlaylistInfo[];
  albums: AlbumInfo[];
  likedSongsCount: number;
  /** Liked counts broken down by provider (for multi-provider liked songs cards). */
  likedSongsPerProvider: PerProviderLikedCount[];
  isInitialLoadComplete: boolean;
  isSyncing: boolean;
  lastSyncTimestamp: number | null;
  syncError: string | null;
  /** Force an immediate sync */
  refreshNow: () => Promise<void>;
  /** Optimistically remove a collection from the local list (instant UI update). */
  removeCollection: (collectionId: string) => void;
}

/**
 * Map a MediaCollection to CachedPlaylistInfo shape so the library UI can
 * render it regardless of provider.
 */
function collectionToPlaylistInfo(c: MediaCollection, ordinal: number): CachedPlaylistInfo {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    images: c.imageUrl ? [{ url: c.imageUrl, height: null, width: null }] : [],
    tracks: c.trackCount != null ? { total: c.trackCount } : null,
    owner: c.ownerName ? { display_name: c.ownerName } : null,
    snapshot_id: c.revision ?? undefined,
    provider: c.provider,
    added_at: getOrSetFirstSeenAddedAtIso(c.provider, `playlist:${c.id}`, ordinal),
  };
}

/**
 * Map a MediaCollection (album/folder kind) to AlbumInfo shape.
 */
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

export function useLibrarySync(): UseLibrarySyncResult {
  const { enabledProviderIds, getDescriptor } = useProviderContext();
  const [playlists, setPlaylists] = useState<CachedPlaylistInfo[]>([]);
  const [albums, setAlbums] = useState<AlbumInfo[]>([]);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [likedSongsPerProvider, setLikedSongsPerProvider] = useState<PerProviderLikedCount[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({
    isInitialLoadComplete: false,
    isSyncing: false,
    lastSyncTimestamp: null,
    error: null,
  });

  const engineRef = useRef(librarySyncEngine);

  // The library sync engine manages one provider (currently Spotify) with IndexedDB cache + polling.
  // All other providers fetch via catalog.listCollections() directly.
  const engineProviderId = librarySyncEngine.providerId as ProviderId | undefined;

  // Per-provider data stored in refs so we can merge without re-fetching all
  const engineDataRef = useRef<{ playlists: CachedPlaylistInfo[]; albums: AlbumInfo[]; likedCount: number }>({
    playlists: [], albums: [], likedCount: 0,
  });
  const catalogDataRef = useRef<Map<ProviderId, { playlists: CachedPlaylistInfo[]; albums: AlbumInfo[]; likedCount: number }>>(new Map());

  const isEngineProviderEnabled = !!engineProviderId && enabledProviderIds.includes(engineProviderId);
  const catalogProviderIds = enabledProviderIds.filter(id => id !== engineProviderId);

  // Merge all provider data into combined state
  const mergeAndSetData = useCallback(() => {
    const allPlaylists: CachedPlaylistInfo[] = [];
    const allAlbums: AlbumInfo[] = [];
    let totalLikedCount = 0;
    const perProvider: PerProviderLikedCount[] = [];

    if (isEngineProviderEnabled && engineProviderId) {
      allPlaylists.push(...engineDataRef.current.playlists);
      allAlbums.push(...engineDataRef.current.albums);
      totalLikedCount += engineDataRef.current.likedCount;
      if (engineDataRef.current.likedCount > 0) {
        perProvider.push({ provider: engineProviderId, count: engineDataRef.current.likedCount });
      }
    }

    for (const [providerId, data] of catalogDataRef.current) {
      if (enabledProviderIds.includes(providerId)) {
        allPlaylists.push(...data.playlists);
        allAlbums.push(...data.albums);
        totalLikedCount += data.likedCount;
        if (data.likedCount > 0) {
          perProvider.push({ provider: providerId, count: data.likedCount });
        }
      }
    }

    setPlaylists(allPlaylists);
    setAlbums(allAlbums);
    setLikedSongsCount(totalLikedCount);
    setLikedSongsPerProvider(perProvider);
  }, [isEngineProviderEnabled, engineProviderId, enabledProviderIds]);

  // ── Engine provider path: delegate to existing sync engine ──────────────
  useEffect(() => {
    if (!isEngineProviderEnabled || !engineProviderId) {
      engineDataRef.current = { playlists: [], albums: [], likedCount: 0 };
      mergeAndSetData();
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
        engineDataRef.current.playlists = newPlaylists.map(p => ({ ...p, provider: epId }));
      }
      if (newAlbums !== undefined) {
        engineDataRef.current.albums = newAlbums.map(a => ({ ...a, provider: epId }));
      }
      if (newLikedCount !== undefined) {
        engineDataRef.current.likedCount = newLikedCount;
      }
      if (newPlaylists !== undefined || newAlbums !== undefined || newLikedCount !== undefined) {
        mergeAndSetData();
      }
    });

    engine.start().catch((err) => {
      console.error('[useLibrarySync] Failed to start sync engine:', err);
    });

    return () => {
      unsubscribe();
    };
  }, [isEngineProviderEnabled, engineProviderId, mergeAndSetData]);

  // ── Catalog providers path: call catalog.listCollections() for each provider not using the sync engine ───
  useEffect(() => {
    if (catalogProviderIds.length === 0) {
      catalogDataRef.current.clear();
      mergeAndSetData();
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadProviderCollections(providerId: ProviderId) {
      const descriptor = getDescriptor(providerId);
      const catalog = descriptor?.catalog;
      const auth = descriptor?.auth;
      if (!catalog || !auth || !auth.isAuthenticated()) {
        catalogDataRef.current.set(providerId, { playlists: [], albums: [], likedCount: 0 });
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

        const { playlists, albums } = splitCollections(collections);
        logLibrary('[%s] after splitCollections — playlists: %o', providerId,
          playlists.map(p => ({ name: p.name, tracks: p.tracks })));
        logLibrary('[%s] after splitCollections — albums: %o', providerId,
          albums.map(a => ({ name: a.name, total_tracks: a.total_tracks })));
        catalogDataRef.current.set(providerId, { playlists, albums, likedCount });
        mergeAndSetData();
        setSyncState(prev => ({
          ...prev,
          isInitialLoadComplete: true,
          isSyncing: false,
          lastSyncTimestamp: Date.now(),
        }));
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error(`[useLibrarySync] Failed to load collections for ${providerId}:`, err);
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
  }, [[...catalogProviderIds].sort().join(','), getDescriptor, mergeAndSetData]);

  // ── Listen for likes-changed events to update count in real-time ──────
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
          const data = catalogDataRef.current.get(providerId);
          if (data) {
            data.likedCount = count;
            mergeAndSetData();
          }
        }).catch(() => {});
      };

      window.addEventListener(eventName, handleLikesChanged);
      cleanups.push(() => window.removeEventListener(eventName, handleLikesChanged));
    }
    return () => cleanups.forEach(cleanup => cleanup());
  }, [[...catalogProviderIds].sort().join(','), getDescriptor, mergeAndSetData]);

  const refreshNow = useCallback(async (scopeProviderId?: ProviderId) => {
    if (!scopeProviderId || scopeProviderId === engineProviderId) {
      if (isEngineProviderEnabled) {
        await engineRef.current.syncNow(true);
      }
    }

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
        const { playlists, albums } = splitCollections(collections);
        catalogDataRef.current.set(providerId, { playlists, albums, likedCount });
        mergeAndSetData();
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
  }, [isEngineProviderEnabled, engineProviderId, catalogProviderIds, getDescriptor, mergeAndSetData]);

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

  const removeCollection = useCallback((collectionId: string) => {
    engineDataRef.current.playlists = engineDataRef.current.playlists.filter(p => p.id !== collectionId);
    engineDataRef.current.albums = engineDataRef.current.albums.filter(a => a.id !== collectionId);

    for (const [, data] of catalogDataRef.current) {
      data.playlists = data.playlists.filter(p => p.id !== collectionId);
      data.albums = data.albums.filter(a => a.id !== collectionId);
    }

    mergeAndSetData();
  }, [mergeAndSetData]);

  return {
    playlists,
    albums,
    likedSongsCount,
    likedSongsPerProvider,
    isInitialLoadComplete: syncState.isInitialLoadComplete,
    isSyncing: syncState.isSyncing,
    lastSyncTimestamp: syncState.lastSyncTimestamp,
    syncError: syncState.error,
    refreshNow,
    removeCollection,
  };
}
