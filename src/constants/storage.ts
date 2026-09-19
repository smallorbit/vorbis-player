/**
 * Canonical localStorage / IndexedDB name registry.
 *
 * All `vorbis-player-` prefixed string literals in production `src/` MUST live
 * here. ESLint bans hardcoded `vorbis-player-*` literals elsewhere (see
 * `eslint.config.js`). Writers go through `persistedStorage` helpers so
 * same-tab listeners stay in sync.
 */

export const STORAGE_PREFIX = 'vorbis-player-' as const;

export const STORAGE_KEYS = {
  // Provider configuration
  ACTIVE_PROVIDER: 'vorbis-player-active-provider',
  ENABLED_PROVIDERS: 'vorbis-player-enabled-providers',

  // Playback and player state
  VOLUME: 'vorbis-player-volume',
  MUTED: 'vorbis-player-muted',
  SHUFFLE_ENABLED: 'vorbis-player-shuffle-enabled',
  LAST_SESSION: 'vorbis-player-last-session',

  // Visual effects
  VISUAL_EFFECTS_ENABLED: 'vorbis-player-visual-effects-enabled',
  PER_ALBUM_GLOW: 'vorbis-player-per-album-glow',
  GLOW_INTENSITY: 'vorbis-player-glow-intensity',
  GLOW_RATE: 'vorbis-player-glow-rate',
  TRANSLUCENCE_ENABLED: 'vorbis-player-translucence-enabled',
  TRANSLUCENCE_OPACITY: 'vorbis-player-translucence-opacity',
  ZEN_MODE_ENABLED: 'vorbis-player-zen-mode-enabled',

  // Background visualizer
  BG_VISUALIZER_ENABLED: 'vorbis-player-background-visualizer-enabled',
  BG_VISUALIZER_STYLE: 'vorbis-player-background-visualizer-style',
  BG_VISUALIZER_INTENSITY: 'vorbis-player-background-visualizer-intensity',
  BG_VISUALIZER_SPEED: 'vorbis-player-background-visualizer-speed',

  // Accent color configuration
  ACCENT_COLOR_BG_PREFERRED: 'vorbis-player-accent-color-background-preferred',
  ACCENT_COLOR_OVERRIDES: 'vorbis-player-accent-color-overrides',
  CUSTOM_ACCENT_COLORS: 'vorbis-player-custom-accent-colors',

  // Library and collection browsing
  VIEW_MODE: 'vorbis-player-view-mode',
  PLAYLIST_SORT: 'vorbis-player-playlist-sort',
  ALBUM_SORT: 'vorbis-player-album-sort',
  ALBUM_FILTERS: 'vorbis-player-album-filters',
  PINNED_PLAYLISTS: 'vorbis-player-pinned-playlists',
  PINNED_ALBUMS: 'vorbis-player-pinned-albums',
  RECENTLY_PLAYED: 'vorbis-player-recently-played',
  LIBRARY_ROUTE_PROVIDER_FILTER: 'vorbis-player-library-route-provider-filter',
  LIBRARY_ROUTE_KIND_FILTER: 'vorbis-player-library-route-kind-filter',
  LIBRARY_ROUTE_SORT: 'vorbis-player-library-route-sort',

  // Spotify authentication
  SPOTIFY_TOKEN: 'vorbis-player-spotify-token',
  SPOTIFY_CODE_VERIFIER: 'vorbis-player-spotify-code-verifier',

  // Dropbox authentication and sync
  DROPBOX_TOKEN: 'vorbis-player-dropbox-token',
  DROPBOX_REFRESH_TOKEN: 'vorbis-player-dropbox-refresh-token',
  DROPBOX_TOKEN_EXPIRY: 'vorbis-player-dropbox-token-expiry',
  DROPBOX_CODE_VERIFIER: 'vorbis-player-dropbox-code-verifier',
  DROPBOX_OAUTH_STATE: 'vorbis-player-dropbox-oauth-state',

  // Sync and preferences
  PREFERENCES_SYNC_UPDATED_AT: 'vorbis-player-preferences-sync-updatedAt',

  // Queue and Spotify sync
  SPOTIFY_QUEUE_SYNC: 'vorbis-player-spotify-queue-sync-enabled',
  SPOTIFY_QUEUE_CROSS_PROVIDER: 'vorbis-player-spotify-queue-resolve-cross-provider',

  // Cache / IndexedDB database names (also used as IDB `name`)
  LIKED_COUNT_SNAPSHOTS: 'vorbis-player-liked-count-snapshots',
  LIBRARY: 'vorbis-player-library',
  SETTINGS: 'vorbis-player-settings',

  // UI prefs
  QAP_ENABLED: 'vorbis-player-qap-enabled',
  WELCOME_SEEN: 'vorbis-player-welcome-seen',

  // Debug and development
  PROFILING: 'vorbis-player-profiling',
  DEBUG_OVERLAY: 'vorbis-player-debug-overlay',
  VISUALIZER_DEBUG_OVERRIDES: 'vorbis-player-visualizer-debug-overrides',
  DEVBUG_ENABLED: 'vorbis-player-devbug',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Pre-#1706 unprefixed Spotify keys. Read once for migration / purge leftovers,
 * then removed. Do not write these.
 */
export const LEGACY_SPOTIFY_STORAGE_KEYS = {
  TOKEN: 'spotify_token',
  CODE_VERIFIER: 'spotify_code_verifier',
} as const;
