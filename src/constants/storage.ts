/**
 * Canonical localStorage / IndexedDB name registry.
 *
 * All `vorbis-player-` prefixed string literals in production `src/` MUST live
 * here. ESLint bans hardcoded `vorbis-player-*` literals elsewhere (see
 * `eslint.config.js`). Writers go through `persistedStorage` helpers so
 * same-tab listeners stay in sync.
 */

const STORAGE_PREFIX = 'vorbis-player-' as const;

function storageKey<S extends string>(suffix: S): `${typeof STORAGE_PREFIX}${S}` {
  return `${STORAGE_PREFIX}${suffix}`;
}

export const STORAGE_KEYS = {
  // Provider configuration
  ACTIVE_PROVIDER: storageKey('active-provider'),
  ENABLED_PROVIDERS: storageKey('enabled-providers'),

  // Playback and player state
  VOLUME: storageKey('volume'),
  MUTED: storageKey('muted'),
  SHUFFLE_ENABLED: storageKey('shuffle-enabled'),
  LAST_SESSION: storageKey('last-session'),

  // Visual effects
  VISUAL_EFFECTS_ENABLED: storageKey('visual-effects-enabled'),
  PER_ALBUM_GLOW: storageKey('per-album-glow'),
  GLOW_INTENSITY: storageKey('glow-intensity'),
  GLOW_RATE: storageKey('glow-rate'),
  TRANSLUCENCE_ENABLED: storageKey('translucence-enabled'),
  TRANSLUCENCE_OPACITY: storageKey('translucence-opacity'),
  ZEN_MODE_ENABLED: storageKey('zen-mode-enabled'),

  // Background visualizer
  BG_VISUALIZER_ENABLED: storageKey('background-visualizer-enabled'),
  BG_VISUALIZER_STYLE: storageKey('background-visualizer-style'),
  BG_VISUALIZER_INTENSITY: storageKey('background-visualizer-intensity'),
  BG_VISUALIZER_SPEED: storageKey('background-visualizer-speed'),

  // Accent color configuration
  ACCENT_COLOR_BG_PREFERRED: storageKey('accent-color-background-preferred'),
  ACCENT_COLOR_OVERRIDES: storageKey('accent-color-overrides'),
  CUSTOM_ACCENT_COLORS: storageKey('custom-accent-colors'),

  // Library and collection browsing
  VIEW_MODE: storageKey('view-mode'),
  PLAYLIST_SORT: storageKey('playlist-sort'),
  ALBUM_SORT: storageKey('album-sort'),
  ALBUM_FILTERS: storageKey('album-filters'),
  PINNED_PLAYLISTS: storageKey('pinned-playlists'),
  PINNED_ALBUMS: storageKey('pinned-albums'),
  RECENTLY_PLAYED: storageKey('recently-played'),
  LIBRARY_ROUTE_PROVIDER_FILTER: storageKey('library-route-provider-filter'),
  LIBRARY_ROUTE_KIND_FILTER: storageKey('library-route-kind-filter'),
  LIBRARY_ROUTE_SORT: storageKey('library-route-sort'),

  // Spotify authentication
  SPOTIFY_TOKEN: storageKey('spotify-token'),
  SPOTIFY_CODE_VERIFIER: storageKey('spotify-code-verifier'),

  // Dropbox authentication and sync
  DROPBOX_TOKEN: storageKey('dropbox-token'),
  DROPBOX_REFRESH_TOKEN: storageKey('dropbox-refresh-token'),
  DROPBOX_TOKEN_EXPIRY: storageKey('dropbox-token-expiry'),
  DROPBOX_CODE_VERIFIER: storageKey('dropbox-code-verifier'),
  DROPBOX_OAUTH_STATE: storageKey('dropbox-oauth-state'),

  // Sync and preferences
  PREFERENCES_SYNC_UPDATED_AT: storageKey('preferences-sync-updatedAt'),

  // Queue and Spotify sync
  SPOTIFY_QUEUE_SYNC: storageKey('spotify-queue-sync-enabled'),
  SPOTIFY_QUEUE_CROSS_PROVIDER: storageKey('spotify-queue-resolve-cross-provider'),

  // Cache / IndexedDB database names (also used as IDB `name`)
  LIKED_COUNT_SNAPSHOTS: storageKey('liked-count-snapshots'),
  LIBRARY: storageKey('library'),
  SETTINGS: storageKey('settings'),

  // UI prefs
  QAP_ENABLED: storageKey('qap-enabled'),
  WELCOME_SEEN: storageKey('welcome-seen'),

  // Debug and development
  PROFILING: storageKey('profiling'),
  DEBUG_OVERLAY: storageKey('debug-overlay'),
  VISUALIZER_DEBUG_OVERRIDES: storageKey('visualizer-debug-overrides'),
  DEVBUG_ENABLED: storageKey('devbug'),
} as const;

/**
 * Pre-#1706 unprefixed Spotify keys. Read once for migration / purge leftovers,
 * then removed. Do not write these.
 */
export const LEGACY_SPOTIFY_STORAGE_KEYS = {
  TOKEN: 'spotify_token',
  CODE_VERIFIER: 'spotify_code_verifier',
} as const;
