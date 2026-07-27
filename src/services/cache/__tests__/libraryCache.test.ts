import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initCache,
  closeCache,
  getAllPlaylists,
  replaceProviderPlaylists,
  putPlaylist,
  removePlaylist,
  getAllAlbums,
  replaceProviderAlbums,
  putAlbum,
  removeAlbum,
  getTrackList,
  putTrackList,
  removeTrackList,
  getMeta,
  putMeta,
  clearCacheWithOptions,
  clearAll,
  _testing,
} from '../libraryCache';
import type { CollectionRef, MediaCollection, MediaTrack, ProviderId } from '@/types/domain';

function makePlaylist(
  id: string,
  name?: string,
  revision?: string,
  provider: ProviderId = 'spotify',
): MediaCollection {
  return {
    id,
    provider,
    kind: 'playlist',
    name: name ?? `Playlist ${id}`,
    trackCount: 10,
    ownerName: 'TestUser',
    genres: [],
    ...(revision !== undefined && { revision }),
  };
}

function makeAlbum(id: string, name?: string, provider: ProviderId = 'spotify'): MediaCollection {
  return {
    id,
    provider,
    kind: 'album',
    name: name ?? `Album ${id}`,
    ownerName: 'Test Artist',
    trackCount: 12,
    releaseDate: '2024-01-01',
    genres: [],
  };
}

function makeTrack(id: string): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name: `Track ${id}`,
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 200000,
    genres: [],
  };
}

function playlistRef(id: string): CollectionRef {
  return { provider: 'spotify', kind: 'playlist', id };
}

describe('libraryCache', () => {
  beforeEach(async () => {
    // Init, clear all data, then reset state for a fresh start
    await initCache();
    await clearAll();
    closeCache();
  });

  afterEach(() => {
    closeCache();
  });

  describe('initCache', () => {
    it('should initialize without error', async () => {
      await initCache();
      expect(_testing.db).not.toBeNull();
      expect(_testing.fallbackMode).toBe(false);
    });

    it('should be idempotent', async () => {
      // #given
      await initCache();
      const db1 = _testing.db;

      // #when
      await initCache();

      // #then
      expect(_testing.db).toBe(db1);
    });
  });

  describe('Playlist operations', () => {
    it('should store and retrieve playlists', async () => {
      // #given
      const playlists = [makePlaylist('p1', 'Rock'), makePlaylist('p2', 'Jazz')];

      // #when
      await replaceProviderPlaylists('spotify', playlists);
      const result = await getAllPlaylists();

      // #then
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
    });

    it('should replace a provider\'s playlists', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1'), makePlaylist('p2')]);

      // #when
      await replaceProviderPlaylists('spotify', [makePlaylist('p3')]);
      const result = await getAllPlaylists();

      // #then
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p3');
    });

    it('should leave other providers\' playlists intact when replacing one provider', async () => {
      // #given — one record per provider
      await putPlaylist(makePlaylist('d1', 'Dropbox Folder', undefined, 'dropbox'));
      await putPlaylist(makePlaylist('p1', 'Spotify Old'));

      // #when — only the spotify records are replaced
      await replaceProviderPlaylists('spotify', [makePlaylist('p2', 'Spotify New')]);
      const result = await getAllPlaylists();

      // #then
      expect(result.map((p) => p.id).sort()).toEqual(['d1', 'p2']);
    });

    it('should add a single playlist', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1')]);

      // #when
      await putPlaylist(makePlaylist('p2', 'New'));
      const result = await getAllPlaylists();

      // #then
      expect(result).toHaveLength(2);
    });

    it('should update a playlist by id', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Old Name')]);

      // #when
      await putPlaylist(makePlaylist('p1', 'New Name'));
      const result = await getAllPlaylists();

      // #then
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('New Name');
    });

    it('should remove a playlist', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1'), makePlaylist('p2')]);

      // #when
      await removePlaylist('spotify', 'p1');
      const result = await getAllPlaylists();

      // #then
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('p2');
    });

    it('should return empty array when no playlists', async () => {
      const result = await getAllPlaylists();
      expect(result).toEqual([]);
    });

    it('should preserve revision', async () => {
      await putPlaylist(makePlaylist('p1', 'Rock', 'snap123'));
      const result = await getAllPlaylists();
      expect(result[0].revision).toBe('snap123');
    });
  });

  describe('Album operations', () => {
    it('should store and retrieve albums', async () => {
      // #given
      const albums = [makeAlbum('a1'), makeAlbum('a2')];

      // #when
      await replaceProviderAlbums('spotify', albums);
      const result = await getAllAlbums();

      // #then
      expect(result).toHaveLength(2);
    });

    it('should replace a provider\'s albums', async () => {
      // #given
      await replaceProviderAlbums('spotify', [makeAlbum('a1'), makeAlbum('a2')]);

      // #when
      await replaceProviderAlbums('spotify', [makeAlbum('a3')]);
      const result = await getAllAlbums();

      // #then
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a3');
    });

    it('should leave other providers\' albums intact when replacing one provider', async () => {
      // #given
      await putAlbum(makeAlbum('d1', 'Dropbox Album', 'dropbox'));
      await putAlbum(makeAlbum('a1', 'Spotify Old'));

      // #when
      await replaceProviderAlbums('spotify', [makeAlbum('a2', 'Spotify New')]);
      const result = await getAllAlbums();

      // #then
      expect(result.map((a) => a.id).sort()).toEqual(['a2', 'd1']);
    });

    it('should add a single album', async () => {
      // #given
      await replaceProviderAlbums('spotify', [makeAlbum('a1')]);

      // #when
      await putAlbum(makeAlbum('a2'));
      const result = await getAllAlbums();

      // #then
      expect(result).toHaveLength(2);
    });

    it('should remove an album', async () => {
      // #given
      await replaceProviderAlbums('spotify', [makeAlbum('a1'), makeAlbum('a2')]);

      // #when
      await removeAlbum('spotify', 'a1');
      const result = await getAllAlbums();

      // #then
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a2');
    });
  });

  describe('Track list operations', () => {
    it('should store and retrieve a track list', async () => {
      // #given
      const tracks = [makeTrack('t1'), makeTrack('t2')];

      // #when
      await putTrackList(playlistRef('p1'), tracks, 'snap1');
      const result = await getTrackList(playlistRef('p1'));

      // #then
      expect(result).toBeDefined();
      expect(result!.key).toBe('spotify:playlist:p1');
      expect(result!.tracks).toHaveLength(2);
      expect(result!.revision).toBe('snap1');
      expect(result!.timestamp).toBeGreaterThan(0);
    });

    it('should return undefined for missing track list', async () => {
      const result = await getTrackList(playlistRef('nonexistent'));
      expect(result).toBeUndefined();
    });

    it('should remove a track list', async () => {
      // #given
      await putTrackList(playlistRef('p1'), [makeTrack('t1')]);

      // #when
      await removeTrackList(playlistRef('p1'));
      const result = await getTrackList(playlistRef('p1'));

      // #then
      expect(result).toBeUndefined();
    });

    it('should overwrite existing track list', async () => {
      // #given
      await putTrackList(playlistRef('p1'), [makeTrack('t1')]);

      // #when
      await putTrackList(playlistRef('p1'), [makeTrack('t2'), makeTrack('t3')]);
      const result = await getTrackList(playlistRef('p1'));

      // #then
      expect(result!.tracks).toHaveLength(2);
    });
  });

  describe('Metadata operations', () => {
    it('should store and retrieve metadata', async () => {
      // #given
      await putMeta('playlists', {
        lastValidated: 1000,
        totalCount: 50,
        revisions: { p1: 'snap1' },
      });

      // #when
      const result = await getMeta('playlists');

      // #then
      expect(result).toBeDefined();
      expect(result!.key).toBe('playlists');
      expect(result!.totalCount).toBe(50);
      expect(result!.revisions).toEqual({ p1: 'snap1' });
    });

    it('should return undefined for missing metadata', async () => {
      const result = await getMeta('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should overwrite metadata', async () => {
      // #given
      await putMeta('playlists', { lastValidated: 1000, totalCount: 50 });

      // #when
      await putMeta('playlists', { lastValidated: 2000, totalCount: 60 });
      const result = await getMeta('playlists');

      // #then
      expect(result!.totalCount).toBe(60);
      expect(result!.lastValidated).toBe(2000);
    });
  });

  describe('clearAll', () => {
    it('should clear all stores', async () => {
      await replaceProviderPlaylists('spotify', [makePlaylist('p1')]);
      await replaceProviderAlbums('spotify', [makeAlbum('a1')]);
      await putTrackList(playlistRef('p1'), [makeTrack('t1')]);
      await putMeta('playlists', { lastValidated: 1000, totalCount: 1 });

      await clearAll();

      expect(await getAllPlaylists()).toEqual([]);
      expect(await getAllAlbums()).toEqual([]);
      expect(await getTrackList(playlistRef('p1'))).toBeUndefined();
      expect(await getMeta('playlists')).toBeUndefined();
    });
  });

  describe('clearCacheWithOptions', () => {
    it('should preserve liked track lists from every provider by default', async () => {
      // #given — liked lists for two providers plus a regular playlist list
      const spotifyLiked: CollectionRef = { provider: 'spotify', kind: 'liked' };
      const dropboxLiked: CollectionRef = { provider: 'dropbox', kind: 'liked' };
      await putTrackList(spotifyLiked, [makeTrack('t1')]);
      await putTrackList(dropboxLiked, [makeTrack('t2')]);
      await putTrackList(playlistRef('p1'), [makeTrack('t3')]);
      await replaceProviderPlaylists('spotify', [makePlaylist('p1')]);

      // #when
      await clearCacheWithOptions();

      // #then — liked lists survive, everything else is gone
      expect((await getTrackList(spotifyLiked))?.tracks).toHaveLength(1);
      expect((await getTrackList(dropboxLiked))?.tracks).toHaveLength(1);
      expect(await getTrackList(playlistRef('p1'))).toBeUndefined();
      expect(await getAllPlaylists()).toEqual([]);
    });

    it('should clear liked track lists when clearLikes is true', async () => {
      // #given
      const spotifyLiked: CollectionRef = { provider: 'spotify', kind: 'liked' };
      await putTrackList(spotifyLiked, [makeTrack('t1')]);

      // #when
      await clearCacheWithOptions({ clearLikes: true });

      // #then
      expect(await getTrackList(spotifyLiked)).toBeUndefined();
    });
  });

  describe('close/reopen persistence', () => {
    it('should persist data after close and reopen', async () => {
      // #given
      await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Survive')]);

      // #when
      closeCache();
      await initCache();
      const result = await getAllPlaylists();

      // #then
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Survive');
    });
  });

  describe('fallback mode', () => {
    it('should use in-memory fallback when IndexedDB is unavailable', async () => {
      // Temporarily break indexedDB
      const originalOpen = indexedDB.open;
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        throw new Error('IndexedDB blocked');
      });

      closeCache(); // Reset state
      await initCache();
      expect(_testing.fallbackMode).toBe(true);

      // Operations should still work in memory
      await replaceProviderPlaylists('spotify', [makePlaylist('p1')]);
      const result = await getAllPlaylists();
      expect(result).toHaveLength(1);

      // Restore
      vi.mocked(indexedDB.open).mockImplementation(originalOpen);
    });

    it('should round-trip every store via the in-memory fallback', async () => {
      // #given — IndexedDB is unavailable, so initCache routes everything to memory
      const originalOpen = indexedDB.open;
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        throw new Error('IndexedDB blocked');
      });
      closeCache();
      await initCache();
      expect(_testing.fallbackMode).toBe(true);
      expect(_testing.db).toBeNull();

      // #when — exercise CRUD on each typed wrapper
      await putPlaylist(makePlaylist('p1', 'In-Memory'));
      await putAlbum(makeAlbum('a1', 'In-Memory Album'));
      await putTrackList(playlistRef('p1'), [makeTrack('t1')], 'snap-mem');
      await putMeta('playlists', { lastValidated: 42, totalCount: 1 });

      // #then — values come back from the in-memory maps
      expect((await getAllPlaylists())[0]?.name).toBe('In-Memory');
      expect((await getAllAlbums())[0]?.name).toBe('In-Memory Album');
      expect((await getTrackList(playlistRef('p1')))?.revision).toBe('snap-mem');
      expect((await getMeta('playlists'))?.totalCount).toBe(1);

      // #then — and removal from the fallback map propagates
      await removePlaylist('spotify', 'p1');
      await removeAlbum('spotify', 'a1');
      await removeTrackList(playlistRef('p1'));
      expect(await getAllPlaylists()).toEqual([]);
      expect(await getAllAlbums()).toEqual([]);
      expect(await getTrackList(playlistRef('p1'))).toBeUndefined();

      vi.mocked(indexedDB.open).mockImplementation(originalOpen);
    });

    it('should clear every fallback map when clearAll runs in fallback mode', async () => {
      // #given
      const originalOpen = indexedDB.open;
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        throw new Error('IndexedDB blocked');
      });
      closeCache();
      await initCache();
      await putPlaylist(makePlaylist('p1'));
      await putAlbum(makeAlbum('a1'));
      await putTrackList(playlistRef('p1'), [makeTrack('t1')]);
      await putMeta('playlists', { lastValidated: 1, totalCount: 1 });

      // #when
      await clearAll();

      // #then
      expect(await getAllPlaylists()).toEqual([]);
      expect(await getAllAlbums()).toEqual([]);
      expect(await getTrackList(playlistRef('p1'))).toBeUndefined();
      expect(await getMeta('playlists')).toBeUndefined();

      vi.mocked(indexedDB.open).mockImplementation(originalOpen);
    });
  });

  describe('runtime write-path IDB failure', () => {
    /**
     * Helper: after initCache succeeds, mock IDBDatabase.prototype.transaction so
     * that readwrite transactions throw, simulating a QuotaExceededError or closed
     * connection. readonly transactions are left intact so beforeEach/afterEach can
     * still use clearAll and close without hanging.
     */
    function mockWriteTransactionFailure(db: IDBDatabase): () => void {
      const original = db.transaction.bind(db);
      const spy = vi.spyOn(db, 'transaction').mockImplementation(
        (storeNames: string | string[], mode?: IDBTransactionMode) => {
          if (mode === 'readwrite') {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError');
          }
          return original(storeNames, mode);
        },
      );
      return () => spy.mockRestore();
    }

    it('should flip to fallback mode when a put fails at runtime', async () => {
      // #given — IDB opens successfully, then readwrite transactions start failing
      await initCache();
      expect(_testing.fallbackMode).toBe(false);
      const restore = mockWriteTransactionFailure(_testing.db!);

      // #when — write fails at runtime (IDB was healthy at init)
      await putPlaylist(makePlaylist('p1', 'Fallback Playlist'));

      // #then — fallback mode is now active
      expect(_testing.fallbackMode).toBe(true);

      restore();
    });

    it('should serve the written value from the in-memory map after a runtime put failure', async () => {
      // #given — IDB opens, then readwrite transactions start throwing
      await initCache();
      expect(_testing.fallbackMode).toBe(false);
      const restore = mockWriteTransactionFailure(_testing.db!);

      // #when — write fails at runtime; the value lands in the fallback Map
      await putPlaylist(makePlaylist('p1', 'Quota Playlist'));

      // #then — fallback mode flipped and the subsequent read returns the in-memory value,
      //          not stale IDB data
      expect(_testing.fallbackMode).toBe(true);
      const result = await getAllPlaylists();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Quota Playlist');

      restore();
    });

    it('should flip to fallback mode when a batch replace fails at runtime', async () => {
      // #given — IDB opens successfully, then readwrite transactions start throwing
      await initCache();
      expect(_testing.fallbackMode).toBe(false);
      const restore = mockWriteTransactionFailure(_testing.db!);

      // #when — replaceProviderPlaylists touches multiple items; the entire batch goes to fallback
      const batch = [makePlaylist('p2', 'Batch A'), makePlaylist('p3', 'Batch B')];
      await replaceProviderPlaylists('spotify', batch);

      // #then
      expect(_testing.fallbackMode).toBe(true);
      const result = await getAllPlaylists();
      expect(result.map((p) => p.id).sort()).toEqual(['p2', 'p3']);

      restore();
    });

    it('should keep fallback mode true for all subsequent reads after a write failure', async () => {
      // #given — IDB opens; one write fails
      await initCache();
      const restore = mockWriteTransactionFailure(_testing.db!);
      await putPlaylist(makePlaylist('p1'));
      restore();
      expect(_testing.fallbackMode).toBe(true);

      // #when — subsequent reads and writes (IDB transaction mock removed)
      await putPlaylist(makePlaylist('p2', 'After Failure'));
      const playlists = await getAllPlaylists();
      const albums = await getAllAlbums();

      // #then — still in fallback; reads come from the in-memory map, not IDB
      expect(_testing.fallbackMode).toBe(true);
      expect(playlists.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
      expect(albums).toEqual([]);
    });
  });
});
