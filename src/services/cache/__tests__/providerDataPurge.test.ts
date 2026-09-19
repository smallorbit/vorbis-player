import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STORAGE_KEYS } from '@/constants/storage';
import { writeLocalStorageRaw, writeLocalStorageJson } from '@/utils/persistedStorage';
import {
  purgeProviderPersistedData,
  remainingProviderLocalStorageKeys,
  PROVIDER_PURGE_LOCAL_STORAGE_KEYS,
  SPOTIFY_PROCESSED_CODE_SESSION_KEY,
} from '../providerDataPurge';
import {
  clearAll,
  initCache,
  putPlaylist,
  putAlbum,
  putTrackList,
  getAllPlaylists,
  getAllAlbums,
  getTrackList,
} from '../libraryCache';
import { writeLikedCountSnapshot, readLikedCountSnapshots } from '../likedCountSnapshot';
import {
  trackSavedCache,
  setLikedSongsCountCache,
  getLikedSongsCountCache,
} from '@/services/spotify/cache';
import { dropboxIdbHandle } from '@/providers/dropbox/dropboxIdb';
import type { MediaCollection, MediaTrack, ProviderId } from '@/types/domain';

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

describe('purgeProviderPersistedData', () => {
  let store: Record<string, string>;
  let sessionStore: Record<string, string>;

  beforeEach(async () => {
    store = {};
    sessionStore = {};
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key: string, val: string) => {
      store[key] = val;
    });
    vi.mocked(localStorage.removeItem).mockImplementation((key: string) => {
      delete store[key];
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      store = {};
    });
    vi.mocked(sessionStorage.getItem).mockImplementation((key: string) => sessionStore[key] ?? null);
    vi.mocked(sessionStorage.setItem).mockImplementation((key: string, val: string) => {
      sessionStore[key] = val;
    });
    vi.mocked(sessionStorage.removeItem).mockImplementation((key: string) => {
      delete sessionStore[key];
    });
    vi.mocked(sessionStorage.clear).mockImplementation(() => {
      sessionStore = {};
    });

    await initCache();
    await clearAll();
    await dropboxIdbHandle.deleteDatabase();
  });

  afterEach(async () => {
    await clearAll();
    await dropboxIdbHandle.deleteDatabase();
  });

  it('enumerates Spotify and Dropbox purge keys from STORAGE_KEYS', () => {
    // #then — registry is the logout contract's enumerable set
    expect(PROVIDER_PURGE_LOCAL_STORAGE_KEYS.spotify).toEqual([
      STORAGE_KEYS.SPOTIFY_TOKEN,
      STORAGE_KEYS.SPOTIFY_CODE_VERIFIER,
    ]);
    expect(PROVIDER_PURGE_LOCAL_STORAGE_KEYS.dropbox).toContain(STORAGE_KEYS.DROPBOX_TOKEN);
    expect(PROVIDER_PURGE_LOCAL_STORAGE_KEYS.dropbox).toContain(
      STORAGE_KEYS.PREFERENCES_SYNC_UPDATED_AT,
    );
  });

  describe('spotify', () => {
    it('leaves zero Spotify-scoped localStorage keys, library rows, and in-memory caches', async () => {
      // #given
      writeLocalStorageJson(STORAGE_KEYS.SPOTIFY_TOKEN, {
        access_token: 'tok',
        refresh_token: 'ref',
        expires_at: Date.now() + 60_000,
      });
      writeLocalStorageRaw(STORAGE_KEYS.SPOTIFY_CODE_VERIFIER, 'verifier');
      writeLocalStorageRaw(STORAGE_KEYS.VOLUME, '50'); // app-global — must survive
      sessionStorage.setItem(SPOTIFY_PROCESSED_CODE_SESSION_KEY, 'code-1');
      writeLikedCountSnapshot('spotify', 12);
      writeLikedCountSnapshot('dropbox', 3);
      trackSavedCache.set('t1', { value: true, timestamp: Date.now() });
      setLikedSongsCountCache({ count: 12, timestamp: Date.now() });
      await putPlaylist(makeCollection('sp-pl', 'spotify'));
      await putPlaylist(makeCollection('db-pl', 'dropbox'));
      await putTrackList({ provider: 'spotify', kind: 'liked' }, [makeTrack('t1', 'spotify')]);

      // #when
      await purgeProviderPersistedData('spotify');

      // #then
      expect(remainingProviderLocalStorageKeys('spotify')).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEYS.VOLUME)).toBe('50');
      expect(sessionStorage.getItem(SPOTIFY_PROCESSED_CODE_SESSION_KEY)).toBeNull();
      expect(readLikedCountSnapshots().spotify).toBeUndefined();
      expect(readLikedCountSnapshots().dropbox?.count).toBe(3);
      expect(trackSavedCache.size).toBe(0);
      expect(getLikedSongsCountCache()).toBeNull();
      expect((await getAllPlaylists()).map((c) => c.id)).toEqual(['db-pl']);
      expect(await getTrackList({ provider: 'spotify', kind: 'liked' })).toBeUndefined();
    });
  });

  describe('dropbox', () => {
    it('leaves zero Dropbox-scoped keys and deletes the Dropbox IndexedDB', async () => {
      // #given
      for (const key of PROVIDER_PURGE_LOCAL_STORAGE_KEYS.dropbox) {
        writeLocalStorageRaw(key, `value-for-${key}`);
      }
      writeLocalStorageRaw(STORAGE_KEYS.VOLUME, '40');
      writeLikedCountSnapshot('dropbox', 7);
      writeLikedCountSnapshot('spotify', 2);
      await putPlaylist(makeCollection('db-pl', 'dropbox'));
      await putAlbum(makeCollection('sp-al', 'spotify', 'album'));
      await putTrackList({ provider: 'dropbox', kind: 'folder', id: '/music' }, [
        makeTrack('t2', 'dropbox'),
      ]);

      await dropboxIdbHandle.init();
      const art = dropboxIdbHandle.getStore<{ path: string; dataUrl: string; cachedAt: number }>('art');
      const artPath = '/album/cover.jpg';
      await art.put(artPath, { path: artPath, dataUrl: 'data:image/png;base64,xx', cachedAt: Date.now() });
      expect(await art.get(artPath)).toBeDefined();

      // #when
      await purgeProviderPersistedData('dropbox');

      // #then — no Dropbox localStorage leftovers
      expect(remainingProviderLocalStorageKeys('dropbox')).toEqual([]);
      expect(localStorage.getItem(STORAGE_KEYS.VOLUME)).toBe('40');
      expect(readLikedCountSnapshots().dropbox).toBeUndefined();
      expect(readLikedCountSnapshots().spotify?.count).toBe(2);

      // library rows for Dropbox gone; Spotify intact
      expect((await getAllPlaylists()).map((c) => c.id)).toEqual([]);
      expect((await getAllAlbums()).map((c) => c.id)).toEqual(['sp-al']);
      expect(
        await getTrackList({ provider: 'dropbox', kind: 'folder', id: '/music' }),
      ).toBeUndefined();

      // Dropbox IDB deleted (handle closed); reopen is empty
      expect(dropboxIdbHandle.getDb()).toBeNull();
      await dropboxIdbHandle.init();
      const artAfter = dropboxIdbHandle.getStore<{ path: string }>('art');
      expect(await artAfter.get(artPath)).toBeUndefined();
    });
  });
});
