/**
 * One-time migration: unprefixed Spotify auth keys → `vorbis-player-` prefix (#1706 / F77).
 *
 * Safe to call repeatedly; no-ops when the canonical key is already populated
 * or the legacy key is absent.
 */

import { LEGACY_SPOTIFY_STORAGE_KEYS, STORAGE_KEYS } from '@/constants/storage';
import {
  readLocalStorageRaw,
  removeLocalStorageKey,
  writeLocalStorageRaw,
} from '@/utils/persistedStorage';

const PAIRS: ReadonlyArray<readonly [legacy: string, next: string]> = [
  [LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN, STORAGE_KEYS.SPOTIFY_TOKEN],
  [LEGACY_SPOTIFY_STORAGE_KEYS.CODE_VERIFIER, STORAGE_KEYS.SPOTIFY_CODE_VERIFIER],
];

let migrated = false;

/** @internal Reset for tests. */
export function _resetSpotifyStorageMigrationFlag(): void {
  migrated = false;
}

export function migrateLegacySpotifyStorageKeys(): void {
  if (migrated) return;
  migrated = true;

  for (const [legacy, next] of PAIRS) {
    const current = readLocalStorageRaw(next);
    if (current != null) {
      // Canonical key already set — drop any leftover legacy copy.
      if (readLocalStorageRaw(legacy) != null) {
        removeLocalStorageKey(legacy);
      }
      continue;
    }
    const legacyValue = readLocalStorageRaw(legacy);
    if (legacyValue == null) continue;
    writeLocalStorageRaw(next, legacyValue);
    removeLocalStorageKey(legacy);
  }
}
