/**
 * @fileoverview Spotify Authentication and API Service
 * 
 * Handles Spotify OAuth 2.0 authentication flow and provides access to
 * Spotify Web API endpoints. Manages token refresh, user authentication,
 * and API request handling for the Vorbis Player application.
 * 
 * @architecture
 * This service implements the OAuth 2.0 PKCE (Proof Key for Code Exchange)
 * flow for secure authentication with Spotify's API. It manages token
 * lifecycle including storage, refresh, and automatic renewal.
 * 
 * @responsibilities
 * - OAuth 2.0 PKCE authentication flow
 * - Token management and refresh
 * - Spotify Web API request handling
 * - User profile and library data retrieval
 * - Playlist management and playback control
 * 
 * @security
 * - Uses PKCE flow for enhanced security
 * - Tokens stored in localStorage with expiration checks
 * - Automatic token refresh before expiration
 * - Secure code verifier generation and validation
 * 
 * @usage
 * ```typescript
 * import { spotifyAuth } from './services/spotify';
 * 
 * // Start authentication flow
 * const authUrl = await spotifyAuth.getAuthUrl();
 * window.location.href = authUrl;
 * 
 * // Handle callback
 * await spotifyAuth.handleAuthCallback(code);
 * 
 * // Make API requests
 * const profile = await spotifyAuth.getUserProfile();
 * ```
 * 
 * @dependencies
 * - Environment variables: VITE_SPOTIFY_CLIENT_ID, VITE_SPOTIFY_REDIRECT_URI
 * - Web Crypto API: For PKCE code challenge generation
 * - localStorage: Token persistence
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

/**
 * Spotify OAuth scopes required for the application
 * 
 * Defines the permissions requested from users during authentication.
 * These scopes enable playback control, library access, and user data retrieval.
 * 
 * @constant
 * @type {string[]}
 */
const SCOPES = [
  'streaming',                    // Control playback on user's devices
  'user-read-email',             // Read user's email address
  'user-read-private',           // Read user's private information
  'user-read-playback-state',    // Read user's current playback state
  'user-modify-playback-state',  // Control playback on user's devices
  'user-read-currently-playing', // Read user's currently playing track
  'playlist-read-private',       // Read user's private playlists
  'playlist-read-collaborative', // Read user's collaborative playlists
  'user-library-read',           // Read user's saved tracks and albums
  'user-library-modify',         // Modify user's saved tracks and albums
  'user-top-read'                // Read user's top tracks and artists
];

/**
 * Token data interface for Spotify OAuth tokens
 * 
 * Represents the authentication tokens received from Spotify's OAuth flow.
 * Includes access token, optional refresh token, and expiration timestamp.
 * 
 * @interface TokenData
 * 
 * @property {string} access_token - OAuth access token for API requests
 * @property {string} [refresh_token] - Optional refresh token for token renewal
 * @property {number} expires_at - Timestamp when access token expires
 * 
 * @example
 * ```typescript
 * const tokenData: TokenData = {
 *   access_token: 'BQ...',
 *   refresh_token: 'AQ...',
 *   expires_at: 1640995200000
 * };
 * ```
 */
interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

/**
 * SpotifyAuth - Spotify OAuth 2.0 PKCE Authentication Service
 * 
 * Handles the complete OAuth 2.0 PKCE authentication flow with Spotify.
 * Manages token lifecycle, automatic refresh, and secure token storage.
 * 
 * @class
 * 
 * @example
 * ```typescript
 * const auth = new SpotifyAuth();
 * 
 * // Start authentication
 * const authUrl = await auth.getAuthUrl();
 * window.location.href = authUrl;
 * 
 * // Handle callback (called after user authorizes)
 * await auth.handleAuthCallback(authorizationCode);
 * 
 * // Check authentication status
 * if (auth.isAuthenticated()) {
 *   const profile = await auth.getUserProfile();
 * }
 * ```
 * 
 * @methods
 * - getAuthUrl(): Generate OAuth authorization URL
 * - handleAuthCallback(code): Process OAuth callback
 * - isAuthenticated(): Check if user is authenticated
 * - getAccessToken(): Get current access token
 * - refreshToken(): Refresh expired access token
 * - logout(): Clear authentication data
 * - getUserProfile(): Get user profile information
 * - getUserPlaylists(): Get user's playlists
 * - getUserTopTracks(): Get user's top tracks
 * - getUserSavedTracks(): Get user's saved tracks
 * 
 * @events
 * - tokenRefreshed: Fired when access token is refreshed
 * - authenticationChanged: Fired when authentication state changes
 * - error: Fired when authentication errors occur
 * 
 * @security
 * - Implements OAuth 2.0 PKCE flow
 * - Secure token storage with expiration checks
 * - Automatic token refresh
 * - Code verifier validation
 */
class SpotifyAuth {
  private tokenData: TokenData | null = null;

  constructor() {
    this.loadTokenFromStorage();
  }

  /**
   * Loads authentication token from localStorage
   * 
   * Retrieves stored token data and validates expiration.
   * Removes expired tokens automatically.
   * 
   * @private
   */
  private loadTokenFromStorage() {
    const stored = localStorage.getItem('spotify_token');
    if (stored) {
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
  }

  /**
   * Saves authentication token to localStorage
   * 
   * Stores token data securely with expiration information.
   * 
   * @private
   * @param tokenData - Token data to store
   */
  private saveTokenToStorage(tokenData: TokenData) {
    this.tokenData = tokenData;
    localStorage.setItem('spotify_token', JSON.stringify(tokenData));
  }

  /**
   * Generates a secure random code verifier for PKCE
   * 
   * Creates a cryptographically secure random string used
   * in the OAuth 2.0 PKCE flow for enhanced security.
   * 
   * @private
   * @returns Base64URL-encoded code verifier
   * 
   * @example
   * ```typescript
   * const verifier = this.generateCodeVerifier();
   * // Returns: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
   * ```
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generates code challenge from code verifier using SHA-256
   * 
   * Creates a SHA-256 hash of the code verifier for the PKCE flow.
   * This provides additional security by preventing authorization code
   * interception attacks.
   * 
   * @private
   * @param verifier - Code verifier string
   * @returns Promise resolving to Base64URL-encoded code challenge
   * 
   * @example
   * ```typescript
   * const challenge = await this.generateCodeChallenge(verifier);
   * // Returns: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
   * ```
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generates Spotify OAuth authorization URL
   * 
   * Creates the authorization URL that users visit to grant
   * permissions to the application. Implements PKCE flow
   * for enhanced security.
   * 
   * @returns Promise resolving to authorization URL
   * @throws {Error} If client ID is not configured
   * 
   * @example
   * ```typescript
   * const authUrl = await spotifyAuth.getAuthUrl();
   * window.location.href = authUrl;
   * ```
   */
  public async getAuthUrl(): Promise<string> {
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined. Please set it in your .env.local file.');
    }

    const code_verifier = this.generateCodeVerifier();
    const code_challenge = await this.generateCodeChallenge(code_verifier);

    localStorage.setItem('spotify_code_verifier', code_verifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: SPOTIFY_REDIRECT_URI,
      scope: SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: code_challenge,
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  /**
   * Handles OAuth callback and exchanges authorization code for tokens
   * 
   * Processes the authorization code returned by Spotify after user
   * grants permissions. Exchanges the code for access and refresh tokens.
   * 
   * @param code - Authorization code from Spotify callback
   * @returns Promise that resolves when token exchange is complete
   * @throws {Error} If client ID is missing or code verifier not found
   * 
   * @example
   * ```typescript
   * // Called after user authorizes the application
   * await spotifyAuth.handleAuthCallback(authorizationCode);
   * ```
   */
  public async handleAuthCallback(code: string): Promise<void> {
    if (!SPOTIFY_CLIENT_ID) {
      throw new Error('VITE_SPOTIFY_CLIENT_ID is not defined.');
    }

    const code_verifier = localStorage.getItem('spotify_code_verifier');
    if (!code_verifier) {
      throw new Error('Code verifier not found. Please restart the authentication flow.');
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        code_verifier,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const tokenData: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };

    this.saveTokenToStorage(tokenData);
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
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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
    const tokenData: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokenData.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };

    this.saveTokenToStorage(tokenData);
  }

  public async ensureValidToken(): Promise<string> {
    if (!this.tokenData) {
      throw new Error('No authentication token available');
    }

    if (Date.now() > this.tokenData.expires_at - 300000) {
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

    if (code && window.location.pathname === '/auth/spotify/callback') {
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
  }

  public getAccessToken(): string | null {
    return this.tokenData?.access_token || null;
  }
}

export const spotifyAuth = new SpotifyAuth();

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
  images: { url: string; height: number | null; width: number | null }[];
  tracks: { total: number };
  owner: { display_name: string };
}

export interface AlbumInfo {
  id: string;
  name: string;
  artists: string;
  images: { url: string; height: number | null; width: number | null }[];
  release_date: string;
  total_tracks: number;
  uri: string;
  album_type?: string;
}

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_PREFIX = 'vorbis-player-cache-';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function getCacheFromStorage<T>(key: string): CacheEntry<T> | null {
  try {
    const stored = localStorage.getItem(CACHE_KEY_PREFIX + key);
    if (!stored) return null;
    return JSON.parse(stored) as CacheEntry<T>;
  } catch (error) {
    console.warn('Failed to read cache from localStorage:', error);
    return null;
  }
}

function setCacheToStorage<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.warn('Failed to write cache to localStorage:', error);
  }
}

function isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  if (!entry) return false;
  const age = Date.now() - entry.timestamp;
  return age < CACHE_DURATION_MS;
}

// Export function to manually clear cache if needed
export function clearLibraryCache() {
  localStorage.removeItem(CACHE_KEY_PREFIX + 'playlists');
  localStorage.removeItem(CACHE_KEY_PREFIX + 'albums');
  console.log('🗑️ Library cache cleared');
}

// Export cache utilities for progressive loading
export function getCachedData<T>(key: string): T | null {
  const cached = getCacheFromStorage<T>(key);
  if (isCacheValid(cached)) {
    return cached.data;
  }
  return null;
}

export const getUserPlaylists = async (signal?: AbortSignal): Promise<PlaylistInfo[]> => {
  // Check localStorage cache first
  const cachedPlaylists = getCacheFromStorage<PlaylistInfo[]>('playlists');

  if (isCacheValid(cachedPlaylists)) {
    const age = Date.now() - cachedPlaylists.timestamp;
    console.log(`📦 Using cached playlists (${Math.floor(age / 1000)}s old)`);
    return cachedPlaylists.data;
  }

  console.log('🌐 Fetching playlists from Spotify API');
  const token = await spotifyAuth.ensureValidToken();

  const playlists: PlaylistInfo[] = [];
  let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';

  while (nextUrl) {
    // Check if request was aborted before each fetch
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch playlists: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    for (const playlist of data.items || []) {
      playlists.push({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        images: playlist.images || [],
        tracks: { total: playlist.tracks.total },
        owner: { display_name: playlist.owner.display_name }
      });
    }

    nextUrl = data.next;
  }

  // Store in localStorage cache
  setCacheToStorage('playlists', playlists);

  return playlists;
};

export const getUserAlbums = async (signal?: AbortSignal): Promise<AlbumInfo[]> => {
  // Check localStorage cache first
  const cachedAlbums = getCacheFromStorage<AlbumInfo[]>('albums');

  if (isCacheValid(cachedAlbums)) {
    const age = Date.now() - cachedAlbums.timestamp;
    console.log(`📦 Using cached albums (${Math.floor(age / 1000)}s old)`);
    return cachedAlbums.data;
  }

  console.log('🌐 Fetching albums from Spotify API');
  const token = await spotifyAuth.ensureValidToken();

  const albums: AlbumInfo[] = [];
  let nextUrl = 'https://api.spotify.com/v1/me/albums?limit=50';

  while (nextUrl) {
    // Check if request was aborted before each fetch
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch albums: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      const album = item.album;
      albums.push({
        id: album.id,
        name: album.name,
        artists: album.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
        images: album.images || [],
        release_date: album.release_date || '',
        total_tracks: album.total_tracks || 0,
        uri: album.uri,
        album_type: album.album_type
      });
    }

    nextUrl = data.next;
  }

  // Store in localStorage cache
  setCacheToStorage('albums', albums);

  return albums;
};

export const getPlaylistTracks = async (playlistId: string): Promise<Track[]> => {
  const token = await spotifyAuth.ensureValidToken();

  const tracks: Track[] = [];
  let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tracks: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      if (item.track?.id && item.track.type === 'track') {
        const track = item.track;
        const albumImage = track.album?.images?.[0]?.url;

        tracks.push({
          id: track.id,
          name: track.name,
          artists: track.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
          album: track.album?.name || 'Unknown Album',
          duration_ms: track.duration_ms || 0,
          uri: track.uri,
          preview_url: track.preview_url,
          image: albumImage
        });
      }
    }

    nextUrl = data.next;
  }

  return tracks;
};

export const getAlbumTracks = async (albumId: string): Promise<Track[]> => {
  const token = await spotifyAuth.ensureValidToken();

  const response = await fetch(
    `https://api.spotify.com/v1/albums/${albumId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch album: ${response.status} ${response.statusText}`);
  }

  const album = await response.json();
  const tracks: Track[] = [];

  for (const track of album.tracks.items || []) {
    if (track.id && track.type === 'track') {
      tracks.push({
        id: track.id,
        name: track.name,
        artists: track.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
        album: album.name,
        album_id: album.id,
        track_number: track.track_number,
        duration_ms: track.duration_ms || 0,
        uri: track.uri,
        preview_url: track.preview_url,
        image: album.images?.[0]?.url
      });
    }
  }

  // Sort by track number to ensure correct album order
  return tracks.sort((a, b) => (a.track_number || 0) - (b.track_number || 0));
};

export const getSpotifyUserPlaylists = async (): Promise<Track[]> => {
  try {
    const token = await spotifyAuth.ensureValidToken();

    const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
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
      if (!playlist.tracks?.href) {
        continue;
      }

      const tracksResponse = await fetch(playlist.tracks.href + '?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (tracksResponse.ok) {
        const tracksData = await tracksResponse.json();

        for (const item of (tracksData.items || [])) {
          if (item.track && item.track.id && !item.track.is_local && item.track.type === 'track') {
            tracks.push({
              id: item.track.id,
              name: item.track.name || 'Unknown Track',
              artists: (item.track.artists || []).map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
              album: item.track.album?.name || 'Unknown Album',
              duration_ms: item.track.duration_ms || 0,
              uri: item.track.uri,
              preview_url: item.track.preview_url,
              image: item.track.album?.images?.[0]?.url,
            });
          }
        }
      }
    }

    if (tracks.length === 0) {
      const likedResponse = await fetch('https://api.spotify.com/v1/me/tracks?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (likedResponse.ok) {
        const likedData = await likedResponse.json();

        for (const item of (likedData.items || [])) {
          if (item.track && item.track.id && !item.track.is_local && item.track.type === 'track') {
            tracks.push({
              id: item.track.id,
              name: item.track.name || 'Unknown Track',
              artists: (item.track.artists || []).map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
              album: item.track.album?.name || 'Unknown Album',
              duration_ms: item.track.duration_ms || 0,
              uri: item.track.uri,
              preview_url: item.track.preview_url,
              image: item.track.album?.images?.[0]?.url,
            });
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
};

export const checkTrackSaved = async (trackId: string): Promise<boolean> => {
  const token = await spotifyAuth.ensureValidToken();
  const response = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to check track saved status: ${response.status}`);
  }

  const data = await response.json();
  return data[0];
};

export const saveTrack = async (trackId: string): Promise<void> => {
  const token = await spotifyAuth.ensureValidToken();
  const response = await fetch('https://api.spotify.com/v1/me/tracks', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: [trackId] })
  });

  if (!response.ok) {
    throw new Error(`Failed to save track: ${response.status}`);
  }
};

export const unsaveTrack = async (trackId: string): Promise<void> => {
  const token = await spotifyAuth.ensureValidToken();
  const response = await fetch('https://api.spotify.com/v1/me/tracks', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: [trackId] })
  });

  if (!response.ok) {
    throw new Error(`Failed to unsave track: ${response.status}`);
  }
};

export const getLikedSongsCount = async (signal?: AbortSignal): Promise<number> => {
  const token = await spotifyAuth.ensureValidToken();
  const response = await fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
    headers: { 'Authorization': `Bearer ${token}` },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch liked songs count: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.total || 0;
};

export const getLikedSongs = async (limit: number = 50): Promise<Track[]> => {
  const token = await spotifyAuth.ensureValidToken();
  
  const tracks: Track[] = [];
  let nextUrl = `https://api.spotify.com/v1/me/tracks?limit=${Math.min(limit, 50)}`;
  
  while (nextUrl && tracks.length < limit) {
    const response = await fetch(nextUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch liked songs: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    for (const item of data.items || []) {
      if (item.track?.id && item.track.type === 'track' && tracks.length < limit) {
        const track = item.track;
        const albumImage = track.album?.images?.[0]?.url;

        tracks.push({
          id: track.id,
          name: track.name,
          artists: track.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist',
          album: track.album?.name || 'Unknown Album',
          duration_ms: track.duration_ms || 0,
          uri: track.uri,
          preview_url: track.preview_url,
          image: albumImage
        });
      }
    }

    nextUrl = data.next;
  }

  return tracks;
};