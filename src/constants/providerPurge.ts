import type { ProviderId } from '@/types/domain';
import { LEGACY_SPOTIFY_STORAGE_KEYS, STORAGE_KEYS } from '@/constants/storage';

/** sessionStorage key written during Spotify OAuth callback de-dupe. */
export const SPOTIFY_PROCESSED_CODE_SESSION_KEY = 'spotify_processed_code';

/**
 * Enumerable localStorage keys owned by each provider. Logout MUST leave none
 * of these set. App-global prefs (volume, visualizers, …) are intentionally
 * absent. Spotify queue-sync toggles are user prefs, not account data — kept.
 */
export const PROVIDER_PURGE_LOCAL_STORAGE_KEYS: Record<ProviderId, readonly string[]> = {
  spotify: [
    STORAGE_KEYS.SPOTIFY_TOKEN,
    STORAGE_KEYS.SPOTIFY_CODE_VERIFIER,
    LEGACY_SPOTIFY_STORAGE_KEYS.TOKEN,
    LEGACY_SPOTIFY_STORAGE_KEYS.CODE_VERIFIER,
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
