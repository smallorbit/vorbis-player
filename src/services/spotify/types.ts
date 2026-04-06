import type { ProviderId } from '@/types/domain';

// =============================================================================
// Types
// =============================================================================

/**
 * Internal Spotify Track type — used for caching and transformations.
 * Converted to MediaTrack for use throughout the application.
 */
export interface Track {
  id: string;
  provider: string;
  name: string;
  artists: string;
  artistsData?: { name: string; url?: string }[];
  album: string;
  album_id?: string;
  track_number?: number;
  duration_ms: number;
  uri: string;
  preview_url?: string;
  image?: string;
  added_at?: number;
}

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export interface ArtistInfo {
  name: string;
  url?: string;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  tracks: { total: number } | null;
  owner: { display_name: string } | null;
  added_at?: string; // ISO 8601 timestamp when added to library
  snapshot_id?: string; // Spotify revision identifier for change detection
  /** Which provider this playlist belongs to (for multi-provider library view). */
  provider?: ProviderId;
  /** Album folder paths for Dropbox mosaic thumbnails — resolved to art at render time via IndexedDB cache. */
  mosaicAlbumPaths?: string[];
}

export interface AlbumInfo {
  id: string;
  name: string;
  artists: string;
  images: SpotifyImage[];
  release_date: string;
  total_tracks: number;
  uri: string;
  album_type?: string;
  added_at?: string; // ISO 8601 timestamp when saved to library
  /** Which provider this album belongs to (for multi-provider library view). */
  provider?: ProviderId;
}

interface SpotifyArtist {
  id?: string;
  name: string;
  external_urls?: { spotify?: string };
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export function getLargestImage(images: SpotifyImage[] | undefined): string | undefined {
  if (!images?.length) return undefined;
  return images.reduce((best, img) => ((img.width ?? 0) > (best.width ?? 0) ? img : best)).url;
}

interface SpotifyAlbum {
  id?: string;
  name?: string;
  images?: SpotifyImage[];
  uri?: string;
  release_date?: string;
  total_tracks?: number;
  album_type?: string;
  artists?: SpotifyArtist[];
}

interface SpotifyTrackItem {
  id: string | null;
  name: string;
  type: string;
  artists?: SpotifyArtist[];
  album?: SpotifyAlbum;
  duration_ms?: number;
  uri: string;
  preview_url?: string;
  track_number?: number;
  is_local?: boolean;
}

interface PaginatedResponse<T> {
  items: T[];
  next: string | null;
  total?: number;
}

// Re-export internal types for use by other spotify modules
export type { TokenData, SpotifyArtist, SpotifyAlbum, SpotifyTrackItem, PaginatedResponse };
