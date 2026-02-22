/**
 * Background sync engine for Spotify library data.
 *
 * Polls Spotify every ~90 seconds with lightweight change detection:
 * 1. Check counts (3 cheap API calls) to detect if anything changed
 * 2. If changes detected, fetch the changed data incrementally
 * 3. Update IndexedDB cache and notify listeners
 *
 * Pauses when the browser tab is hidden, resumes + immediate sync on focus.
 */

import type { AlbumInfo } from '../spotify';
import {
  getPlaylistCount,
  getAlbumCount,
  getLikedSongsCount,
  getPlaylistsPage,
  getAlbumsPage,
  getUserLibraryInterleaved,
  invalidateLikedSongsCaches,
  spotifyAuth,
} from '../spotify';
import * as cache from './libraryCache';
import type {
  CachedPlaylistInfo,
  LibraryChanges,
  SyncState,
  PlaylistsUpdateCallback,
  AlbumsUpdateCallback,
} from './cacheTypes';

const DEFAULT_POLL_INTERVAL_MS = 90 * 1000; // 90 seconds

type SyncListener = (
  state: SyncState,
  playlists?: CachedPlaylistInfo[],
  albums?: AlbumInfo[],
  likedSongsCount?: number,
) => void;

export class LibrarySyncEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<SyncListener>();
  private abortController: AbortController | null = null;
  private pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  private isSyncInProgress = false;

  private state: SyncState = {
    isInitialLoadComplete: false,
    isSyncing: false,
    lastSyncTimestamp: null,
    error: null,
  };

  // =========================================================================
  // Public API
  // =========================================================================

  /** Start the background polling loop and perform initial load. */
  async start(intervalMs?: number): Promise<void> {
    if (this.intervalId) return;

    this.pollIntervalMs = intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    await this.initialLoad();
    this.startPollingInterval();
  }

  /** Stop polling and cancel any in-flight requests. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /** Force an immediate sync cycle. */
  async syncNow(): Promise<void> {
    if (this.isSyncInProgress) return;
    if (!spotifyAuth.isAuthenticated()) return;

    this.isSyncInProgress = true;
    this.abortController = new AbortController();
    this.updateState({ isSyncing: true, error: null });

    try {
      const changes = await this.detectChanges(this.abortController.signal);

      if (changes.playlistsChanged || changes.albumsChanged || changes.likedSongsChanged) {
        await this.applyChanges(changes, this.abortController.signal);
      }

      this.updateState({
        isSyncing: false,
        lastSyncTimestamp: Date.now(),
        error: null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('[librarySyncEngine] Sync failed:', err);
      this.updateState({
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      });
    } finally {
      this.isSyncInProgress = false;
      this.abortController = null;
    }
  }

  /** Subscribe to state and data changes. Returns unsubscribe function. */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current state
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Get current playlists from cache. */
  async getPlaylists(): Promise<CachedPlaylistInfo[]> {
    return cache.getAllPlaylists();
  }

  /** Get current albums from cache. */
  async getAlbums(): Promise<AlbumInfo[]> {
    return cache.getAllAlbums();
  }

  /** Get current state (for testing/debugging). */
  getState(): SyncState {
    return { ...this.state };
  }

  // =========================================================================
  // Initial Load
  // =========================================================================

  private async initialLoad(): Promise<void> {
    // Try to load from IndexedDB cache first (warm start)
    const [cachedPlaylists, cachedAlbums, , likedMeta] = await Promise.all([
      cache.getAllPlaylists(),
      cache.getAllAlbums(),
      cache.getMeta('playlists'),
      cache.getMeta('likedSongs'),
    ]);

    const hasCache = cachedPlaylists.length > 0 || cachedAlbums.length > 0;

    if (hasCache) {
      // Warm start: emit cached data immediately
      this.updateState({ isInitialLoadComplete: true });
      this.notifyListeners(
        cachedPlaylists,
        cachedAlbums,
        likedMeta?.totalCount ?? 0,
      );

      // Then validate cache against Spotify (awaited so start() resolves
      // only after the initial validation is complete)
      await this.syncNow().catch((err) => {
        console.warn('[librarySyncEngine] Background sync after warm start failed:', err);
      });
    } else {
      // Cold start: no cached data, use progressive loading
      await this.coldStartLoad();
    }
  }

  private async coldStartLoad(): Promise<void> {
    if (!spotifyAuth.isAuthenticated()) {
      this.updateState({ isInitialLoadComplete: true });
      return;
    }

    this.updateState({ isSyncing: true });
    this.abortController = new AbortController();

    let allPlaylists: CachedPlaylistInfo[] = [];
    let allAlbums: AlbumInfo[] = [];

    const onPlaylistsUpdate: PlaylistsUpdateCallback = (playlists, isComplete) => {
      allPlaylists = playlists as CachedPlaylistInfo[];
      this.notifyListeners(allPlaylists, allAlbums);
      if (isComplete) {
        // Write to IndexedDB
        cache.putAllPlaylists(allPlaylists).catch(() => {});
        const snapshotIds: Record<string, string> = {};
        for (const p of allPlaylists) {
          if (p.snapshot_id) snapshotIds[p.id] = p.snapshot_id;
        }
        cache.putMeta('playlists', {
          lastValidated: Date.now(),
          totalCount: allPlaylists.length,
          snapshotIds,
        }).catch(() => {});
      }
    };

    const onAlbumsUpdate: AlbumsUpdateCallback = (albums, isComplete) => {
      allAlbums = albums;
      this.notifyListeners(allPlaylists, allAlbums);
      if (isComplete) {
        cache.putAllAlbums(allAlbums).catch(() => {});
        const latestAddedAt = allAlbums.reduce(
          (latest, a) => (a.added_at && a.added_at > latest ? a.added_at : latest),
          '',
        );
        cache.putMeta('albums', {
          lastValidated: Date.now(),
          totalCount: allAlbums.length,
          latestAddedAt: latestAddedAt || undefined,
        }).catch(() => {});
      }
    };

    try {
      // Also fetch liked songs count
      const likedCountPromise = getLikedSongsCount(this.abortController.signal).catch(() => 0);

      await getUserLibraryInterleaved(
        onPlaylistsUpdate,
        onAlbumsUpdate,
        this.abortController.signal,
      );

      const likedCount = await likedCountPromise;
      cache.putMeta('likedSongs', {
        lastValidated: Date.now(),
        totalCount: likedCount,
      }).catch(() => {});

      this.updateState({
        isInitialLoadComplete: true,
        isSyncing: false,
        lastSyncTimestamp: Date.now(),
      });
      this.notifyListeners(allPlaylists, allAlbums, likedCount);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('[librarySyncEngine] Cold start load failed:', err);
      this.updateState({
        isInitialLoadComplete: true, // Mark complete even on error so UI isn't stuck loading
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Failed to load library',
      });
    } finally {
      this.abortController = null;
    }
  }

  // =========================================================================
  // Change Detection
  // =========================================================================

  private async detectChanges(signal: AbortSignal): Promise<LibraryChanges> {
    const [playlistsMeta, albumsMeta, likedMeta] = await Promise.all([
      cache.getMeta('playlists'),
      cache.getMeta('albums'),
      cache.getMeta('likedSongs'),
    ]);

    // Fetch current counts from Spotify (3 lightweight API calls)
    const [newPlaylistCount, newAlbumCount, newLikedSongsCount] = await Promise.all([
      getPlaylistCount(signal),
      getAlbumCount(signal),
      getLikedSongsCount(signal),
    ]);

    const playlistsChanged = newPlaylistCount !== (playlistsMeta?.totalCount ?? -1);
    const albumsChanged = newAlbumCount !== (albumsMeta?.totalCount ?? -1);
    const likedSongsChanged = newLikedSongsCount !== (likedMeta?.totalCount ?? -1);

    return {
      playlistsChanged,
      albumsChanged,
      likedSongsChanged,
      changedPlaylistIds: [], // Will be populated in applyChanges if needed
      newPlaylistCount,
      newAlbumCount,
      newLikedSongsCount,
    };
  }

  // =========================================================================
  // Incremental Updates
  // =========================================================================

  private async applyChanges(changes: LibraryChanges, signal: AbortSignal): Promise<void> {
    let updatedPlaylists: CachedPlaylistInfo[] | undefined;
    let updatedAlbums: AlbumInfo[] | undefined;

    if (changes.playlistsChanged) {
      updatedPlaylists = await this.syncPlaylists(changes.newPlaylistCount, signal);
    }

    if (changes.albumsChanged) {
      updatedAlbums = await this.syncAlbums(changes.newAlbumCount, signal);
    }

    if (changes.likedSongsChanged) {
      // Invalidate liked songs caches so next access triggers fresh fetch
      invalidateLikedSongsCaches();
      await cache.putMeta('likedSongs', {
        lastValidated: Date.now(),
        totalCount: changes.newLikedSongsCount,
      });
    }

    // Notify listeners with updated data
    const playlists = updatedPlaylists ?? await cache.getAllPlaylists();
    const albums = updatedAlbums ?? await cache.getAllAlbums();
    this.notifyListeners(playlists, albums, changes.newLikedSongsCount);
  }

  // getPlaylistsPage only fetches from offset 0; libraries > 50 playlists get a partial sync
  private async syncPlaylists(newTotal: number, signal: AbortSignal): Promise<CachedPlaylistInfo[]> {
    const [cachedPlaylists, meta] = await Promise.all([
      cache.getAllPlaylists(),
      cache.getMeta('playlists'),
    ]);

    const cachedMap = new Map<string, CachedPlaylistInfo>(
      cachedPlaylists.map(p => [p.id, p])
    );

    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    const { playlists } = await getPlaylistsPage(50, signal);
    const allFetched = playlists as CachedPlaylistInfo[];

    const fetchTimestamp = new Date().toISOString();
    for (const p of allFetched) {
      const cached = cachedMap.get(p.id);
      p.added_at = cached?.added_at || p.added_at || fetchTimestamp;
    }

    const fetchedIds = new Set(allFetched.map(p => p.id));
    const snapshotIds: Record<string, string> = { ...(meta?.snapshotIds ?? {}) };

    for (const cached of cachedPlaylists) {
      if (!fetchedIds.has(cached.id)) {
        await cache.removePlaylist(cached.id);
        await cache.removeTrackList(`playlist:${cached.id}`);
        delete snapshotIds[cached.id];
      }
    }

    for (const fetched of allFetched) {
      const cached = cachedMap.get(fetched.id);
      if (cached && fetched.snapshot_id && fetched.snapshot_id !== cached.snapshot_id) {
        await cache.removeTrackList(`playlist:${fetched.id}`);
      }
      await cache.putPlaylist(fetched);
      if (fetched.snapshot_id) {
        snapshotIds[fetched.id] = fetched.snapshot_id;
      }
    }

    await cache.putMeta('playlists', {
      lastValidated: Date.now(),
      totalCount: newTotal,
      snapshotIds,
    });

    return allFetched;
  }

  // getAlbumsPage only fetches from offset 0; libraries > 50 albums get a partial sync
  private async syncAlbums(newTotal: number, signal: AbortSignal): Promise<AlbumInfo[]> {
    const cachedAlbums = await cache.getAllAlbums();
    const { albums: allFetched } = await getAlbumsPage(50, signal);

    const fetchedIds = new Set(allFetched.map(a => a.id));

    for (const cached of cachedAlbums) {
      if (!fetchedIds.has(cached.id)) {
        await cache.removeAlbum(cached.id);
        await cache.removeTrackList(`album:${cached.id}`);
      }
    }

    for (const fetched of allFetched) {
      await cache.putAlbum(fetched);
    }

    const latestAddedAt = allFetched.reduce(
      (latest, a) => (a.added_at && a.added_at > latest ? a.added_at : latest),
      '',
    );
    await cache.putMeta('albums', {
      lastValidated: Date.now(),
      totalCount: newTotal,
      latestAddedAt: latestAddedAt || undefined,
    });

    return allFetched;
  }

  // =========================================================================
  // Internal Helpers
  // =========================================================================

  private startPollingInterval(): void {
    this.intervalId = setInterval(() => {
      this.syncNow().catch((err) => {
        console.warn('[librarySyncEngine] Background sync error:', err);
      });
    }, this.pollIntervalMs);
  }

  private updateState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
  }

  private notifyListeners(
    playlists?: CachedPlaylistInfo[],
    albums?: AlbumInfo[],
    likedSongsCount?: number,
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state, playlists, albums, likedSongsCount);
      } catch (err) {
        console.warn('[librarySyncEngine] Listener error:', err);
      }
    }
  }

  private handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    } else {
      if (!this.intervalId) {
        this.startPollingInterval();
      }
      this.syncNow().catch((err) => {
        console.warn('[librarySyncEngine] Sync on focus failed:', err);
      });
    }
  };
}

/** Singleton instance for app-wide use. */
export const librarySyncEngine = new LibrarySyncEngine();
