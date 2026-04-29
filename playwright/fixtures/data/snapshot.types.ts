// SHARED with #1371. This file's content is the locked schema in #1371 blueprint §2.
// If #1371 has not landed yet when this PR is reviewed, content must be byte-identical
// to #1371's version. If #1371 lands first, this PR will conflict — resolve by taking
// #1371's version (it is the source of truth for the schema).

export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface SnapshotMeta {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  /** ISO-8601 UTC timestamp; for debug only — do not gate logic on it. */
  generatedAt: string;
  /** package.json version of the snapshot tool when this file was produced. */
  generatorVersion: string;
  /** Provider this snapshot is for. Always one of the existing ProviderId values. */
  provider: 'spotify' | 'dropbox';
  /** Hex-encoded random seed (16 bytes) used by the anonymizer for deterministic ID hashes within this run. */
  anonymizationSeed: string;
}

export interface SnapshotUserProfile {
  /** Always the literal "Anonymous User" — see #1372 PII rules. */
  displayName: string;
  /** Hashed user id ("user_<sha256-truncated-8>"). Stable across re-runs given same anonymizationSeed. */
  hashedId: string;
}

export interface SnapshotImage {
  /** Web-root-relative URL the mock catalog adapter returns directly, e.g. "/playwright-fixtures/art/<hash>.jpg". */
  url: string;
  /** Optional dimensions, copied verbatim from the source provider when available. */
  width?: number;
  height?: number;
}

export interface SnapshotArtist {
  name: string;
  /** External URL preserved verbatim — public catalog data. */
  externalUrl?: string;
}

export interface SnapshotTrack {
  /** Stable string id. For Spotify this is the track id, for Dropbox the file path_lower. */
  id: string;
  name: string;
  artists: SnapshotArtist[];
  /** Joined display string — duplicates artists[].name for adapter convenience. */
  artistsDisplay: string;
  album: { id: string; name: string };
  durationMs: number;
  trackNumber?: number;
  /** Value used as MediaTrack.playbackRef.ref by the mock catalog. Spotify URI; Dropbox path. */
  ref: string;
  externalUrl?: string;
  isrc?: string;
  musicbrainzRecordingId?: string;
  musicbrainzArtistId?: string;
  /** Epoch ms — when added to liked / playlist. Preserved verbatim from public catalog. */
  addedAt?: number;
  genres?: string[];
  /** Optional cover art (album art falls back to album.image when absent on track). */
  image?: SnapshotImage;
}

export interface SnapshotPlaylist {
  /** Anonymized synthetic id ("playlist_<sha256-truncated-8>"). Deterministic per-source-id. */
  id: string;
  /** Anonymized synthetic name ("My Playlist N", N is 1-based capture order). */
  name: string;
  /** Always "" after anonymization. */
  description: string;
  image?: SnapshotImage;
  /** Always "Anonymous User" after anonymization. */
  ownerName: string;
  trackCount: number;
  /** Provider-specific revision/cursor; opaque to the app. May be null. */
  revision: string | null;
  /** Ordered list of track ids referencing keys in ProviderSnapshot.tracks. */
  trackIds: string[];
}

export interface SnapshotAlbum {
  /** Source-provider id verbatim (Spotify album id, or Dropbox folder path). Catalog content is public. */
  id: string;
  name: string;
  artists: SnapshotArtist[];
  image?: SnapshotImage;
  /** YYYY or YYYY-MM-DD; verbatim. */
  releaseDate?: string;
  trackCount: number;
  trackIds: string[];
  genres?: string[];
}

export interface SnapshotPins {
  playlistIds: string[];
  albumIds: string[];
}

export interface ProviderSnapshot {
  meta: SnapshotMeta;
  user: SnapshotUserProfile;
  /** Keyed by SnapshotTrack.id for O(1) lookup from playlists/albums/liked. */
  tracks: Record<string, SnapshotTrack>;
  playlists: SnapshotPlaylist[];
  albums: SnapshotAlbum[];
  /** Ordered list of track ids (newest first). */
  likedTrackIds: string[];
  pins: SnapshotPins;
}

export type SpotifySnapshot = ProviderSnapshot & { meta: { provider: 'spotify' } };
export type DropboxSnapshot = ProviderSnapshot & { meta: { provider: 'dropbox' } };

/**
 * Runtime guard the loader uses; throws on bad shape.
 * LENIENT: extra/unknown fields are tolerated and ignored — only the required structural fields are validated.
 */
export function assertProviderSnapshot(
  value: unknown,
  expectedProvider: 'spotify' | 'dropbox',
): asserts value is ProviderSnapshot {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Snapshot must be an object');
  }
  const v = value as Record<string, unknown>;

  if (typeof v['meta'] !== 'object' || v['meta'] === null) {
    throw new Error('Snapshot.meta must be an object');
  }
  const meta = v['meta'] as Record<string, unknown>;

  if (meta['schemaVersion'] !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `Snapshot.meta.schemaVersion must be ${SNAPSHOT_SCHEMA_VERSION}, got ${String(meta['schemaVersion'])}`,
    );
  }
  if (meta['provider'] !== expectedProvider) {
    throw new Error(
      `Snapshot.meta.provider must be '${expectedProvider}', got '${String(meta['provider'])}'`,
    );
  }
  if (typeof v['user'] !== 'object' || v['user'] === null) {
    throw new Error('Snapshot.user must be an object');
  }
  if (typeof v['tracks'] !== 'object' || v['tracks'] === null) {
    throw new Error('Snapshot.tracks must be an object');
  }
  if (!Array.isArray(v['playlists'])) {
    throw new Error('Snapshot.playlists must be an array');
  }
  if (!Array.isArray(v['albums'])) {
    throw new Error('Snapshot.albums must be an array');
  }
  if (!Array.isArray(v['likedTrackIds'])) {
    throw new Error('Snapshot.likedTrackIds must be an array');
  }
  if (typeof v['pins'] !== 'object' || v['pins'] === null) {
    throw new Error('Snapshot.pins must be an object');
  }
  const pins = v['pins'] as Record<string, unknown>;
  if (!Array.isArray(pins['playlistIds']) || !Array.isArray(pins['albumIds'])) {
    throw new Error('Snapshot.pins.playlistIds and albumIds must be arrays');
  }
}
