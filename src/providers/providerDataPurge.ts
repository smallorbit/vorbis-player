/**
 * Logout data-purge contract (#1704 / F41).
 *
 * Single path iterated from known provider-scoped localStorage keys and IDB
 * handles. Adapters call `purgeProviderPersistedData` from `logout` instead of
 * scattering ad-hoc clears.
 */

import type { ProviderId } from '@/types/domain';
import {
  PROVIDER_PURGE_LOCAL_STORAGE_KEYS,
} from '@/constants/providerPurge';
import { removeLocalStorageKey, readLocalStorageRaw } from '@/utils/persistedStorage';
import { logCaughtError } from '@/utils/logCaughtError';
import { clearLikedCountSnapshot } from '@/services/cache/likedCountSnapshot';
import { clearProviderData } from '@/services/cache/libraryCache';
import { purgeSpotifyPersistedData } from '@/services/spotify/purgePersistedData';
import { dropboxIdbHandle } from '@/providers/dropbox/dropboxIdb';
import { resetPlaylistsFolderCache } from '@/providers/dropbox/dropboxPlaylistStorage';
import { destroyLikesSync } from '@/providers/dropbox/dropboxLikesSync';
import {
  clearPreferencesSyncTimestamp,
  destroyPreferencesSync,
} from '@/providers/dropbox/dropboxPreferencesSync';

export {
  PROVIDER_PURGE_LOCAL_STORAGE_KEYS,
  SPOTIFY_PROCESSED_CODE_SESSION_KEY,
} from '@/constants/providerPurge';

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
  if (providerId === 'spotify') {
    await purgeSpotifyPersistedData();
    return;
  }

  for (const key of PROVIDER_PURGE_LOCAL_STORAGE_KEYS[providerId]) {
    removeLocalStorageKey(key);
  }

  clearLikedCountSnapshot(providerId);

  try {
    await clearProviderData(providerId);
  } catch (err) {
    logCaughtError(`providerDataPurge.clearProviderData(${providerId})`, err);
  }

  if (providerId === 'dropbox') {
    resetPlaylistsFolderCache();
    destroyLikesSync();
    destroyPreferencesSync();
    clearPreferencesSyncTimestamp();
    try {
      await dropboxIdbHandle.deleteDatabase();
    } catch (err) {
      logCaughtError('providerDataPurge.dropbox.deleteDatabase', err);
    }
  }
}
