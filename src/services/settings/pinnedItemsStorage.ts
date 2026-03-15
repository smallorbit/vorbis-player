/**
 * Provider-scoped pinned-items persistence backed by settingsDb (IndexedDB).
 *
 * Key format: "${providerId}:${type}" (e.g. "spotify:playlists", "dropbox:albums").
 */

import { STORE_NAMES, settingsGet, settingsPut, settingsClearStore } from './settingsDb';

export const MAX_PINS = 8;

/** Provider key used for the unified (cross-provider) pin namespace. */
export const UNIFIED_PROVIDER = '_unified';

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
 * One-time migration:
 * 1. Move pinned playlists/albums from localStorage into IDB (legacy Spotify-only migration).
 * 2. Merge any existing per-provider pin records (e.g. "spotify:playlists", "dropbox:albums")
 *    into the unified namespace ("_unified:playlists", "_unified:albums").
 *
 * No-op if migration already ran this session.
 */
export async function migratePinsFromLocalStorage(): Promise<void> {
  if (migrationDone) return;
  migrationDone = true;
  try {
    // Step 1: localStorage → IDB (legacy)
    const playlistsRaw = localStorage.getItem(LS_PINNED_PLAYLISTS);
    const albumsRaw = localStorage.getItem(LS_PINNED_ALBUMS);

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

    // Step 2: Merge per-provider pins into unified namespace
    const providerIds = ['spotify', 'dropbox'];
    for (const type of ['playlists', 'albums'] as const) {
      const existing = await getPins(UNIFIED_PROVIDER, type);
      if (existing.length > 0) continue; // Already has unified pins, skip merge

      const merged: string[] = [];
      const seen = new Set<string>();
      for (const pid of providerIds) {
        const pins = await getPins(pid, type);
        for (const id of pins) {
          if (!seen.has(id)) {
            seen.add(id);
            merged.push(id);
          }
        }
      }
      if (merged.length > 0) {
        await setPins(UNIFIED_PROVIDER, type, merged.slice(0, MAX_PINS));
      }
    }
  } catch (err) {
    console.warn('[pinnedItemsStorage] migration failed:', err);
  }
}
