export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface SnapshotMeta {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  generatorVersion: string;
  provider: 'spotify' | 'dropbox';
  anonymizationSeed: string;
}

export interface SnapshotUserProfile {
  displayName: string;
  hashedId: string;
}

export interface SnapshotImage {
  url: string;
  width?: number;
  height?: number;
}

export interface SnapshotArtist {
  name: string;
  externalUrl?: string;
}

export interface SnapshotTrack {
  id: string;
  name: string;
  artists: SnapshotArtist[];
  artistsDisplay: string;
  album: { id: string; name: string };
  durationMs: number;
  trackNumber?: number;
  ref: string;
  externalUrl?: string;
  isrc?: string;
  musicbrainzRecordingId?: string;
  musicbrainzArtistId?: string;
  addedAt?: number;
  genres?: string[];
  image?: SnapshotImage;
}

export interface SnapshotPlaylist {
  id: string;
  name: string;
  description: string;
  image?: SnapshotImage;
  ownerName: string;
  trackCount: number;
  revision: string | null;
  trackIds: string[];
}

export interface SnapshotAlbum {
  id: string;
  name: string;
  artists: SnapshotArtist[];
  image?: SnapshotImage;
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
  tracks: Record<string, SnapshotTrack>;
  playlists: SnapshotPlaylist[];
  albums: SnapshotAlbum[];
  likedTrackIds: string[];
  pins: SnapshotPins;
}

export type SpotifySnapshot = ProviderSnapshot & { meta: { provider: 'spotify' } };
export type DropboxSnapshot = ProviderSnapshot & { meta: { provider: 'dropbox' } };

export function assertProviderSnapshot(
  value: unknown,
  expectedProvider: 'spotify' | 'dropbox',
): asserts value is ProviderSnapshot {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`[snapshot] Expected object, got ${typeof value}`);
  }
  const v = value as Record<string, unknown>;

  if (typeof v['meta'] !== 'object' || v['meta'] === null) {
    throw new Error('[snapshot] Missing or invalid "meta" field');
  }
  const meta = v['meta'] as Record<string, unknown>;

  if (meta['schemaVersion'] !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(
      `[snapshot] Schema version mismatch: expected ${SNAPSHOT_SCHEMA_VERSION}, got ${String(meta['schemaVersion'])}`,
    );
  }
  if (meta['provider'] !== expectedProvider) {
    throw new Error(
      `[snapshot] Provider mismatch: expected "${expectedProvider}", got "${String(meta['provider'])}"`,
    );
  }
  if (typeof v['user'] !== 'object' || v['user'] === null) {
    throw new Error('[snapshot] Missing or invalid "user" field');
  }
  if (typeof v['tracks'] !== 'object' || v['tracks'] === null) {
    throw new Error('[snapshot] Missing or invalid "tracks" field');
  }
  if (!Array.isArray(v['playlists'])) {
    throw new Error('[snapshot] Missing or invalid "playlists" field');
  }
  if (!Array.isArray(v['albums'])) {
    throw new Error('[snapshot] Missing or invalid "albums" field');
  }
  if (!Array.isArray(v['likedTrackIds'])) {
    throw new Error('[snapshot] Missing or invalid "likedTrackIds" field');
  }
  if (typeof v['pins'] !== 'object' || v['pins'] === null) {
    throw new Error('[snapshot] Missing or invalid "pins" field');
  }
}
