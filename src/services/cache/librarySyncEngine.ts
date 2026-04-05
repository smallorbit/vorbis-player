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
  getUserLibraryInterleaved,
  spotifyAuth,
} from '../spotify';
import * as cache from './libraryCache';
import { detectChanges, applyChanges } from './libraryDiffEngine';
import { writeLikedCountSnapshot } from './likedCountSnapshot';
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

const OPTIMISTIC_GRACE_MS = 30 * 1000;

export class LibrarySyncEngine {
  readonly providerId = 'spotify';
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

  // Last-known data, kept in memory so new subscribers get data immediately
  // instead of seeing an empty state while IndexedDB is read asynchronously.
  private lastKnownPlaylists: CachedPlaylistInfo[] | undefined;
  private lastKnownAlbums: AlbumInfo[] | undefined;
  private lastKnownLikedCount: number | undefined;

  // Optimistic mutations: album IDs that were recently added/removed locally.
  // Background syncs respect these during the grace period so stale API
  // responses don't overwrite the user's action.
  private pendingRemovals = new Map<string, number>();
  private pendingAdditions = new Map<string, number>();

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

  /** Force an immediate sync cycle. When force is true, skip change detection and re-fetch everything. */
  async syncNow(force = false): Promise<void> {
    if (this.isSyncInProgress) return;
    if (!spotifyAuth.isAuthenticated()) return;

    this.isSyncInProgress = true;
    this.abortController = new AbortController();
    this.updateState({ isSyncing: true, error: null });

    try {
      if (force) {
        const signal = this.abortController.signal;
        const allChanges: LibraryChanges = {
          playlistsChanged: true,
          albumsChanged: true,
          likedSongsChanged: true,
          changedPlaylistIds: [],
          newPlaylistCount: await getPlaylistCount(signal),
          newAlbumCount: await getAlbumCount(signal),
          newLikedSongsCount: await getLikedSongsCount(signal),
        };
        const result = await applyChanges(allChanges, signal, this.pendingRemovals, this.pendingAdditions);
        this.notifyListeners(result.playlists, result.albums, result.likedSongsCount);
      } else {
        const changes = await detectChanges(this.abortController.signal);

        if (changes.playlistsChanged || changes.albumsChanged || changes.likedSongsChanged) {
          const result = await applyChanges(changes, this.abortController.signal, this.pendingRemovals, this.pendingAdditions);
          this.notifyListeners(result.playlists, result.albums, result.likedSongsCount);
        }
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
    // Immediately emit current state AND last-known data so new subscribers
    // (e.g. when LibraryDrawer reopens and remounts PlaylistSelection) don't
    // see an empty list while isInitialLoadComplete is already true.
    listener(this.state, this.lastKnownPlaylists, this.lastKnownAlbums, this.lastKnownLikedCount);
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

  /** Optimistically remove an album from cache and notify listeners immediately. */
  async optimisticRemoveAlbum(albumId: string): Promise<void> {
    this.pendingRemovals.set(albumId, Date.now());
    this.pendingAdditions.delete(albumId);
    await cache.removeAlbum(albumId);
    await cache.removeTrackList(`album:${albumId}`);
    const meta = await cache.getMeta('albums');
    if (meta) {
      await cache.putMeta('albums', {
        ...meta,
        totalCount: Math.max(0, (meta.totalCount ?? 1) - 1),
      });
    }
    const albums = await cache.getAllAlbums();
    this.notifyListeners(undefined, albums, undefined);
  }

  /** Optimistically add an album to cache and notify listeners immediately. */
  async optimisticAddAlbum(album: AlbumInfo): Promise<void> {
    this.pendingAdditions.set(album.id, Date.now());
    this.pendingRemovals.delete(album.id);
    await cache.putAlbum(album);
    const meta = await cache.getMeta('albums');
    await cache.putMeta('albums', {
      lastValidated: meta?.lastValidated ?? Date.now(),
      totalCount: (meta?.totalCount ?? 0) + 1,
      latestAddedAt: album.added_at ?? meta?.latestAddedAt,
    });
    const albums = await cache.getAllAlbums();
    this.notifyListeners(undefined, albums, undefined);
  }

  /** Get current state (for testing/debugging). */
  getState(): SyncState {
    return { ...this.state };
  }

  // =========================================================================
  // Initial Load
  // =========================================================================

  private async initialLoad(): Promise<void> {
    const [cachedPlaylists, cachedAlbums, , likedMeta] = await Promise.all([
      cache.getAllPlaylists(),
      cache.getAllAlbums(),
      cache.getMeta('playlists'),
      cache.getMeta('likedSongs'),
    ]);

    const hasCache = cachedPlaylists.length > 0 || cachedAlbums.length > 0;

    if (hasCache) {
      this.updateState({ isInitialLoadComplete: true });
      this.notifyListeners(
        cachedPlaylists,
        cachedAlbums,
        likedMeta?.totalCount ?? 0,
      );

      await this.syncNow().catch((err) => {
        console.warn('[librarySyncEngine] Background sync after warm start failed:', err);
      });
    } else {
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
        isInitialLoadComplete: true,
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Failed to load library',
      });
    } finally {
      this.abortController = null;
    }
  }

  // =========================================================================
  // Internal Helpers
  // =========================================================================

  private expirePendingMutations(now: number): void {
    for (const [id, ts] of this.pendingRemovals) {
      if (now - ts > OPTIMISTIC_GRACE_MS) this.pendingRemovals.delete(id);
    }
    for (const [id, ts] of this.pendingAdditions) {
      if (now - ts > OPTIMISTIC_GRACE_MS) this.pendingAdditions.delete(id);
    }
  }

  private startPollingInterval(): void {
    this.intervalId = setInterval(() => {
      this.expirePendingMutations(Date.now());
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
    if (playlists !== undefined) this.lastKnownPlaylists = playlists;
    if (albums !== undefined) this.lastKnownAlbums = albums;
    if (likedSongsCount !== undefined) {
      this.lastKnownLikedCount = likedSongsCount;
      writeLikedCountSnapshot(this.providerId as 'spotify', likedSongsCount);
    }

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
