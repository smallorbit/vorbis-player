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
import { LIKES_CHANGED_EVENT } from '../providers/dropbox/dropboxLikesCache';

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
}

/**
 * Map a MediaCollection to CachedPlaylistInfo shape so the library UI can
 * render it regardless of provider.
 */
function collectionToPlaylistInfo(c: MediaCollection): CachedPlaylistInfo {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    images: c.imageUrl ? [{ url: c.imageUrl, height: null, width: null }] : [],
    tracks: c.trackCount != null ? { total: c.trackCount } : null,
    owner: c.ownerName ? { display_name: c.ownerName } : null,
    snapshot_id: c.revision ?? undefined,
    provider: c.provider,
  };
}

/**
 * Map a MediaCollection (album/folder kind) to AlbumInfo shape.
 */
function collectionToAlbumInfo(c: MediaCollection): AlbumInfo {
  return {
    id: c.id,
    name: c.name,
    artists: c.ownerName ?? '',
    images: c.imageUrl ? [{ url: c.imageUrl, height: null, width: null }] : [],
    release_date: '',
    total_tracks: c.trackCount ?? 0,
    uri: '',
    album_type: c.kind === 'folder' ? 'folder' : 'album',
    provider: c.provider,
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

  // Per-provider data stored in refs so we can merge without re-fetching all
  const spotifyDataRef = useRef<{ playlists: CachedPlaylistInfo[]; albums: AlbumInfo[]; likedCount: number }>({
    playlists: [], albums: [], likedCount: 0,
  });
  const nonSpotifyDataRef = useRef<Map<ProviderId, { playlists: CachedPlaylistInfo[]; albums: AlbumInfo[]; likedCount: number }>>(new Map());

  const isSpotifyEnabled = enabledProviderIds.includes('spotify');
  const nonSpotifyEnabledIds = enabledProviderIds.filter(id => id !== 'spotify');

  // Merge all provider data into combined state
  const mergeAndSetData = useCallback(() => {
    const allPlaylists: CachedPlaylistInfo[] = [];
    const allAlbums: AlbumInfo[] = [];
    let totalLikedCount = 0;
    const perProvider: PerProviderLikedCount[] = [];

    if (isSpotifyEnabled) {
      allPlaylists.push(...spotifyDataRef.current.playlists);
      allAlbums.push(...spotifyDataRef.current.albums);
      totalLikedCount += spotifyDataRef.current.likedCount;
      if (spotifyDataRef.current.likedCount > 0) {
        perProvider.push({ provider: 'spotify', count: spotifyDataRef.current.likedCount });
      }
    }

    for (const [providerId, data] of nonSpotifyDataRef.current) {
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
  }, [isSpotifyEnabled, enabledProviderIds]);

  // ── Spotify path: delegate to existing sync engine ─────────────────────
  useEffect(() => {
    if (!isSpotifyEnabled) {
      spotifyDataRef.current = { playlists: [], albums: [], likedCount: 0 };
      mergeAndSetData();
      return;
    }

    const engine = engineRef.current;

    const unsubscribe = engine.subscribe((state, newPlaylists, newAlbums, newLikedCount) => {
      setSyncState(prev => ({
        ...prev,
        ...state,
        // Keep isInitialLoadComplete true once any provider has loaded
        isInitialLoadComplete: prev.isInitialLoadComplete || state.isInitialLoadComplete,
      }));
      if (newPlaylists !== undefined) {
        // Tag spotify playlists with provider
        spotifyDataRef.current.playlists = newPlaylists.map(p => ({ ...p, provider: 'spotify' as ProviderId }));
      }
      if (newAlbums !== undefined) {
        spotifyDataRef.current.albums = newAlbums.map(a => ({ ...a, provider: 'spotify' as ProviderId }));
      }
      if (newLikedCount !== undefined) {
        spotifyDataRef.current.likedCount = newLikedCount;
      }
      mergeAndSetData();
    });

    engine.start().catch((err) => {
      console.error('[useLibrarySync] Failed to start sync engine:', err);
    });

    return () => {
      unsubscribe();
    };
  }, [isSpotifyEnabled, mergeAndSetData]);

  // ── Non-Spotify path: call catalog.listCollections() for each enabled non-Spotify provider ───
  useEffect(() => {
    if (nonSpotifyEnabledIds.length === 0) {
      nonSpotifyDataRef.current.clear();
      mergeAndSetData();
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadProviderCollections(providerId: ProviderId) {
      const descriptor = getDescriptor(providerId);
      const catalog = descriptor?.catalog;
      const auth = descriptor?.auth;
      if (!catalog || !auth) return;

      if (!auth.isAuthenticated()) {
        nonSpotifyDataRef.current.set(providerId, { playlists: [], albums: [], likedCount: 0 });
        return;
      }

      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

      // Fetch liked count (local IndexedDB, so fast)
      let likedCount = 0;
      if (catalog.getLikedCount && !cancelled) {
        likedCount = await catalog.getLikedCount(controller.signal);
      }

      // Try cache first for this provider
      let usedCache = false;
      if (providerId === 'dropbox') {
        try {
          const { getCachedCatalog, putCatalogCache } = await import('@/providers/dropbox/dropboxCatalogCache');
          const cached = await getCachedCatalog();

          if (cached && !cancelled) {
            const playlistItems: CachedPlaylistInfo[] = [];
            const albumItems: AlbumInfo[] = [];
            for (const c of cached.collections) {
              if (c.kind === 'album') albumItems.push(collectionToAlbumInfo(c));
              else playlistItems.push(collectionToPlaylistInfo(c));
            }
            nonSpotifyDataRef.current.set(providerId, { playlists: playlistItems, albums: albumItems, likedCount });
            mergeAndSetData();

            if (!cached.isStale) {
              setSyncState(prev => ({
                ...prev,
                isInitialLoadComplete: true,
                isSyncing: false,
                lastSyncTimestamp: cached.cachedAt,
              }));
              usedCache = true;
            }
          }

          if (!usedCache) {
            const collections = await catalog.listCollections(controller.signal);
            if (cancelled) return;

            const playlistItems: CachedPlaylistInfo[] = [];
            const albumItems: AlbumInfo[] = [];
            for (const c of collections) {
              if (c.kind === 'album') albumItems.push(collectionToAlbumInfo(c));
              else playlistItems.push(collectionToPlaylistInfo(c));
            }
            nonSpotifyDataRef.current.set(providerId, { playlists: playlistItems, albums: albumItems, likedCount });
            mergeAndSetData();
            setSyncState(prev => ({
              ...prev,
              isInitialLoadComplete: true,
              isSyncing: false,
              lastSyncTimestamp: Date.now(),
            }));
            putCatalogCache(collections);
          }
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
      } else {
        // Generic non-Spotify, non-Dropbox provider
        try {
          const collections = await catalog.listCollections(controller.signal);
          if (cancelled) return;

          const playlistItems: CachedPlaylistInfo[] = [];
          const albumItems: AlbumInfo[] = [];
          for (const c of collections) {
            if (c.kind === 'album') albumItems.push(collectionToAlbumInfo(c));
            else playlistItems.push(collectionToPlaylistInfo(c));
          }
          nonSpotifyDataRef.current.set(providerId, { playlists: playlistItems, albums: albumItems, likedCount });
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
        }
      }
    }

    // Load all non-Spotify providers in parallel
    Promise.all(nonSpotifyEnabledIds.map(loadProviderCollections)).catch(() => {});

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [nonSpotifyEnabledIds.join(','), getDescriptor, mergeAndSetData]);

  // ── Listen for likes-changed events to update count in real-time ──────
  useEffect(() => {
    // Only relevant for non-Spotify providers with getLikedCount
    const handlers: Array<() => void> = [];
    for (const providerId of nonSpotifyEnabledIds) {
      const descriptor = getDescriptor(providerId);
      const catalog = descriptor?.catalog;
      if (!catalog?.getLikedCount) continue;

      const handleLikesChanged = () => {
        catalog.getLikedCount!().then(count => {
          const data = nonSpotifyDataRef.current.get(providerId);
          if (data) {
            data.likedCount = count;
            mergeAndSetData();
          }
        }).catch(() => {});
      };

      window.addEventListener(LIKES_CHANGED_EVENT, handleLikesChanged);
      handlers.push(() => window.removeEventListener(LIKES_CHANGED_EVENT, handleLikesChanged));
    }
    return () => handlers.forEach(cleanup => cleanup());
  }, [nonSpotifyEnabledIds.join(','), getDescriptor, mergeAndSetData]);

  const refreshNow = useCallback(async () => {
    // Refresh Spotify
    if (isSpotifyEnabled) {
      await engineRef.current.syncNow();
    }

    // Refresh non-Spotify providers
    for (const providerId of nonSpotifyEnabledIds) {
      const descriptor = getDescriptor(providerId);
      const catalog = descriptor?.catalog;
      if (!catalog) continue;

      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));
      try {
        const collections = await catalog.listCollections();
        const playlistItems: CachedPlaylistInfo[] = [];
        const albumItems: AlbumInfo[] = [];
        for (const c of collections) {
          if (c.kind === 'album') albumItems.push(collectionToAlbumInfo(c));
          else playlistItems.push(collectionToPlaylistInfo(c));
        }
        let likedCount = 0;
        if (catalog.getLikedCount) {
          likedCount = await catalog.getLikedCount();
        }
        nonSpotifyDataRef.current.set(providerId, { playlists: playlistItems, albums: albumItems, likedCount });
        mergeAndSetData();
        setSyncState(prev => ({
          ...prev,
          isInitialLoadComplete: true,
          isSyncing: false,
          lastSyncTimestamp: Date.now(),
        }));
        if (providerId === 'dropbox') {
          import('@/providers/dropbox/dropboxCatalogCache').then(m => m.putCatalogCache(collections));
        }
      } catch (err) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Refresh failed',
        }));
      }
    }
  }, [isSpotifyEnabled, nonSpotifyEnabledIds, getDescriptor, mergeAndSetData]);

  useEffect(() => {
    const handleRefresh = () => { refreshNow().catch(() => {}); };
    window.addEventListener(ART_REFRESHED_EVENT, handleRefresh);
    window.addEventListener(LIBRARY_REFRESH_EVENT, handleRefresh);
    return () => {
      window.removeEventListener(ART_REFRESHED_EVENT, handleRefresh);
      window.removeEventListener(LIBRARY_REFRESH_EVENT, handleRefresh);
    };
  }, [refreshNow]);

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
  };
}
