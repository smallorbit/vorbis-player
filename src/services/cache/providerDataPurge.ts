/**
 * Logout data-purge contract (#1704 / F41).
 *
 * Single path iterated from known provider-scoped localStorage keys and IDB
 * handles. Adapters call `purgeProviderPersistedData` from `logout` instead of
 * scattering ad-hoc clears.
 */

import type { ProviderId } from '@/types/domain';
import { STORAGE_KEYS } from '@/constants/storage';
import { removeLocalStorageKey, readLocalStorageRaw } from '@/utils/persistedStorage';
import { logCaughtError } from '@/utils/logCaughtError';
import { clearLikedCountSnapshot } from '@/services/cache/likedCountSnapshot';
import { clearProviderData } from '@/services/cache/libraryCache';
import { clearAllSpotifyInMemoryCaches } from '@/services/spotify/cache';
import { dropboxIdbHandle } from '@/providers/dropbox/dropboxIdb';
import { resetPlaylistsFolderCache } from '@/providers/dropbox/dropboxPlaylistStorage';
import { destroyLikesSync } from '@/providers/dropbox/dropboxLikesSync';
import {
  clearPreferencesSyncTimestamp,
  destroyPreferencesSync,
} from '@/providers/dropbox/dropboxPreferencesSync';

/** sessionStorage key written during Spotify OAuth callback de-dupe. */
export const SPOTIFY_PROCESSED_CODE_SESSION_KEY = 'spotify_processed_code';

/**
 * Enumerable localStorage keys owned by each provider. Logout MUST leave none
 * of these set. App-global prefs (volume, visualizers, …) are intentionally
 * absent. Spotify queue-sync toggles are user prefs, not account data — left
 * for #1706 if product wants them in the purge set.
 */
export const PROVIDER_PURGE_LOCAL_STORAGE_KEYS: Record<ProviderId, readonly string[]> = {
  spotify: [
    STORAGE_KEYS.SPOTIFY_TOKEN,
    STORAGE_KEYS.SPOTIFY_CODE_VERIFIER,
  ],
  dropbox: [
    STORAGE_KEYS.DROPBOX_TOKEN,
    STORAGE_KEYS.DROPBOX_REFRESH_TOKEN,
    STORAGE_KEYS.DROPBOX_TOKEN_EXPIRY,
    STORAGE_KEYS.DROPBOX_CODE_VERIFIER,
    STORAGE_KEYS.DROPBOX_OAUTH_STATE,
    STORAGE_KEYS.PREFERENCES_SYNC_UPDATED_AT,
  ],
};

/** Keys from the purge set that are still present in localStorage. */
export function remainingProviderLocalStorageKeys(providerId: ProviderId): string[] {
  return PROVIDER_PURGE_LOCAL_STORAGE_KEYS[providerId].filter(
    (key) => readLocalStorageRaw(key) != null,
  );
}

/**
 * Remove all provider-scoped persisted data for `providerId`.
 * Safe to call more than once; storage clears are idempotent.
 */
export async function purgeProviderPersistedData(providerId: ProviderId): Promise<void> {
  for (const key of PROVIDER_PURGE_LOCAL_STORAGE_KEYS[providerId]) {
    removeLocalStorageKey(key);
  }

  clearLikedCountSnapshot(providerId);

  try {
    await clearProviderData(providerId);
  } catch (err) {
    logCaughtError(`providerDataPurge.clearProviderData(${providerId})`, err);
  }

  if (providerId === 'spotify') {
    clearAllSpotifyInMemoryCaches();
    try {
      sessionStorage.removeItem(SPOTIFY_PROCESSED_CODE_SESSION_KEY);
    } catch (err) {
      logCaughtError('providerDataPurge.spotify.sessionStorage', err);
    }
  }

  if (providerId === 'dropbox') {
    resetPlaylistsFolderCache();
    destroyLikesSync();
    destroyPreferencesSync();
    // clearPreferencesSyncTimestamp is redundant with the key list above but
    // keeps the Dropbox sync module's own helper as the named owner of that key.
    clearPreferencesSyncTimestamp();
    try {
      await dropboxIdbHandle.deleteDatabase();
    } catch (err) {
      logCaughtError('providerDataPurge.dropbox.deleteDatabase', err);
    }
  }
}
