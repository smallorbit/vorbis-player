import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LibrarySyncEngine } from '../librarySyncEngine';
import * as cache from '../libraryCache';
import type { CachedPlaylistInfo, SyncState } from '../cacheTypes';
import type { AlbumInfo, SpotifyImage } from '../../spotify';

// Mock the spotify module
vi.mock('../../spotify', () => ({
  getPlaylistCount: vi.fn(),
  getAlbumCount: vi.fn(),
  getLikedSongsCount: vi.fn(),
  getPlaylistsPage: vi.fn(),
  getAlbumsPage: vi.fn(),
  getUserLibraryInterleaved: vi.fn(),
  invalidateLikedSongsCaches: vi.fn(),
  spotifyAuth: {
    isAuthenticated: vi.fn(() => true),
    ensureValidToken: vi.fn(() => Promise.resolve('mock-token')),
  },
}));

import {
  getPlaylistCount,
  getAlbumCount,
  getLikedSongsCount,
  getPlaylistsPage,
  getAlbumsPage,
  getUserLibraryInterleaved,
  invalidateLikedSongsCaches,
} from '../../spotify';

const mockGetPlaylistCount = vi.mocked(getPlaylistCount);
const mockGetAlbumCount = vi.mocked(getAlbumCount);
const mockGetLikedSongsCount = vi.mocked(getLikedSongsCount);
const mockGetPlaylistsPage = vi.mocked(getPlaylistsPage);
const mockGetAlbumsPage = vi.mocked(getAlbumsPage);
const mockGetUserLibraryInterleaved = vi.mocked(getUserLibraryInterleaved);
const mockInvalidateLikedSongsCaches = vi.mocked(invalidateLikedSongsCaches);

function makePlaylist(id: string, name?: string, snapshotId?: string): CachedPlaylistInfo {
  return {
    id,
    name: name ?? `Playlist ${id}`,
    description: null,
    images: [] as SpotifyImage[],
    tracks: { total: 10 },
    owner: { display_name: 'TestUser' },
    snapshot_id: snapshotId,
    added_at: '2024-01-01T00:00:00Z',
  };
}

function makeAlbum(id: string, name?: string): AlbumInfo {
  return {
    id,
    name: name ?? `Album ${id}`,
    artists: 'Test Artist',
    images: [] as SpotifyImage[],
    release_date: '2024-01-01',
    total_tracks: 12,
    uri: `spotify:album:${id}`,
    added_at: '2024-06-15T00:00:00Z',
  };
}

/** Helper to set up cache with metadata so syncNow() works */
async function seedCacheMeta(opts: {
  playlists?: CachedPlaylistInfo[];
  albums?: AlbumInfo[];
  playlistCount?: number;
  albumCount?: number;
  likedCount?: number;
  snapshotIds?: Record<string, string>;
}): Promise<void> {
  if (opts.playlists) await cache.putAllPlaylists(opts.playlists);
  if (opts.albums) await cache.putAllAlbums(opts.albums);
  await cache.putMeta('playlists', {
    lastValidated: Date.now(),
    totalCount: opts.playlistCount ?? opts.playlists?.length ?? 0,
    snapshotIds: opts.snapshotIds,
  });
  await cache.putMeta('albums', {
    lastValidated: Date.now(),
    totalCount: opts.albumCount ?? opts.albums?.length ?? 0,
  });
  await cache.putMeta('likedSongs', {
    lastValidated: Date.now(),
    totalCount: opts.likedCount ?? 0,
  });
}

describe('LibrarySyncEngine', () => {
  let engine: LibrarySyncEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    await cache.initCache();
    await cache.clearAll();
    engine = new LibrarySyncEngine();
  });

  afterEach(() => {
    engine.stop();
    cache.closeCache();
  });

  describe('warm start', () => {
    it('should emit cached data immediately when IndexedDB has data', async () => {
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Cached Playlist', 'snap1')],
        albums: [makeAlbum('a1', 'Cached Album')],
        likedCount: 5,
        snapshotIds: { p1: 'snap1' },
      });

      // Counts match — no changes
      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(1);
      mockGetLikedSongsCount.mockResolvedValue(5);

      let emittedPlaylists: CachedPlaylistInfo[] | undefined;
      let emittedAlbums: AlbumInfo[] | undefined;

      engine.subscribe((_state, playlists, albums) => {
        if (playlists) emittedPlaylists = playlists;
        if (albums) emittedAlbums = albums;
      });

      await engine.start();

      expect(emittedPlaylists).toHaveLength(1);
      expect(emittedPlaylists![0].name).toBe('Cached Playlist');
      expect(emittedAlbums).toHaveLength(1);
      expect(emittedAlbums![0].name).toBe('Cached Album');
    });
  });

  describe('cold start', () => {
    it('should use progressive loading when cache is empty', async () => {
      const playlists = [makePlaylist('p1', 'Fresh')];
      const albums = [makeAlbum('a1', 'Fresh Album')];

      mockGetUserLibraryInterleaved.mockImplementation(async (onPlaylists, onAlbums) => {
        onPlaylists(playlists, true);
        onAlbums(albums, true);
      });
      mockGetLikedSongsCount.mockResolvedValue(3);

      let latestState: SyncState | null = null;
      let emittedPlaylists: CachedPlaylistInfo[] | undefined;

      engine.subscribe((state, pl) => {
        latestState = state;
        if (pl) emittedPlaylists = pl;
      });

      await engine.start();

      expect(latestState!.isInitialLoadComplete).toBe(true);
      expect(emittedPlaylists).toHaveLength(1);
      expect(emittedPlaylists![0].name).toBe('Fresh');
      expect(mockGetUserLibraryInterleaved).toHaveBeenCalledOnce();
    });
  });

  describe('change detection', () => {
    it('should not fetch full data when counts match', async () => {
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Existing', 'snap1')],
        albums: [makeAlbum('a1')],
        likedCount: 5,
        snapshotIds: { p1: 'snap1' },
      });

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(1);
      mockGetLikedSongsCount.mockResolvedValue(5);

      // Don't start polling — just run a single sync
      await engine.start();
      engine.stop(); // Stop interval
      vi.clearAllMocks();

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(1);
      mockGetLikedSongsCount.mockResolvedValue(5);

      await engine.syncNow();

      expect(mockGetPlaylistsPage).not.toHaveBeenCalled();
      expect(mockGetAlbumsPage).not.toHaveBeenCalled();
      expect(mockInvalidateLikedSongsCaches).not.toHaveBeenCalled();
    });

    it('should detect playlist count change and sync', async () => {
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Existing', 'snap1')],
        snapshotIds: { p1: 'snap1' },
      });

      // Initial start — counts match
      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);

      await engine.start();
      engine.stop();
      vi.clearAllMocks();

      // Sync with changed count
      mockGetPlaylistCount.mockResolvedValue(2);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);
      mockGetPlaylistsPage.mockResolvedValue({
        playlists: [
          makePlaylist('p1', 'Existing', 'snap1'),
          makePlaylist('p2', 'New Playlist', 'snap2'),
        ],
        total: 2,
        hasMore: false,
      });

      await engine.syncNow();

      expect(mockGetPlaylistsPage).toHaveBeenCalled();
      const cachedPlaylists = await cache.getAllPlaylists();
      expect(cachedPlaylists).toHaveLength(2);
      expect(cachedPlaylists.find(p => p.id === 'p2')?.name).toBe('New Playlist');
    });

    it('should detect liked songs count change and invalidate cache', async () => {
      // Need at least one playlist so warm start triggers (not cold start)
      await seedCacheMeta({
        playlists: [makePlaylist('p1')],
        snapshotIds: {},
        likedCount: 5,
      });

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(5);

      await engine.start();
      engine.stop();
      vi.clearAllMocks();

      // Liked songs changed from 5 to 6
      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(6);

      await engine.syncNow();

      expect(mockInvalidateLikedSongsCaches).toHaveBeenCalled();
      const likedMeta = await cache.getMeta('likedSongs');
      expect(likedMeta!.totalCount).toBe(6);
    });
  });

  describe('incremental playlist updates', () => {
    it('should remove deleted playlists from cache', async () => {
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Keep', 'snap1'), makePlaylist('p2', 'Remove', 'snap2')],
        playlistCount: 2,
        snapshotIds: { p1: 'snap1', p2: 'snap2' },
      });

      mockGetPlaylistCount.mockResolvedValue(2);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);

      await engine.start();
      engine.stop();
      vi.clearAllMocks();

      // p2 was removed
      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);
      mockGetPlaylistsPage.mockResolvedValue({
        playlists: [makePlaylist('p1', 'Keep', 'snap1')],
        total: 1,
        hasMore: false,
      });

      await engine.syncNow();

      const playlists = await cache.getAllPlaylists();
      expect(playlists).toHaveLength(1);
      expect(playlists[0].id).toBe('p1');
    });

    it('should invalidate track list when snapshot_id changes', async () => {
      await cache.putTrackList('playlist:p1', [
        { id: 't1', name: 'Old', artists: 'A', album: 'B', duration_ms: 100, uri: 'u' },
      ], 'snap-old');
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Modified', 'snap-old')],
        snapshotIds: { p1: 'snap-old' },
      });

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);

      await engine.start();
      engine.stop();
      vi.clearAllMocks();

      // Count changes (triggers sync), snapshot also changed
      mockGetPlaylistCount.mockResolvedValue(2);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);
      mockGetPlaylistsPage.mockResolvedValue({
        playlists: [
          makePlaylist('p1', 'Modified', 'snap-new'),
          makePlaylist('p2', 'New', 'snap2'),
        ],
        total: 2,
        hasMore: false,
      });

      await engine.syncNow();

      const trackList = await cache.getTrackList('playlist:p1');
      expect(trackList).toBeUndefined();
    });
  });

  describe('subscribe', () => {
    it('should emit current state immediately on subscribe', () => {
      let emittedState: SyncState | null = null;
      engine.subscribe((state) => { emittedState = state; });

      expect(emittedState).not.toBeNull();
      expect(emittedState!.isInitialLoadComplete).toBe(false);
      expect(emittedState!.isSyncing).toBe(false);
    });

    it('should return an unsubscribe function', async () => {
      mockGetUserLibraryInterleaved.mockImplementation(async (onP, onA) => {
        onP([], true);
        onA([], true);
      });
      mockGetLikedSongsCount.mockResolvedValue(0);

      let callCount = 0;
      const unsub = engine.subscribe(() => { callCount++; });
      expect(callCount).toBe(1); // Initial emit

      unsub();
      await engine.start();

      // Cold start emits, but listener was removed so callCount shouldn't increase
      expect(callCount).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully during sync', async () => {
      await seedCacheMeta({
        playlists: [makePlaylist('p1')],
        snapshotIds: {},
      });

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);

      await engine.start();
      engine.stop();
      vi.clearAllMocks();

      // Sync fails
      mockGetPlaylistCount.mockRejectedValue(new Error('Network error'));
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);

      await engine.syncNow();

      const state = engine.getState();
      expect(state.error).toBeTruthy();
      expect(state.isSyncing).toBe(false);

      // Cached data should still be intact
      const playlists = await cache.getAllPlaylists();
      expect(playlists).toHaveLength(1);
    });
  });
});
