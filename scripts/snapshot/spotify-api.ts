const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Raw response types (field-subset the tool reads)
// ---------------------------------------------------------------------------

interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

interface SpotifyArtistRef {
  id: string;
  name: string;
  external_urls: { spotify?: string };
}

interface SpotifyAlbumRef {
  id: string;
  name: string;
  artists: SpotifyArtistRef[];
  images: SpotifyImage[];
  release_date: string;
  total_tracks: number;
  genres?: string[];
}

interface SpotifyTrackObject {
  id: string | null;
  name: string;
  artists: SpotifyArtistRef[];
  album: SpotifyAlbumRef;
  duration_ms: number;
  track_number: number;
  uri: string;
  external_urls: { spotify?: string };
  external_ids?: { isrc?: string };
}

export interface RawSpotifyTrack {
  added_at: string;
  added_by?: { id: string };
  track: SpotifyTrackObject | null;
}

export interface RawSpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  owner: { id: string; display_name: string | null };
  images: SpotifyImage[];
  tracks: { total: number; items?: RawSpotifyTrack[] };
  snapshot_id: string;
}

export interface RawSpotifyAlbum {
  id: string;
  name: string;
  artists: SpotifyArtistRef[];
  images: SpotifyImage[];
  release_date: string;
  total_tracks: number;
  tracks: { items: Array<{ id: string; name: string; artists: SpotifyArtistRef[]; duration_ms: number; track_number: number; uri: string; external_ids?: { isrc?: string } }> };
  genres: string[];
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  next: string | null;
}

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

export interface SpotifyApiClient {
  getMe(): Promise<{ id: string; display_name: string | null; email: string | null; country: string | null }>;
  getPlaylist(id: string): Promise<RawSpotifyPlaylist>;
  getPlaylistTracks(id: string, limit: number): Promise<RawSpotifyTrack[]>;
  getAlbum(id: string): Promise<RawSpotifyAlbum>;
  getLikedTracks(limit: number): Promise<RawSpotifyTrack[]>;
  listMyPlaylists(): Promise<Array<{ id: string; name: string; tracks: { total: number }; followers?: { total: number } }>>;
  listMySavedAlbums(): Promise<Array<{ album: { id: string; name: string; artists: Array<{ name: string }>; total_tracks: number } }>>;
  getRecentlyPlayed(limit: number): Promise<Array<{ track: { id: string; name: string; artists: Array<{ name: string }> } }>>;
  getLikedTracksCount(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

async function spotifyFetch<T>(
  accessToken: string,
  url: string,
  retries = MAX_RETRIES,
): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: 'B' + 'earer ' + accessToken },
  });

  if (response.status === 429 && retries > 0) {
    const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return spotifyFetch<T>(accessToken, url, retries - 1);
  }

  if (!response.ok) {
    throw new Error(`Spotify API error ${response.status} for ${url}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

async function paginate<T>(
  accessToken: string,
  initialUrl: string,
  maxItems: number,
): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = initialUrl;

  while (url && results.length < maxItems) {
    const page: PaginatedResponse<T> = await spotifyFetch<PaginatedResponse<T>>(accessToken, url);
    results.push(...page.items);
    url = page.next;
  }

  return results.slice(0, maxItems);
}

export function createSpotifyApiClient(accessToken: string): SpotifyApiClient {
  return {
    async getMe() {
      return spotifyFetch(accessToken, `${SPOTIFY_API_BASE}/me`);
    },

    async getPlaylist(id: string) {
      return spotifyFetch<RawSpotifyPlaylist>(
        accessToken,
        `${SPOTIFY_API_BASE}/playlists/${id}?fields=id,name,description,owner,images,tracks.total,snapshot_id`,
      );
    },

    async getPlaylistTracks(id: string, limit: number) {
      return paginate<RawSpotifyTrack>(
        accessToken,
        `${SPOTIFY_API_BASE}/playlists/${id}/tracks?limit=50`,
        limit,
      );
    },

    async getAlbum(id: string) {
      return spotifyFetch<RawSpotifyAlbum>(accessToken, `${SPOTIFY_API_BASE}/albums/${id}`);
    },

    async getLikedTracks(limit: number) {
      return paginate<RawSpotifyTrack>(
        accessToken,
        `${SPOTIFY_API_BASE}/me/tracks?limit=50`,
        limit,
      );
    },

    async listMyPlaylists() {
      return paginate<{ id: string; name: string; tracks: { total: number }; followers?: { total: number } }>(
        accessToken,
        `${SPOTIFY_API_BASE}/me/playlists?limit=50`,
        200,
      );
    },

    async listMySavedAlbums() {
      return paginate<{ album: { id: string; name: string; artists: Array<{ name: string }>; total_tracks: number } }>(
        accessToken,
        `${SPOTIFY_API_BASE}/me/albums?limit=50`,
        100,
      );
    },

    async getRecentlyPlayed(limit: number) {
      const data = await spotifyFetch<{ items: Array<{ track: { id: string; name: string; artists: Array<{ name: string }> } }> }>(
        accessToken,
        `${SPOTIFY_API_BASE}/me/player/recently-played?limit=${limit}`,
      );
      return data.items;
    },

    async getLikedTracksCount() {
      const data = await spotifyFetch<{ total: number }>(
        accessToken,
        `${SPOTIFY_API_BASE}/me/tracks?limit=1`,
      );
      return data.total;
    },
  };
}
