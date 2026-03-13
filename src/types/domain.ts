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
  artistsData?: { name: string; url?: string }[];
  album: string;
  albumId?: string;
  trackNumber?: number;
  durationMs: number;
  /** Main image URL (album art). */
  image?: string;
  /** Optional preview or external link (e.g. Spotify track URL). */
  externalUrl?: string;
  /** MusicBrainz Recording ID (from TXXX:MusicBrainz Release Track Id or UFID). */
  musicbrainzRecordingId?: string;
  /** MusicBrainz Artist ID (from TXXX:MusicBrainz Artist Id). */
  musicbrainzArtistId?: string;
  /** International Standard Recording Code (from TSRC frame). */
  isrc?: string;
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
  description?: string | null;
  imageUrl?: string;
  trackCount?: number;
  ownerName?: string | null;
  /** Revision/cursor for change detection (e.g. snapshot_id, cursor, hash). */
  revision?: string | null;
}

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
  trackMetadata?: Partial<Pick<MediaTrack, 'name' | 'artists' | 'album' | 'image' | 'durationMs'>>;
  /** Set when the provider encounters a playback error; cleared after one notification cycle. */
  playbackError?: { code: number; message: string };
}

/** Serializable form of CollectionRef for storage/URL (e.g. "spotify:playlist:xxx", "dropbox:folder:/Music"). */
export function collectionRefToKey(ref: CollectionRef): string {
  if (ref.kind === 'liked') {
    return `${ref.provider}:liked:`;
  }
  return `${ref.provider}:${ref.kind}:${ref.id}`;
}

/** Parse a stored key back into CollectionRef if possible. */
export function keyToCollectionRef(key: string): CollectionRef | null {
  const parts = key.split(':');
  if (parts.length < 3) return null;
  const [provider, kind, ...idParts] = parts;
  const id = idParts.join(':');
  if (provider !== 'spotify' && provider !== 'dropbox') return null;
  if (!['playlist', 'album', 'folder', 'liked'].includes(kind)) return null;
  return { provider: provider as ProviderId, kind: kind as CollectionRef['kind'], id };
}
