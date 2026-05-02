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
  getAllUserPlaylists: vi.fn(),
  getAllUserAlbums: vi.fn(),
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
  getAllUserPlaylists,
  getAllUserAlbums,
  getUserLibraryInterleaved,
  invalidateLikedSongsCaches,
} from '../../spotify';

const mockGetPlaylistCount = vi.mocked(getPlaylistCount);
const mockGetAlbumCount = vi.mocked(getAlbumCount);
const mockGetLikedSongsCount = vi.mocked(getLikedSongsCount);
const mockGetAllUserPlaylists = vi.mocked(getAllUserPlaylists);
const mockGetAllUserAlbums = vi.mocked(getAllUserAlbums);
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
      // #given
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Existing', 'snap1')],
        albums: [makeAlbum('a1')],
        likedCount: 5,
        snapshotIds: { p1: 'snap1' },
      });

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(1);
      mockGetLikedSongsCount.mockResolvedValue(5);

      await engine.start();
      engine.stop();
      vi.clearAllMocks();

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(1);
      mockGetLikedSongsCount.mockResolvedValue(5);

      // #when
      await engine.syncNow();

      // #then
      expect(mockGetAllUserPlaylists).not.toHaveBeenCalled();
      expect(mockGetAllUserAlbums).not.toHaveBeenCalled();
      expect(mockInvalidateLikedSongsCaches).not.toHaveBeenCalled();
    });

    it('should detect playlist count change and sync', async () => {
      // #given
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Existing', 'snap1')],
        snapshotIds: { p1: 'snap1' },
      });

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);

      await engine.start();
      engine.stop();
      vi.clearAllMocks();

      mockGetPlaylistCount.mockResolvedValue(2);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);
      mockGetAllUserPlaylists.mockResolvedValue([
        makePlaylist('p1', 'Existing', 'snap1'),
        makePlaylist('p2', 'New Playlist', 'snap2'),
      ]);

      // #when
      await engine.syncNow();

      // #then
      expect(mockGetAllUserPlaylists).toHaveBeenCalled();
      const cachedPlaylists = await cache.getAllPlaylists();
      expect(cachedPlaylists).toHaveLength(2);
      expect(cachedPlaylists.find(p => p.id === 'p2')?.name).toBe('New Playlist');
    });

    it('should detect liked songs count change and invalidate cache', async () => {
      // #given
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

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(6);

      // #when
      await engine.syncNow();

      // #then
      expect(mockInvalidateLikedSongsCaches).toHaveBeenCalled();
      const likedMeta = await cache.getMeta('likedSongs');
      expect(likedMeta!.totalCount).toBe(6);
    });
  });

  describe('incremental playlist updates', () => {
    it('should remove deleted playlists from cache', async () => {
      // #given
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

      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);
      mockGetAllUserPlaylists.mockResolvedValue([
        makePlaylist('p1', 'Keep', 'snap1'),
      ]);

      // #when
      await engine.syncNow();

      // #then
      const playlists = await cache.getAllPlaylists();
      expect(playlists).toHaveLength(1);
      expect(playlists[0].id).toBe('p1');
    });

    it('should invalidate track list when snapshot_id changes', async () => {
      // #given
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

      mockGetPlaylistCount.mockResolvedValue(2);
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);
      mockGetAllUserPlaylists.mockResolvedValue([
        makePlaylist('p1', 'Modified', 'snap-new'),
        makePlaylist('p2', 'New', 'snap2'),
      ]);

      // #when
      await engine.syncNow();

      // #then
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
      // #given
      mockGetUserLibraryInterleaved.mockImplementation(async (onP, onA) => {
        onP([], true);
        onA([], true);
      });
      mockGetLikedSongsCount.mockResolvedValue(0);

      let callCount = 0;
      const unsub = engine.subscribe(() => { callCount++; });
      expect(callCount).toBe(1);

      // #when
      unsub();
      await engine.start();

      // #then
      expect(callCount).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully during sync', async () => {
      // #given
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

      mockGetPlaylistCount.mockRejectedValue(new Error('Network error'));
      mockGetAlbumCount.mockResolvedValue(0);
      mockGetLikedSongsCount.mockResolvedValue(0);

      // #when
      await engine.syncNow();

      // #then
      const state = engine.getState();
      expect(state.error).toBeTruthy();
      expect(state.isSyncing).toBe(false);

      const playlists = await cache.getAllPlaylists();
      expect(playlists).toHaveLength(1);
    });
  });

  describe('optimisticRemoveAlbum', () => {
    it('should evict the album from the cached album list', async () => {
      // #given
      await seedCacheMeta({
        albums: [makeAlbum('a1', 'Keep'), makeAlbum('a2', 'Remove')],
        albumCount: 2,
      });

      // #when
      await engine.optimisticRemoveAlbum('a2');

      // #then
      const albums = await cache.getAllAlbums();
      expect(albums).toHaveLength(1);
      expect(albums[0].id).toBe('a1');
    });

    it('should decrement the album totalCount in cache metadata', async () => {
      // #given
      await seedCacheMeta({
        albums: [makeAlbum('a1'), makeAlbum('a2')],
        albumCount: 2,
      });

      // #when
      await engine.optimisticRemoveAlbum('a1');

      // #then
      const meta = await cache.getMeta('albums');
      expect(meta!.totalCount).toBe(1);
    });

    it('should notify subscribers with the updated album list', async () => {
      // #given
      await seedCacheMeta({
        albums: [makeAlbum('a1', 'Keep'), makeAlbum('a2', 'Remove')],
        albumCount: 2,
      });

      let notifiedAlbums: AlbumInfo[] | undefined;
      engine.subscribe((_state, _playlists, albums) => {
        if (albums) notifiedAlbums = albums;
      });

      // #when
      await engine.optimisticRemoveAlbum('a2');

      // #then
      expect(notifiedAlbums).toBeDefined();
      expect(notifiedAlbums!.some((a) => a.id === 'a2')).toBe(false);
      expect(notifiedAlbums!.some((a) => a.id === 'a1')).toBe(true);
    });

    it('should not go below zero when totalCount is already zero', async () => {
      // #given
      await seedCacheMeta({
        albums: [makeAlbum('a1')],
        albumCount: 0,
      });

      // #when
      await engine.optimisticRemoveAlbum('a1');

      // #then — totalCount must not underflow below zero
      const meta = await cache.getMeta('albums');
      expect(meta!.totalCount).toBe(0);
    });
  });
});
