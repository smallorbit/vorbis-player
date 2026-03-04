/**
 * React hook that connects the LibrarySyncEngine to component state.
 *
 * Provider-aware: when Spotify is active, delegates to the Spotify-specific
 * LibrarySyncEngine (with IndexedDB cache and background polling). When
 * another provider is active, calls catalog.listCollections() directly.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { librarySyncEngine } from '../services/cache/librarySyncEngine';
import type { CachedPlaylistInfo, SyncState } from '../services/cache/cacheTypes';
import type { AlbumInfo } from '../services/spotify';
import { useProviderContext } from '../contexts/ProviderContext';
import type { MediaCollection } from '../types/domain';
import { LIKES_CHANGED_EVENT } from '../providers/dropbox/dropboxLikesCache';

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
  };
}

export function useLibrarySync(): UseLibrarySyncResult {
  const { activeProviderId, activeDescriptor } = useProviderContext();
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

  // ── Spotify path: delegate to existing sync engine ─────────────────────
  useEffect(() => {
    if (activeProviderId !== 'spotify') return;

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
    };
  }, [activeProviderId]);

  // ── Non-Spotify path: call catalog.listCollections() ───────────────────
  useEffect(() => {
    if (activeProviderId === 'spotify') return;

    const catalog = activeDescriptor?.catalog;
    const auth = activeDescriptor?.auth;
    if (!catalog || !auth) return;

    if (!auth.isAuthenticated()) {
      setSyncState({
        isInitialLoadComplete: true,
        isSyncing: false,
        lastSyncTimestamp: null,
        error: null,
      });
      setPlaylists([]);
      setAlbums([]);
      setLikedSongsCount(0);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadCollections() {
      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));

      const { getCachedCatalog, putCatalogCache } = await import('@/providers/dropbox/dropboxCatalogCache');
      const cached = await getCachedCatalog();

      // Always fetch liked count (it's local IndexedDB, so fast)
      if (catalog!.getLikedCount && !cancelled) {
        const likedCount = await catalog!.getLikedCount(controller.signal);
        if (!cancelled) setLikedSongsCount(likedCount);
      }

      if (cached && !cancelled) {
        const playlistItems: CachedPlaylistInfo[] = [];
        const albumItems: AlbumInfo[] = [];
        for (const c of cached.collections) {
          if (c.kind === 'album') albumItems.push(collectionToAlbumInfo(c));
          else playlistItems.push(collectionToPlaylistInfo(c));
        }
        setPlaylists(playlistItems);
        setAlbums(albumItems);
        setSyncState({
          isInitialLoadComplete: true,
          isSyncing: cached.isStale,
          lastSyncTimestamp: cached.cachedAt,
          error: null,
        });
        if (!cached.isStale) return;
      }

      try {
        const collections = await catalog!.listCollections(controller.signal);
        if (cancelled) return;

        const playlistItems: CachedPlaylistInfo[] = [];
        const albumItems: AlbumInfo[] = [];
        for (const c of collections) {
          if (c.kind === 'album') albumItems.push(collectionToAlbumInfo(c));
          else playlistItems.push(collectionToPlaylistInfo(c));
        }
        setPlaylists(playlistItems);
        setAlbums(albumItems);

        setSyncState({
          isInitialLoadComplete: true,
          isSyncing: false,
          lastSyncTimestamp: Date.now(),
          error: null,
        });
        putCatalogCache(collections);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[useLibrarySync] Failed to load collections:', err);
        setSyncState({
          isInitialLoadComplete: true,
          isSyncing: false,
          lastSyncTimestamp: null,
          error: err instanceof Error ? err.message : 'Failed to load library',
        });
      }
    }

    loadCollections();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeProviderId, activeDescriptor]);

  // ── Listen for likes-changed events to update count in real-time ──────
  useEffect(() => {
    if (activeProviderId === 'spotify') return;
    const catalog = activeDescriptor?.catalog;
    if (!catalog?.getLikedCount) return;

    const handleLikesChanged = () => {
      catalog.getLikedCount!().then(setLikedSongsCount).catch(() => {});
    };

    window.addEventListener(LIKES_CHANGED_EVENT, handleLikesChanged);
    return () => window.removeEventListener(LIKES_CHANGED_EVENT, handleLikesChanged);
  }, [activeProviderId, activeDescriptor]);

  const refreshNow = useCallback(async () => {
    if (activeProviderId === 'spotify') {
      await engineRef.current.syncNow();
    } else {
      // For non-Spotify providers, the effect above handles loading.
      // A refresh re-triggers by bumping syncState so the effect re-runs isn't
      // needed since the effect depends on activeDescriptor which is stable.
      // Instead, directly call listCollections here.
      const catalog = activeDescriptor?.catalog;
      if (!catalog) return;
      setSyncState(prev => ({ ...prev, isSyncing: true, error: null }));
      try {
        const collections = await catalog.listCollections();
        const playlistItems: CachedPlaylistInfo[] = [];
        const albumItems: AlbumInfo[] = [];
        for (const c of collections) {
          if (c.kind === 'album') {
            albumItems.push(collectionToAlbumInfo(c));
          } else {
            playlistItems.push(collectionToPlaylistInfo(c));
          }
        }
        setPlaylists(playlistItems);
        setAlbums(albumItems);
        setSyncState({
          isInitialLoadComplete: true,
          isSyncing: false,
          lastSyncTimestamp: Date.now(),
          error: null,
        });
        import('@/providers/dropbox/dropboxCatalogCache').then(m => m.putCatalogCache(collections));
      } catch (err) {
        setSyncState(prev => ({
          ...prev,
          isSyncing: false,
          error: err instanceof Error ? err.message : 'Refresh failed',
        }));
      }
    }
  }, [activeProviderId, activeDescriptor]);

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
