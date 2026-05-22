/**
 * Provider-neutral domain models for music playback.
 * Used by the app and all provider adapters; avoids coupling to any single source (Spotify, Dropbox, etc.).
 */

/** Unique identifier for a music provider (e.g. 'spotify', 'dropbox'). */
export type ProviderId = 'spotify' | 'dropbox';

/** Reference to a track for playback. Opaque to the app; provider resolves to stream URL or API call. */
export interface PlaybackItemRef {
  provider: ProviderId;
  /** Provider-specific ref (e.g. Spotify URI, Dropbox path or temp link id). */
  ref: string;
}

/** Structured artist reference used for display and external links. */
export interface ArtistRef {
  name: string;
  url?: string;
}

/**
 * Normalized track for UI and queue. All providers map their native track to this shape.
 */
export interface MediaTrack {
  id: string;
  provider: ProviderId;
  /** Used by playback provider to play this track. */
  playbackRef: PlaybackItemRef;
  name: string;
  artists: string;
  /** Optional structured artist data for links/display. */
  artistsData?: ArtistRef[];
  album: string;
  albumId?: string;
  trackNumber?: number;
  durationMs: number;
  /** Main image URL (album art). */
  image?: string;
  /** Optional preview or external link (e.g. Spotify track URL). */
  externalUrl?: string;
  musicbrainzRecordingId?: string;
  musicbrainzArtistId?: string;
  isrc?: string;
  /** Epoch ms when the track was added/liked. Populated for liked tracks to enable cross-provider sorting. */
  addedAt?: number;
  /** Genre tags for the track (e.g. from album metadata). Empty array means unavailable. */
  genres: string[];
}

/**
 * Kind of collection (playlist, album, folder, liked, etc.).
 */
export type CollectionKind = 'playlist' | 'album' | 'folder' | 'liked';

/**
 * Reference to a collection (playlist, album, folder, liked) for a given provider.
 * Replaces raw string IDs like "album:xxx" / "liked-songs" with a typed structure.
 */
export type CollectionRef =
  | { provider: ProviderId; kind: 'playlist'; id: string }
  | { provider: ProviderId; kind: 'album'; id: string }
  | { provider: ProviderId; kind: 'folder'; id: string }
  | { provider: ProviderId; kind: 'liked' };

/**
 * Normalized collection for library UI. All providers map playlists/albums/folders to this.
 */
export interface MediaCollection {
  id: string;
  provider: ProviderId;
  kind: CollectionKind;
  name: string;
  description?: string;
  imageUrl?: string;
  trackCount?: number;
  ownerName?: string;
  /** Revision/cursor for change detection (e.g. snapshot_id, cursor, hash). */
  revision?: string;
  /** Release date string (e.g. "2023", "2023-05-17") for sorting. */
  releaseDate?: string;
  /** Album paths for mosaic thumbnails (multi-album playlists). Resolved to art at render time via IndexedDB cache. */
  mosaicAlbumPaths?: string[];
  /** Genre tags for the collection (e.g. from album metadata). Empty array means unavailable. */
  genres: string[];
}

/** Structured playback error reported by providers. */
export interface PlaybackError {
  code: number;
  message: string;
}

/**
 * Subset of `MediaTrack` fields that may be overlaid by enriched metadata
 * (e.g. ID3 tags) over the values produced by the catalog adapter.
 */
export type TrackMetadataOverlay = Partial<Pick<MediaTrack,
  'name' | 'artists' | 'album' | 'image' | 'durationMs'
>>;

/**
 * Playback state as seen by the app (provider-agnostic).
 */
export interface PlaybackState {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  currentTrackId: string | null;
  currentPlaybackRef: PlaybackItemRef | null;
  /** Enriched metadata read from audio file tags (e.g. ID3). Overrides filename-derived values. */
  trackMetadata?: TrackMetadataOverlay;
  /** Set when the provider encounters a playback error; cleared after one notification cycle. */
  playbackError?: PlaybackError;
}

/** Serializable form of CollectionRef for storage/URL (e.g. "spotify:playlist:xxx", "dropbox:folder:/Music"). */
export function collectionRefToKey(ref: CollectionRef): string {
  if (ref.kind === 'liked') {
    return `${ref.provider}:liked:`;
  }
  return `${ref.provider}:${ref.kind}:${ref.id}`;
}

/** Result of appending a collection to the queue; used for confirmation UI. */
export interface AddToQueueResult {
  added: number;
  /** Display name from the library (album or playlist title). */
  collectionName?: string;
}

const COLLECTION_KINDS = ['playlist', 'album', 'folder', 'liked'] as const;
type ParseableCollectionKind = typeof COLLECTION_KINDS[number];

function isProviderId(x: string): x is ProviderId {
  return x === 'spotify' || x === 'dropbox';
}

function isCollectionKind(x: string): x is ParseableCollectionKind {
  return (COLLECTION_KINDS as readonly string[]).includes(x);
}

/** Parse a stored key back into CollectionRef if possible. */
export function keyToCollectionRef(key: string): CollectionRef | null {
  const parts = key.split(':');
  if (parts.length < 3) return null;
  const [provider = '', kind = '', ...idParts] = parts;
  if (!isProviderId(provider) || !isCollectionKind(kind)) return null;
  if (kind === 'liked') return { provider, kind };
  const id = idParts.join(':');
  if (!id) return null;
  return { provider, kind, id };
}
