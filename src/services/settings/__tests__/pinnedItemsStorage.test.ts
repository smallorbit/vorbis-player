import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPins,
  setPins,
  migratePinsFromLocalStorage,
  _resetMigrationFlag,
} from '../pinnedItemsStorage';
import { _settingsDbTesting, STORE_NAMES, initSettingsDb } from '../settingsDb';

async function resetDb(): Promise<void> {
  // Initialize so we have a db reference, clear the store, then reset module state.
  await initSettingsDb();

  const { db, fallbackStores } = _settingsDbTesting;
  fallbackStores[STORE_NAMES.PINS].clear();

  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAMES.PINS, 'readwrite');
      tx.objectStore(STORE_NAMES.PINS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  _settingsDbTesting.reset();
}

beforeEach(async () => {
  await resetDb();
  _resetMigrationFlag();
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  vi.mocked(localStorage.removeItem).mockClear();
});

describe('pinnedItemsStorage', () => {
  describe('getPins', () => {
    it('returns empty array when nothing stored', async () => {
      // #when
      const result = await getPins('spotify', 'playlists');

      // #then
      expect(result).toEqual([]);
    });
  });

  describe('setPins / getPins', () => {
    it('stores ids and retrieves them correctly', async () => {
      // #given
      const ids = ['playlist-1', 'playlist-2', 'playlist-3'];

      // #when
      await setPins('spotify', 'playlists', ids);
      const result = await getPins('spotify', 'playlists');

      // #then
      expect(result).toEqual(ids);
    });

    it('provider isolation: spotify playlists do not affect dropbox playlists', async () => {
      // #given
      await setPins('spotify', 'playlists', ['sp-1', 'sp-2']);

      // #when
      const dropboxResult = await getPins('dropbox', 'playlists');

      // #then
      expect(dropboxResult).toEqual([]);
    });

    it('provider isolation: spotify playlists do not affect dropbox playlists', async () => {
      // #given
      await setPins('spotify', 'playlists', ['sp-1', 'sp-2']);

      // #when
      const dropboxResult = await getPins('dropbox', 'playlists');

      // #then
      expect(dropboxResult).toEqual([]);
    });

    it('type isolation: playlists pins do not affect albums for the same provider', async () => {
      // #given
      await setPins('spotify', 'playlists', ['pl-1', 'pl-2']);

      // #when
      const albumResult = await getPins('spotify', 'albums');

      // #then
      expect(albumResult).toEqual([]);
    });
  });

  describe('migratePinsFromLocalStorage', () => {
    it('migrates playlists and albums from localStorage into IDB under spotify namespace', async () => {
      // #given
      const playlistIds = ['pl-a', 'pl-b'];
      const albumIds = ['al-a', 'al-b'];
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'vorbis-player-pinned-playlists') return JSON.stringify(playlistIds);
        if (key === 'vorbis-player-pinned-albums') return JSON.stringify(albumIds);
        return null;
      });

      // #when
      await migratePinsFromLocalStorage();

      // #then
      expect(await getPins('spotify', 'playlists')).toEqual(playlistIds);
      expect(await getPins('spotify', 'albums')).toEqual(albumIds);
    });

    it('removes localStorage keys after migrating', async () => {
      // #given
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'vorbis-player-pinned-playlists') return JSON.stringify(['pl-1']);
        if (key === 'vorbis-player-pinned-albums') return JSON.stringify(['al-1']);
        return null;
      });

      // #when
      await migratePinsFromLocalStorage();

      // #then
      expect(localStorage.removeItem).toHaveBeenCalledWith('vorbis-player-pinned-playlists');
      expect(localStorage.removeItem).toHaveBeenCalledWith('vorbis-player-pinned-albums');
    });

    it('is a no-op when localStorage keys do not exist', async () => {
      // #given
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      // #when
      await migratePinsFromLocalStorage();

      // #then
      expect(await getPins('spotify', 'playlists')).toEqual([]);
      expect(await getPins('spotify', 'albums')).toEqual([]);
      expect(localStorage.removeItem).not.toHaveBeenCalled();
    });

    it('is idempotent when called a second time after keys have been removed', async () => {
      // #given
      vi.mocked(localStorage.getItem).mockImplementation((key) => {
        if (key === 'vorbis-player-pinned-playlists') return JSON.stringify(['pl-1']);
        if (key === 'vorbis-player-pinned-albums') return JSON.stringify(['al-1']);
        return null;
      });
      await migratePinsFromLocalStorage();

      vi.mocked(localStorage.getItem).mockReturnValue(null);
      vi.mocked(localStorage.removeItem).mockClear();

      // #when
      await migratePinsFromLocalStorage();

      // #then
      expect(localStorage.removeItem).not.toHaveBeenCalled();
      expect(await getPins('spotify', 'playlists')).toEqual(['pl-1']);
      expect(await getPins('spotify', 'albums')).toEqual(['al-1']);
    });
  });
});
