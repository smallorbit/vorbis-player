export const STORAGE_KEYS = {
  // Provider configuration
  ACTIVE_PROVIDER: 'vorbis-player-active-provider',
  ENABLED_PROVIDERS: 'vorbis-player-enabled-providers',

  // Playback and player state
  VOLUME: 'vorbis-player-volume',
  MUTED: 'vorbis-player-muted',
  SHUFFLE_ENABLED: 'vorbis-player-shuffle-enabled',

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

  // Cache
  CACHE_ALBUMS: 'vorbis-player-cache-albums',
  CACHE_PLAYLISTS: 'vorbis-player-cache-playlists',
  LIKED_COUNT_SNAPSHOTS: 'vorbis-player-liked-count-snapshots',
  LIBRARY: 'vorbis-player-library',
  SETTINGS: 'vorbis-player-settings',

  // Debug and development
  PROFILING: 'vorbis-player-profiling',
  DEBUG_OVERLAY: 'vorbis-player-debug-overlay',
  VISUALIZER_DEBUG_OVERRIDES: 'vorbis-player-visualizer-debug-overrides',
} as const;
