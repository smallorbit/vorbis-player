export const SNAPSHOT_CONFIG_VERSION = 1;

export interface SnapshotConfig {
  version: typeof SNAPSHOT_CONFIG_VERSION;
  spotify: SpotifySnapshotConfig;
  dropbox: DropboxSnapshotConfig;
}

export interface SpotifySnapshotConfig {
  enabled: boolean;
  /** Spotify playlist ids (no "spotify:playlist:" prefix). */
  playlistIds: string[];
  /** Spotify album ids. */
  albumIds: string[];
  /** Liked tracks: take newest N. */
  likedTracks: { limit: number };
  /** Per-playlist track cap to keep snapshot small. */
  playlistTrackLimit: number;
  /** Curated pin IDs that the mock provider should seed into the unified pin namespace. */
  pins: { playlistIds: string[]; albumIds: string[] };
}

export interface DropboxSnapshotConfig {
  enabled: boolean;
  /** Dropbox folder paths to walk (each becomes one or more albums depending on subfolders). */
  folderPaths: string[];
  /** Per-folder track cap. */
  trackLimitPerFolder: number;
  /** Saved-playlists files in Dropbox app folder to capture. */
  savedPlaylistPaths: string[];
  /** Liked-tracks file path. */
  likesFilePath: string;
  /** Liked tracks: take newest N. */
  likedTracks: { limit: number };
  /** Curated pin IDs. Album IDs are folder paths, e.g. "/Pink Floyd/The Wall". */
  pins: { playlistIds: string[]; albumIds: string[] };
}

export interface SnapshotSeed {
  /** Hex-encoded 16-byte random salt. Not a secret; just a reproducibility input. */
  anonymizationSeed: string;
  /** ISO-8601 timestamp this seed was generated. */
  generatedAt: string;
}
