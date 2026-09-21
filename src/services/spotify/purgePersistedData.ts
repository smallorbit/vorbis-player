/**
 * Spotify slice of the logout data-purge contract (#1704).
 * Callable from `services/spotify/auth` without importing provider modules.
 */

import {
  PROVIDER_PURGE_LOCAL_STORAGE_KEYS,
  SPOTIFY_PROCESSED_CODE_SESSION_KEY,
} from '@/constants/providerPurge';
import { removeLocalStorageKey } from '@/utils/persistedStorage';
import { logCaughtError } from '@/utils/logCaughtError';
import { clearLikedCountSnapshot } from '@/services/cache/likedCountSnapshot';
import { clearProviderData } from '@/services/cache/libraryCache';
import { clearAllSpotifyInMemoryCaches } from '@/services/spotify/cache';

export async function purgeSpotifyPersistedData(): Promise<void> {
  for (const key of PROVIDER_PURGE_LOCAL_STORAGE_KEYS.spotify) {
    removeLocalStorageKey(key);
  }

  clearLikedCountSnapshot('spotify');

  try {
    await clearProviderData('spotify');
  } catch (err) {
    logCaughtError('purgeSpotifyPersistedData.clearProviderData', err);
  }

  clearAllSpotifyInMemoryCaches();
  try {
    sessionStorage.removeItem(SPOTIFY_PROCESSED_CODE_SESSION_KEY);
  } catch (err) {
    logCaughtError('purgeSpotifyPersistedData.sessionStorage', err);
  }
}
