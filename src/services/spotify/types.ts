// =============================================================================
// Spotify wire types
// =============================================================================
//
// These shapes mirror the Spotify Web API responses. They are internal to
// `src/services/spotify/` — every public function converts them to the neutral
// domain model (`MediaTrack` / `MediaCollection`) exactly once, at this
// boundary. Nothing outside the Spotify perimeter may import from this module.

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

/** Raw playlist object as returned by GET /me/playlists. */
export interface PlaylistInfo {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  tracks: { total: number } | null;
  owner: { display_name: string } | null;
  snapshot_id?: string; // Spotify revision identifier for change detection
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
  /** Present on full album objects (e.g. GET /albums/{id}); absent on simplified objects in library listings. */
  genres?: string[];
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
