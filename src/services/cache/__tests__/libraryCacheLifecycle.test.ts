import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initCache,
  closeCache,
  getAllPlaylists,
  putPlaylist,
  putAlbum,
  getAllAlbums,
  putTrackList,
  getTrackList,
  clearProviderData,
  clearAll,
  _testing,
} from '../libraryCache';
import type { MediaCollection, MediaTrack, ProviderId } from '@/types/domain';

const DB_NAME = 'vorbis-player-library';

function makeCollection(
  id: string,
  provider: ProviderId,
  kind: 'playlist' | 'album' = 'playlist',
): MediaCollection {
  return { id, provider, kind, name: `Collection ${id}`, genres: [] };
}

function makeTrack(id: string, provider: ProviderId): MediaTrack {
  return {
    id,
    provider,
    playbackRef: { provider, ref: `${provider}:track:${id}` },
    name: `Track ${id}`,
    artists: 'Artist',
    album: 'Album',
    durationMs: 1000,
    genres: [],
  };
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/** Open the database at the pre-#1686 v1 schema (in-line `keyPath` stores). */
function openLegacyV1(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('playlists', { keyPath: 'id' });
      db.createObjectStore('albums', { keyPath: 'id' });
      db.createObjectStore('trackLists', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
    };
  });
}

function putLegacyRecord(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('libraryCacheLifecycle', () => {
  beforeEach(async () => {
    closeCache();
    await deleteDatabase();
  });

  afterEach(async () => {
    closeCache();
    await deleteDatabase();
  });

  describe('v1 → v2 upgrade', () => {
    it('drops legacy keyPath stores and starts clean at v2', async () => {
      // #given — a v1 database with an in-line-keyed Spotify-shaped record
      const legacyDb = await openLegacyV1();
      await putLegacyRecord(legacyDb, 'playlists', {
        id: 'p1',
        name: 'Legacy Playlist',
        images: [],
        tracks: { total: 3 },
      });
      legacyDb.close();

      // #when — the v2 cache opens (upgrade runs) and a neutral record is written
      await initCache();
      expect(_testing.fallbackMode).toBe(false);
      await putPlaylist(makeCollection('p2', 'spotify'));

      // #then — the legacy record is gone and the new out-of-line write round-trips
      const playlists = await getAllPlaylists();
      expect(playlists).toHaveLength(1);
      expect(playlists[0]?.id).toBe('p2');
    });
  });

  describe('blocked upgrade', () => {
    it('falls back to the in-memory store when another tab blocks the version bump', async () => {
      // #given — a lingering v1 connection with no versionchange handler,
      // like a tab still running the pre-upgrade build
      const blockingDb = await openLegacyV1();

      // #when — initCache attempts the v2 upgrade
      await initCache();

      // #then — the open settles via the in-memory fallback instead of
      // hanging forever, and cache operations still work for this session
      expect(_testing.fallbackMode).toBe(true);
      await putPlaylist(makeCollection('p1', 'spotify'));
      const playlists = await getAllPlaylists();
      expect(playlists).toHaveLength(1);

      blockingDb.close();
    });
  });

  describe('clearProviderData', () => {
    beforeEach(async () => {
      await initCache();
      await clearAll();
    });

    it("removes one provider's collections and track lists, leaving the other provider intact", async () => {
      // #given — records from both providers in every store
      await putPlaylist(makeCollection('sp-pl', 'spotify'));
      await putPlaylist(makeCollection('db-pl', 'dropbox'));
      await putAlbum(makeCollection('sp-al', 'spotify', 'album'));
      await putAlbum(makeCollection('db-al', 'dropbox', 'album'));
      await putTrackList({ provider: 'spotify', kind: 'playlist', id: 'sp-pl' }, [makeTrack('t1', 'spotify')]);
      await putTrackList({ provider: 'dropbox', kind: 'folder', id: '/music' }, [makeTrack('t2', 'dropbox')]);
      await putTrackList({ provider: 'dropbox', kind: 'liked' }, [makeTrack('t3', 'dropbox')]);

      // #when — Spotify logs out
      await clearProviderData('spotify');

      // #then — Dropbox rows survive in every store
      expect((await getAllPlaylists()).map((c) => c.id)).toEqual(['db-pl']);
      expect((await getAllAlbums()).map((c) => c.id)).toEqual(['db-al']);
      expect(await getTrackList({ provider: 'spotify', kind: 'playlist', id: 'sp-pl' })).toBeUndefined();
      expect((await getTrackList({ provider: 'dropbox', kind: 'folder', id: '/music' }))?.tracks).toHaveLength(1);
      expect((await getTrackList({ provider: 'dropbox', kind: 'liked' }))?.tracks).toHaveLength(1);
    });
  });
});
