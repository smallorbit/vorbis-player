/**
 * Provider-scoped pinned-items persistence backed by settingsDb (IndexedDB).
 *
 * Key format: "${providerId}:${type}" (e.g. "spotify:playlists", "dropbox:albums").
 */

import { STORE_NAMES, settingsGet, settingsPut, settingsClearStore } from './settingsDb';

export const MAX_PINS = 8;

interface PinRecord {
  key: string;
  ids: string[];
}

function pinKey(providerId: string, type: 'playlists' | 'albums'): string {
  return `${providerId}:${type}`;
}

export async function getPins(providerId: string, type: 'playlists' | 'albums'): Promise<string[]> {
  const record = await settingsGet<PinRecord>(STORE_NAMES.PINS, pinKey(providerId, type));
  return record?.ids ?? [];
}

export async function setPins(providerId: string, type: 'playlists' | 'albums', ids: string[]): Promise<void> {
  await settingsPut(STORE_NAMES.PINS, { key: pinKey(providerId, type), ids });
}

const LS_PINNED_PLAYLISTS = 'vorbis-player-pinned-playlists';
const LS_PINNED_ALBUMS = 'vorbis-player-pinned-albums';

/** Clear all pinned items for all providers. */
export async function clearAllPins(): Promise<void> {
  await settingsClearStore(STORE_NAMES.PINS);
}

let migrationDone = false;

/** @internal Reset migration flag for tests. */
export function _resetMigrationFlag(): void {
  migrationDone = false;
}

/**
 * One-time migration: move pinned playlists/albums from localStorage into IDB
 * under the "spotify" provider namespace. Removes localStorage keys after writing.
 * No-op if localStorage keys don't exist or migration already ran.
 */
export async function migratePinsFromLocalStorage(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;
  try {
    const playlistsRaw = localStorage.getItem(LS_PINNED_PLAYLISTS);
    const albumsRaw = localStorage.getItem(LS_PINNED_ALBUMS);

    if (!playlistsRaw && !albumsRaw) return;

    if (playlistsRaw) {
      const ids = JSON.parse(playlistsRaw) as string[];
      if (Array.isArray(ids) && ids.length > 0) {
        await setPins('spotify', 'playlists', ids);
      }
      localStorage.removeItem(LS_PINNED_PLAYLISTS);
    }

    if (albumsRaw) {
      const ids = JSON.parse(albumsRaw) as string[];
      if (Array.isArray(ids) && ids.length > 0) {
        await setPins('spotify', 'albums', ids);
      }
      localStorage.removeItem(LS_PINNED_ALBUMS);
    }
  } catch (err) {
    console.warn('[pinnedItemsStorage] localStorage migration failed:', err);
  }
}
