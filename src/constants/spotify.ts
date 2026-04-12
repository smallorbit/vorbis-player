/**
 * Spotify API, SDK, and playback constants
 * Shared across provider and service implementations
 */

// Retry and backoff behavior
export const SPOTIFY_MAX_RETRIES = 5;
export const SPOTIFY_BASE_BACKOFF_MS = 1000;
export const SPOTIFY_TRANSFER_RETRY_COUNT = 2;

// Rate limiting
export const SPOTIFY_RATE_LIMIT_WAIT_S = 5;

// SDK loading
export const SPOTIFY_SDK_LOAD_TIMEOUT_MS = 10000;

// Playback timing
export const SPOTIFY_RESUME_TIMEOUT_MS = 3000;
export const SPOTIFY_INITIAL_RETRY_DELAY_MS = 300;
export const SPOTIFY_INITIAL_VOLUME = 0.5;
