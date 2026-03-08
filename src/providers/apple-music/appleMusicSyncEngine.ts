/**
 * Background sync engine for Apple Music library data.
 *
 * Mirrors the Spotify LibrarySyncEngine pattern:
 * 1. Warm start: load cached data from IndexedDB, emit immediately
 * 2. Cold start: fetch from API with interleaved pagination, emit progressively
 * 3. Background polling: lightweight count checks every ~90s to detect changes
 * 4. Pauses when tab is hidden, syncs immediately on focus
 */

import type { MediaCollection } from '@/types/domain';
import { appleMusicService } from './appleMusicService';
import { AppleMusicCatalogAdapter } from './appleMusicCatalogAdapter';
import * as cache from './appleMusicCache';

const DEFAULT_POLL_INTERVAL_MS = 90_000;
const PAGE_LIMIT = 100;

export interface AppleMusicSyncState {
  isInitialLoadComplete: boolean;
  isSyncing: boolean;
  lastSyncTimestamp: number | null;
  error: string | null;
}

type SyncListener = (
  state: AppleMusicSyncState,
  playlists?: MediaCollection[],
  albums?: MediaCollection[],
  likedSongsCount?: number,
) => void;

export class AppleMusicSyncEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<SyncListener>();
  private abortController: AbortController | null = null;
  private pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  private isSyncInProgress = false;
  private catalogAdapter = new AppleMusicCatalogAdapter();

  private state: AppleMusicSyncState = {
    isInitialLoadComplete: false,
    isSyncing: false,
    lastSyncTimestamp: null,
    error: null,
  };

  private lastKnownPlaylists: MediaCollection[] | undefined;
  private lastKnownAlbums: MediaCollection[] | undefined;
  private lastKnownLikedCount: number | undefined;

  async start(intervalMs?: number): Promise<void> {
    if (this.intervalId) return;
    this.pollIntervalMs = intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    await this.initialLoad();
    this.startPollingInterval();
  }

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

  async syncNow(): Promise<void> {
    if (this.isSyncInProgress) return;
    if (!appleMusicService.isAuthorized()) return;

    this.isSyncInProgress = true;
    this.abortController = new AbortController();
    this.updateState({ isSyncing: true, error: null });

    try {
      const changed = await this.detectChanges(this.abortController.signal);

      if (changed) {
        await this.fullRefresh(this.abortController.signal);
      }

      this.updateState({
        isSyncing: false,
        lastSyncTimestamp: Date.now(),
        error: null,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.warn('[appleMusicSyncEngine] Sync failed:', err);
      this.updateState({
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      });
    } finally {
      this.isSyncInProgress = false;
      this.abortController = null;
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state, this.lastKnownPlaylists, this.lastKnownAlbums, this.lastKnownLikedCount);
    return () => { this.listeners.delete(listener); };
  }

  getState(): AppleMusicSyncState {
    return { ...this.state };
  }

  // ── Initial Load ──────────────────────────────────────────────────────

  private async initialLoad(): Promise<void> {
    const [cachedPlaylists, cachedAlbums, likedMeta] = await Promise.all([
      cache.getAllPlaylists(),
      cache.getAllAlbums(),
      cache.getMeta('likedSongs'),
    ]);

    const hasCache = cachedPlaylists.length > 0 || cachedAlbums.length > 0;

    if (hasCache) {
      this.updateState({ isInitialLoadComplete: true });
      this.notifyListeners(cachedPlaylists, cachedAlbums, likedMeta?.totalCount ?? 0);

      await this.syncNow().catch((err) => {
        console.warn('[appleMusicSyncEngine] Background sync after warm start failed:', err);
      });
    } else {
      await this.coldStartLoad();
    }
  }

  private async coldStartLoad(): Promise<void> {
    if (!appleMusicService.isAuthorized()) {
      this.updateState({ isInitialLoadComplete: true });
      return;
    }

    this.updateState({ isSyncing: true });
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const instance = await appleMusicService.ensureLoaded();

      const allPlaylists: MediaCollection[] = [];
      const allAlbums: MediaCollection[] = [];

      // Interleaved loading: fetch one page of playlists, then one page of albums
      let playlistOffset = 0;
      let albumOffset = 0;
      let playlistsDone = false;
      let albumsDone = false;

      while (!playlistsDone || !albumsDone) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        if (!playlistsDone) {
          const page = await this.fetchPage(instance, '/v1/me/library/playlists', playlistOffset, signal);
          for (const item of page.items) {
            allPlaylists.push(this.toCollection(item, 'playlist'));
          }
          this.notifyListeners(allPlaylists, allAlbums);
          if (!page.hasMore) {
            playlistsDone = true;
            cache.putAllPlaylists(allPlaylists).catch(() => {});
            cache.putMeta('playlists', {
              lastValidated: Date.now(),
              totalCount: allPlaylists.length,
            }).catch(() => {});
          }
          playlistOffset += PAGE_LIMIT;
        }

        if (!albumsDone) {
          const page = await this.fetchPage(instance, '/v1/me/library/albums', albumOffset, signal);
          for (const item of page.items) {
            allAlbums.push(this.toCollection(item, 'album'));
          }
          this.notifyListeners(allPlaylists, allAlbums);
          if (!page.hasMore) {
            albumsDone = true;
            cache.putAllAlbums(allAlbums).catch(() => {});
            cache.putMeta('albums', {
              lastValidated: Date.now(),
              totalCount: allAlbums.length,
            }).catch(() => {});
          }
          albumOffset += PAGE_LIMIT;
        }
      }

      const likedCount = await this.catalogAdapter.getLikedCount(signal).catch(() => 0);
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
      console.error('[appleMusicSyncEngine] Cold start load failed:', err);
      this.updateState({
        isInitialLoadComplete: true,
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Failed to load library',
      });
    } finally {
      this.abortController = null;
    }
  }

  // ── Change Detection ──────────────────────────────────────────────────

  private async detectChanges(signal: AbortSignal): Promise<boolean> {
    const [playlistsMeta, albumsMeta, likedMeta] = await Promise.all([
      cache.getMeta('playlists'),
      cache.getMeta('albums'),
      cache.getMeta('likedSongs'),
    ]);

    const instance = await appleMusicService.ensureLoaded();

    const [newPlaylistCount, newAlbumCount, newLikedCount] = await Promise.all([
      this.fetchCount(instance, '/v1/me/library/playlists', signal),
      this.fetchCount(instance, '/v1/me/library/albums', signal),
      this.catalogAdapter.getLikedCount(signal).catch(() => 0),
    ]);

    const playlistsChanged = newPlaylistCount !== (playlistsMeta?.totalCount ?? -1);
    const albumsChanged = newAlbumCount !== (albumsMeta?.totalCount ?? -1);
    const likedChanged = newLikedCount !== (likedMeta?.totalCount ?? -1);

    if (likedChanged) {
      cache.putMeta('likedSongs', {
        lastValidated: Date.now(),
        totalCount: newLikedCount,
      }).catch(() => {});
      this.notifyListeners(undefined, undefined, newLikedCount);
    }

    return playlistsChanged || albumsChanged;
  }

  private async fullRefresh(signal: AbortSignal): Promise<void> {
    const collections = await this.catalogAdapter.listCollections(signal);

    const playlists = collections.filter(c => c.kind === 'playlist');
    const albums = collections.filter(c => c.kind === 'album');

    await Promise.all([
      cache.putAllPlaylists(playlists),
      cache.putAllAlbums(albums),
      cache.putMeta('playlists', { lastValidated: Date.now(), totalCount: playlists.length }),
      cache.putMeta('albums', { lastValidated: Date.now(), totalCount: albums.length }),
    ]);

    const likedCount = await this.catalogAdapter.getLikedCount(signal).catch(() => 0);
    cache.putMeta('likedSongs', { lastValidated: Date.now(), totalCount: likedCount }).catch(() => {});

    this.notifyListeners(playlists, albums, likedCount);
  }

  // ── API Helpers ───────────────────────────────────────────────────────

  private async fetchCount(
    instance: import('./appleMusicTypes').MKInstance,
    path: string,
    signal: AbortSignal,
  ): Promise<number> {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const response = await instance.api.music(`${path}?limit=1&offset=0`);
      const data = response.data as import('./appleMusicTypes').MKPaginatedResponse<unknown>;
      return data.meta?.total ?? data.data.length;
    } catch {
      return -1;
    }
  }

  private async fetchPage(
    instance: import('./appleMusicTypes').MKInstance,
    path: string,
    offset: number,
    signal: AbortSignal,
  ): Promise<{ items: import('./appleMusicTypes').MKLibraryCollection[]; hasMore: boolean }> {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const url = `${path}?limit=${PAGE_LIMIT}&offset=${offset}`;
    const response = await instance.api.music(url);
    const data = response.data as import('./appleMusicTypes').MKPaginatedResponse<import('./appleMusicTypes').MKLibraryCollection>;
    return {
      items: data.data,
      hasMore: data.data.length >= PAGE_LIMIT && !!data.next,
    };
  }

  private toCollection(
    item: import('./appleMusicTypes').MKLibraryCollection,
    kind: 'playlist' | 'album',
  ): MediaCollection {
    const attrs = item.attributes;
    return {
      id: item.id,
      provider: 'apple-music',
      kind,
      name: attrs.name,
      description: attrs.description?.standard ?? null,
      imageUrl: attrs.artwork?.url
        ? attrs.artwork.url.replace('{w}', '1200').replace('{h}', '1200')
        : undefined,
      trackCount: attrs.trackCount,
      ownerName: attrs.artistName ?? null,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private startPollingInterval(): void {
    this.intervalId = setInterval(() => {
      this.syncNow().catch((err) => {
        console.warn('[appleMusicSyncEngine] Background sync error:', err);
      });
    }, this.pollIntervalMs);
  }

  private updateState(partial: Partial<AppleMusicSyncState>): void {
    this.state = { ...this.state, ...partial };
  }

  private notifyListeners(
    playlists?: MediaCollection[],
    albums?: MediaCollection[],
    likedSongsCount?: number,
  ): void {
    if (playlists !== undefined) this.lastKnownPlaylists = playlists;
    if (albums !== undefined) this.lastKnownAlbums = albums;
    if (likedSongsCount !== undefined) this.lastKnownLikedCount = likedSongsCount;

    for (const listener of this.listeners) {
      try {
        listener(this.state, playlists, albums, likedSongsCount);
      } catch (err) {
        console.warn('[appleMusicSyncEngine] Listener error:', err);
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
        console.warn('[appleMusicSyncEngine] Sync on focus failed:', err);
      });
    }
  };
}

export const appleMusicSyncEngine = new AppleMusicSyncEngine();
