/**
 * Spotify Authentication and API Service
 *
 * Handles OAuth 2.0 PKCE authentication and Spotify Web API requests.
 */

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-library-modify',
  'user-top-read',
];

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const CACHE_DURATION_MS = 5 * 60 * 1000;
const CACHE_KEY_PREFIX = 'vorbis-player-cache-';

// =============================================================================
// Types
// =============================================================================

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export interface Track {
  id: string;
  name: string;
  artists: string;
  album: string;
  album_id?: string;
  track_number?: number;
  duration_ms: number;
  uri: string;
  preview_url?: string;
  image?: string;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  tracks: { total: number };
  owner: { display_name: string };
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
}

interface SpotifyArtist {
  name: string;
}

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
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

// =============================================================================
// Shared Utilities
// =============================================================================

function formatArtists(artists?: SpotifyArtist[]): string {
  if (!artists || artists.length === 0) {
    return 'Unknown Artist';
  }
  return artists.map(function (artist) {
    return artist.name;
  }).join(', ');
}

function transformTrackItem(
  item: SpotifyTrackItem,
  albumOverride?: { name: string; id?: string; image?: string }
): Track | null {
  if (!item.id || item.type !== 'track') return null;

  const albumImage = albumOverride?.image ?? item.album?.images?.[0]?.url;

  return {
    id: item.id,
    name: item.name,
    artists: formatArtists(item.artists),
    album: albumOverride?.name ?? item.album?.name ?? 'Unknown Album',
    album_id: albumOverride?.id ?? item.album?.id,
    track_number: item.track_number,
    duration_ms: item.duration_ms ?? 0,
    uri: item.uri,
    preview_url: item.preview_url,
    image: albumImage,
  };
}

async function spotifyApiRequest<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

async function fetchAllPaginated<TItem, TResult>(
  initialUrl: string,
  token: string,
  transformItem: (item: TItem) => TResult | null,
  options?: { signal?: AbortSignal; maxItems?: number }
): Promise<TResult[]> {
  const results: TResult[] = [];
  let nextUrl: string | null = initialUrl;

  while (nextUrl) {
    if (options?.signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    const data: PaginatedResponse<TItem> = await spotifyApiRequest<PaginatedResponse<TItem>>(nextUrl, token, {
      signal: options?.signal,
    });

    for (const item of data.items ?? []) {
      if (options?.maxItems && results.length >= options.maxItems) {
        return results;
      }
      const transformed = transformItem(item);
      if (transformed !== null) {
        results.push(transformed);
      }
    }

    nextUrl = data.next;
  }

  return results;
}

// =============================================================================
// Cache Management
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCacheFromStorage<T>(key: string): CacheEntry<T> | null {
  const stored = localStorage.getItem(CACHE_KEY_PREFIX + key);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function setCacheToStorage<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() };
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Ignore localStorage quota errors
  }
}

function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_DURATION_MS;
}

export function clearLibraryCache(): void {
  localStorage.removeItem(CACHE_KEY_PREFIX + 'playlists');
  localStorage.removeItem(CACHE_KEY_PREFIX + 'albums');
}

export function getCachedData<T>(key: string): T | null {
  const cached = getCacheFromStorage<T>(key);
  return isCacheValid(cached) ? cached.data : null;
}

// =============================================================================
// SpotifyAuth Class
// =============================================================================

class SpotifyAuth {
  private tokenData: TokenData | null = null;

  constructor() {
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage(): void {
    const stored = localStorage.getItem('spotify_token');
    if (!stored) return;

    try {
      const tokenData = JSON.parse(stored);
      if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
        localStorage.removeItem('spotify_token');
        return;
      }
      this.tokenData = tokenData;
    } catch {
      localStorage.removeItem('spotify_token');
    }
  }

  private saveTokenToStorage(tokenData: TokenData): void {
    this.tokenData = tokenData;
    localStorage.setItem('spotify_token', JSON.stringify(tokenData));
  }

  private base64UrlEncode(bytes: Uint8Array): string {
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  public async getAuthUrl(): Promise<string> {
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined. Please set it in your .env.local file.');
    }

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      scope: SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  public async handleAuthCallback(code: string): Promise<void> {
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined.');
    }

    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      throw new Error('Code verifier not found. Please restart the authentication flow.');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    this.saveTokenToStorage({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });

    localStorage.removeItem('spotify_code_verifier');
  }

  public async refreshAccessToken(): Promise<void> {
    if (!this.tokenData?.refresh_token) {
      throw new Error('No refresh token available');
    }

    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined.');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokenData.refresh_token,
        client_id: SPOTIFY_CLIENT_ID,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.saveTokenToStorage({
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokenData.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
  }

  public async ensureValidToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('No authentication token available');
    }

    const expiresAt = this.tokenData.expires_at;
    const refreshThreshold = expiresAt - TOKEN_REFRESH_BUFFER_MS;
    if (Date.now() > refreshThreshold) {
      await this.refreshAccessToken();
    }

    return this.tokenData.access_token;
  }

  public isAuthenticated(): boolean {
    return !!this.tokenData?.access_token;
  }

  public async redirectToAuth(): Promise<void> {
    const authUrl = await this.getAuthUrl();
    window.location.href = authUrl;
  }

  public logout(): void {
    this.tokenData = null;
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_code_verifier');
  }

  public async handleRedirect(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      this.logout();
      throw new Error(`Spotify auth error: ${error}`);
    }

    const isCallbackPath = window.location.pathname === '/auth/spotify/callback';
    if (!code || !isCallbackPath) {
      return;
    }

    const processedCode = sessionStorage.getItem('spotify_processed_code');
    if (processedCode === code) {
      window.history.replaceState({}, document.title, '/');
      return;
    }

    try {
      await this.handleAuthCallback(code);
      sessionStorage.setItem('spotify_processed_code', code);
      window.history.replaceState({}, document.title, '/');
    } catch (e) {
      sessionStorage.removeItem('spotify_processed_code');

      if (e instanceof Error && e.message.includes('Code verifier not found')) {
        this.logout();
        await this.redirectToAuth();
        return;
      }

      this.logout();
      throw e;
    }
  }

  public getAccessToken(): string | null {
    return this.tokenData?.access_token ?? null;
  }
}

export const spotifyAuth = new SpotifyAuth();

// =============================================================================
// API Functions
// =============================================================================

export async function getUserPlaylists(signal?: AbortSignal): Promise<PlaylistInfo[]> {
  const cached = getCacheFromStorage<PlaylistInfo[]>('playlists');
  if (isCacheValid(cached)) {
    return cached.data;
  }

  const token = await spotifyAuth.ensureValidToken();

  const playlists = await fetchAllPaginated<PlaylistInfo, PlaylistInfo>(
    'https://api.spotify.com/v1/me/playlists?limit=50',
    token,
    function (playlist) {
      return playlist;
    },
    { signal }
  );

  setCacheToStorage('playlists', playlists);
  return playlists;
}

export async function getUserAlbums(signal?: AbortSignal): Promise<AlbumInfo[]> {
  const cached = getCacheFromStorage<AlbumInfo[]>('albums');
  if (isCacheValid(cached)) {
    return cached.data;
  }

  const token = await spotifyAuth.ensureValidToken();

  interface SavedAlbumItem {
    album: SpotifyAlbum;
  }

  function transformSavedAlbum(item: SavedAlbumItem): AlbumInfo {
    const album = item.album;
    return {
      id: album.id ?? '',
      name: album.name ?? 'Unknown Album',
      artists: formatArtists(album.artists),
      images: album.images ?? [],
      release_date: album.release_date ?? '',
      total_tracks: album.total_tracks ?? 0,
      uri: album.uri ?? '',
      album_type: album.album_type,
    };
  }

  const albums = await fetchAllPaginated<SavedAlbumItem, AlbumInfo>(
    'https://api.spotify.com/v1/me/albums?limit=50',
    token,
    transformSavedAlbum,
    { signal }
  );

  setCacheToStorage('albums', albums);
  return albums;
}

export async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
  const token = await spotifyAuth.ensureValidToken();

  interface PlaylistTrackItem {
    track: SpotifyTrackItem | null;
  }

  function transformPlaylistTrack(item: PlaylistTrackItem): Track | null {
    if (!item.track) {
      return null;
    }
    return transformTrackItem(item.track);
  }

  return fetchAllPaginated<PlaylistTrackItem, Track>(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
    token,
    transformPlaylistTrack
  );
}

export async function getAlbumTracks(albumId: string): Promise<Track[]> {
  const token = await spotifyAuth.ensureValidToken();

  interface AlbumResponse {
    id: string;
    name: string;
    images?: SpotifyImage[];
    tracks: { items: SpotifyTrackItem[] };
  }

  const album = await spotifyApiRequest<AlbumResponse>(
    `https://api.spotify.com/v1/albums/${albumId}`,
    token
  );

  const albumImage = album.images?.[0]?.url;
  const tracks: Track[] = [];

  for (const trackItem of album.tracks.items ?? []) {
    const track = transformTrackItem(trackItem, {
      name: album.name,
      id: album.id,
      image: albumImage,
    });
    if (track) {
      tracks.push(track);
    }
  }

  return tracks.sort((a, b) => (a.track_number ?? 0) - (b.track_number ?? 0));
}

export async function getLikedSongs(limit: number = 50): Promise<Track[]> {
  const token = await spotifyAuth.ensureValidToken();

  interface SavedTrackItem {
    track: SpotifyTrackItem | null;
  }

  function transformSavedTrack(item: SavedTrackItem): Track | null {
    if (!item.track) {
      return null;
    }
    return transformTrackItem(item.track);
  }

  const maxLimit = Math.min(limit, 50);
  return fetchAllPaginated<SavedTrackItem, Track>(
    `https://api.spotify.com/v1/me/tracks?limit=${maxLimit}`,
    token,
    transformSavedTrack,
    { maxItems: limit }
  );
}

export async function getLikedSongsCount(signal?: AbortSignal): Promise<number> {
  const token = await spotifyAuth.ensureValidToken();

  interface LikedSongsResponse {
    total: number;
  }

  const data = await spotifyApiRequest<LikedSongsResponse>(
    'https://api.spotify.com/v1/me/tracks?limit=1',
    token,
    { signal }
  );

  return data.total ?? 0;
}

export async function checkTrackSaved(trackId: string): Promise<boolean> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<boolean[]>(
    `https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`,
    token
  );
  return data[0] ?? false;
}

async function modifyTrackSaved(trackId: string, save: boolean): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();
  const method = save ? 'PUT' : 'DELETE';
  await spotifyApiRequest<void>('https://api.spotify.com/v1/me/tracks', token, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [trackId] }),
  });
}

export async function saveTrack(trackId: string): Promise<void> {
  return modifyTrackSaved(trackId, true);
}

export async function unsaveTrack(trackId: string): Promise<void> {
  return modifyTrackSaved(trackId, false);
}

/**
 * @deprecated Use getUserPlaylists() and getPlaylistTracks() instead.
 * This function loads tracks from multiple playlists which is inefficient.
 */
export async function getSpotifyUserPlaylists(): Promise<Track[]> {
  try {
    const token = await spotifyAuth.ensureValidToken();

    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch playlists: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return [];
    }

    const tracks: Track[] = [];

    for (const playlist of (data.items || []).slice(0, 10)) {
      if (!playlist.tracks?.href) continue;

      const tracksResponse = await fetch(playlist.tracks.href + '?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();

        for (const item of tracksData.items ?? []) {
          if (item.track && item.track.id && !item.track.is_local && item.track.type === 'track') {
            const track = transformTrackItem(item.track);
            if (track) tracks.push(track);
          }
        }
      }
    }

    if (tracks.length === 0) {
      const likedResponse = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (likedResponse.ok) {
        const likedData = await likedResponse.json();

        for (const item of likedData.items ?? []) {
          if (item.track && item.track.id && !item.track.is_local && item.track.type === 'track') {
            const track = transformTrackItem(item.track);
            if (track) tracks.push(track);
          }
        }
      }
    }

    return tracks;
  } catch (error) {
    if (error instanceof Error && error.message === 'No authentication token available') {
      spotifyAuth.redirectToAuth();
      throw new Error('Redirecting to Spotify login...');
    }
    throw error;
  }
}
