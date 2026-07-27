import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpotifyLibrarySyncEngine } from '../librarySyncEngine';
import * as cache from '../libraryCache';
import type { SyncState } from '../cacheTypes';
import type { MediaCollection, MediaTrack } from '@/types/domain';

// Mock the spotify module
vi.mock('../../spotify', () => ({
  getPlaylistCount: vi.fn(),
  getAlbumCount: vi.fn(),
  getLikedSongsCount: vi.fn(),
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

function makePlaylist(id: string, name?: string, revision?: string): MediaCollection {
  return {
    id,
    provider: 'spotify',
    kind: 'playlist',
    name: name ?? `Playlist ${id}`,
    trackCount: 10,
    ownerName: 'TestUser',
    genres: [],
    ...(revision !== undefined && { revision }),
  };
}

function makeAlbum(id: string, name?: string): MediaCollection {
  return {
    id,
    provider: 'spotify',
    kind: 'album',
    name: name ?? `Album ${id}`,
    ownerName: 'Test Artist',
    trackCount: 12,
    releaseDate: '2024-01-01',
    genres: [],
  };
}

function makeTrack(id: string, name?: string): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name: name ?? `Track ${id}`,
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 200000,
    genres: [],
  };
}

/** Helper to set up cache with metadata so syncNow() works */
async function seedCacheMeta(opts: {
  playlists?: MediaCollection[];
  albums?: MediaCollection[];
  playlistCount?: number;
  albumCount?: number;
  likedCount?: number;
  revisions?: Record<string, string>;
}): Promise<void> {
  if (opts.playlists) await cache.replaceProviderPlaylists('spotify', opts.playlists);
  if (opts.albums) await cache.replaceProviderAlbums('spotify', opts.albums);
  await cache.putMeta('playlists', {
    lastValidated: Date.now(),
    totalCount: opts.playlistCount ?? opts.playlists?.length ?? 0,
    ...(opts.revisions !== undefined && { revisions: opts.revisions }),
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

describe('SpotifyLibrarySyncEngine', () => {
  let engine: SpotifyLibrarySyncEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    await cache.initCache();
    await cache.clearAll();
    engine = new SpotifyLibrarySyncEngine();
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
        revisions: { p1: 'snap1' },
      });

      // Counts match — no changes
      mockGetPlaylistCount.mockResolvedValue(1);
      mockGetAlbumCount.mockResolvedValue(1);
      mockGetLikedSongsCount.mockResolvedValue(5);

      let emittedPlaylists: MediaCollection[] | undefined;
      let emittedAlbums: MediaCollection[] | undefined;

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
      let emittedPlaylists: MediaCollection[] | undefined;

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

    it('should deduplicate concurrent start() calls during cold load', async () => {
      // #given — make the cold load block until we explicitly unblock it
      // Create the deferred gate before start() is called so it's available immediately
      let unblockLoad!: () => void;
      const gate = new Promise<void>((resolve) => { unblockLoad = resolve; });
      mockGetUserLibraryInterleaved.mockImplementation(() => gate);
      mockGetLikedSongsCount.mockResolvedValue(0);

      // #when — two concurrent start() calls while cold load is in flight
      const p1 = engine.start();
      const p2 = engine.start();

      // unblock the cold load and wait for both to settle
      unblockLoad();
      await Promise.all([p1, p2]);

      // #then — getUserLibraryInterleaved must have been called exactly once
      expect(mockGetUserLibraryInterleaved).toHaveBeenCalledOnce();
    });

    it('should allow restart after stop() is called between start cycles', async () => {
      // #given — use a fresh engine with empty cache for both start cycles
      mockGetUserLibraryInterleaved.mockImplementation(async (onPlaylists, onAlbums) => {
        onPlaylists([makePlaylist('p1', 'Cycle1')], true);
        onAlbums([], true);
      });
      mockGetLikedSongsCount.mockResolvedValue(0);

      // Complete the first cycle
      await engine.start();
      engine.stop();

      // The cold-start cache write is fire-and-forget; wait for it to land so
      // clearAll below can't race against it
      await vi.waitFor(async () => {
        expect(await cache.getAllPlaylists()).toHaveLength(1);
      });

      // Clear the cache so the second start() also takes the cold path
      await cache.clearAll();

      // #when — second start() after stop(); must not be blocked by a stale startPromise
      await engine.start();

      // #then — cold load ran twice (once per cycle)
      expect(mockGetUserLibraryInterleaved).toHaveBeenCalledTimes(2);
    });
  });

  describe('change detection', () => {
    it('should not fetch full data when counts match', async () => {
      // #given
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Existing', 'snap1')],
        albums: [makeAlbum('a1')],
        likedCount: 5,
        revisions: { p1: 'snap1' },
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
        revisions: { p1: 'snap1' },
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
        revisions: {},
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
        revisions: { p1: 'snap1', p2: 'snap2' },
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

    it('should invalidate track list when revision changes', async () => {
      // #given
      const p1Ref = { provider: 'spotify', kind: 'playlist', id: 'p1' } as const;
      await cache.putTrackList(p1Ref, [makeTrack('t1', 'Old')], 'snap-old');
      await seedCacheMeta({
        playlists: [makePlaylist('p1', 'Modified', 'snap-old')],
        revisions: { p1: 'snap-old' },
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
      const trackList = await cache.getTrackList(p1Ref);
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
        revisions: {},
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

      let notifiedAlbums: MediaCollection[] | undefined;
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

  describe('optimisticAddAlbum', () => {
    it('should insert the album into cache and notify subscribers', async () => {
      // #given
      await seedCacheMeta({
        albums: [makeAlbum('a1', 'Existing')],
        albumCount: 1,
      });

      let notifiedAlbums: MediaCollection[] | undefined;
      engine.subscribe((_state, _playlists, albums) => {
        if (albums) notifiedAlbums = albums;
      });

      // #when
      await engine.optimisticAddAlbum(makeAlbum('a2', 'Added'));

      // #then — cache has the new album and subscribers saw it
      const albums = await cache.getAllAlbums();
      expect(albums.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
      expect(notifiedAlbums!.some((a) => a.name === 'Added')).toBe(true);

      const meta = await cache.getMeta('albums');
      expect(meta!.totalCount).toBe(2);
    });
  });
});
