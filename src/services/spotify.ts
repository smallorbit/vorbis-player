/**
 * Spotify Authentication and API Service
 *
 * Handles OAuth 2.0 PKCE authentication and Spotify Web API requests.
 */

import { ALBUM_ID_PREFIX } from '../constants/playlist';
import * as libraryCache from './cache/libraryCache';

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


// =============================================================================
// Rate Limiting & Request Deduplication
// =============================================================================

/**
 * In-flight request deduplication: if the same URL+method combo is already
 * being fetched, return the existing promise instead of firing a second request.
 */
const inflightRequests = new Map<string, Promise<unknown>>();

function getInflightKey(url: string, method: string): string {
  return `${method}:${url}`;
}

/**
 * Rate-limit state: tracks 429 back-off per domain.
 * When we receive a 429, we record a "retry-after" timestamp and
 * reject immediately until that timestamp has passed.
 */
let rateLimitedUntil = 0;

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function handleRateLimitResponse(response: Response): void {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 5;
    const waitMs = (isNaN(waitSeconds) ? 5 : Math.max(waitSeconds, 1)) * 1000;
    rateLimitedUntil = Date.now() + waitMs;
    console.warn(`[spotify] 429 rate-limited — backing off for ${waitMs}ms`);
  }
}

// =============================================================================
// In-Memory Caches (short-lived, session-scoped)
// =============================================================================

/** Cache for checkTrackSaved results — keyed by track ID */
const trackSavedCache = new Map<string, { value: boolean; timestamp: number }>();
const TRACK_SAVED_CACHE_TTL = 60 * 1000; // 1 minute

/** Cache for playlist/album track lists — keyed by playlist/album ID */
const trackListCache = new Map<string, { data: Track[]; timestamp: number }>();
const TRACK_LIST_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (in-memory L1)
const TRACK_LIST_PERSIST_TTL = 24 * 60 * 60 * 1000; // 24 hours (IndexedDB L2)

/** Cache for liked songs count */
let likedSongsCountCache: { count: number; timestamp: number } | null = null;
const LIKED_SONGS_COUNT_TTL = 2 * 60 * 1000; // 2 minutes

/** Cache for liked songs list */
let likedSongsCache: { data: Track[]; limit: number; timestamp: number } | null = null;
const LIKED_SONGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidate track-saved cache for a given track (called on save/unsave).
 */
function invalidateTrackSavedCache(trackId: string): void {
  trackSavedCache.delete(trackId);
}

// =============================================================================
// Types
// =============================================================================

interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export interface ArtistInfo {
  name: string;
  spotifyUrl: string;
}

export interface Track {
  id: string;
  name: string;
  artists: string;
  artistsData?: ArtistInfo[];
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
  added_at?: string; // ISO 8601 timestamp when added to library
  snapshot_id?: string; // Spotify revision identifier for change detection
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

function buildArtistsData(artists?: SpotifyArtist[]): ArtistInfo[] | undefined {
  if (!artists || artists.length === 0) return undefined;

  const data: ArtistInfo[] = [];
  for (const artist of artists) {
    const url = artist.external_urls?.spotify
      ?? (artist.id ? `https://open.spotify.com/artist/${artist.id}` : '');
    if (url) {
      data.push({ name: artist.name, spotifyUrl: url });
    }
  }
  return data.length > 0 ? data : undefined;
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
    artistsData: buildArtistsData(item.artists),
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
  // Reject immediately if we're in a rate-limit back-off window
  if (isRateLimited()) {
    const waitMs = rateLimitedUntil - Date.now();
    console.warn(`[spotify] Rate-limited — waiting ${waitMs}ms before retrying`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  const method = (options.method ?? 'GET').toUpperCase();

  // Deduplicate concurrent GET requests for the same URL
  if (method === 'GET') {
    const key = getInflightKey(url, method);
    const existing = inflightRequests.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = executeApiRequest<T>(url, token, options).finally(() => {
      inflightRequests.delete(key);
    });
    inflightRequests.set(key, promise);
    return promise;
  }

  return executeApiRequest<T>(url, token, options);
}

async function executeApiRequest<T>(
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

  // Track 429s and set backoff
  handleRateLimitResponse(response);

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text);
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

type PlaylistsIncrementalCallback = (playlistsSoFar: PlaylistInfo[], isComplete: boolean) => void;
type AlbumsIncrementalCallback = (albumsSoFar: AlbumInfo[], isComplete: boolean) => void;

/**
 * Load playlists and albums with interleaved pagination.
 *
 * Instead of fetching all playlist pages then all album pages (or relying on
 * Promise.all which can still starve one stream), this fetches one page of each
 * alternately: playlist page 1, album page 1, playlist page 2, album page 2, …
 * Both lists populate at roughly the same rate regardless of library size.
 *
 * Caching is handled externally by the sync engine (IndexedDB).
 */
export async function getUserLibraryInterleaved(
  onPlaylistsUpdate: PlaylistsIncrementalCallback,
  onAlbumsUpdate: AlbumsIncrementalCallback,
  signal?: AbortSignal
): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();

  const fetchTimestamp = new Date().toISOString();

  function transformPlaylist(playlist: PlaylistInfo): PlaylistInfo {
    return { ...playlist, added_at: playlist.added_at || fetchTimestamp };
  }

  interface SavedAlbumItem {
    added_at: string;
    album: SpotifyAlbum;
  }

  function transformAlbum(item: SavedAlbumItem): AlbumInfo {
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
      added_at: item.added_at,
    };
  }

  // Pagination state
  let playlistNextUrl: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';
  let albumNextUrl: string | null = 'https://api.spotify.com/v1/me/albums?limit=50';
  const playlistResults: PlaylistInfo[] = [];
  const albumResults: AlbumInfo[] = [];

  // Interleave: fetch one page of each per round
  while (playlistNextUrl || albumNextUrl) {
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    // Fetch one page of each concurrently (max 2 requests at a time)
    const fetches: Promise<void>[] = [];

    if (playlistNextUrl) {
      const url = playlistNextUrl;
      fetches.push(
        spotifyApiRequest<PaginatedResponse<PlaylistInfo>>(url, token, { signal })
          .then((data) => {
            for (const item of data.items ?? []) {
              playlistResults.push(transformPlaylist(item));
            }
            playlistNextUrl = data.next;
            const isComplete = playlistNextUrl === null;
            onPlaylistsUpdate([...playlistResults], isComplete);
          })
      );
    }

    if (albumNextUrl) {
      const url = albumNextUrl;
      fetches.push(
        spotifyApiRequest<PaginatedResponse<SavedAlbumItem>>(url, token, { signal })
          .then((data) => {
            for (const item of data.items ?? []) {
              albumResults.push(transformAlbum(item));
            }
            albumNextUrl = data.next;
            const isComplete = albumNextUrl === null;
            onAlbumsUpdate([...albumResults], isComplete);
          })
      );
    }

    // Wait for both pages of this round to complete before starting the next round.
    // This keeps the two streams in lockstep: neither can race ahead and starve the other.
    await Promise.all(fetches);
  }
}

export async function getPlaylistTracks(playlistId: string): Promise<Track[]> {
  const cacheKey = `playlist:${playlistId}`;

  // L1: Check in-memory cache (instant)
  const cached = trackListCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TRACK_LIST_CACHE_TTL) {
    return cached.data;
  }

  // L2: Check IndexedDB persistent cache (survives page reload)
  try {
    const idbCached = await libraryCache.getTrackList(cacheKey);
    if (idbCached && Date.now() - idbCached.timestamp < TRACK_LIST_PERSIST_TTL) {
      // Promote to L1
      trackListCache.set(cacheKey, { data: idbCached.tracks, timestamp: idbCached.timestamp });
      return idbCached.tracks;
    }
  } catch {
    // IndexedDB read failed, continue to API fetch
  }

  // L3: Fetch from Spotify API
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

  const tracks = await fetchAllPaginated<PlaylistTrackItem, Track>(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
    token,
    transformPlaylistTrack
  );

  // Write to both L1 and L2
  trackListCache.set(cacheKey, { data: tracks, timestamp: Date.now() });
  libraryCache.putTrackList(cacheKey, tracks).catch(() => {});
  return tracks;
}

export async function getAlbumTracks(albumId: string): Promise<Track[]> {
  const cacheKey = `${ALBUM_ID_PREFIX}${albumId}`;

  // L1: Check in-memory cache (instant)
  const cached = trackListCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TRACK_LIST_CACHE_TTL) {
    return cached.data;
  }

  // L2: Check IndexedDB persistent cache (survives page reload)
  try {
    const idbCached = await libraryCache.getTrackList(cacheKey);
    if (idbCached && Date.now() - idbCached.timestamp < TRACK_LIST_PERSIST_TTL) {
      // Promote to L1
      trackListCache.set(cacheKey, { data: idbCached.tracks, timestamp: idbCached.timestamp });
      return idbCached.tracks;
    }
  } catch {
    // IndexedDB read failed, continue to API fetch
  }

  // L3: Fetch from Spotify API
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

  const sorted = tracks.sort((a, b) => (a.track_number ?? 0) - (b.track_number ?? 0));

  // Write to both L1 and L2
  trackListCache.set(cacheKey, { data: sorted, timestamp: Date.now() });
  libraryCache.putTrackList(cacheKey, sorted).catch(() => {});
  return sorted;
}

export async function getLikedSongs(limit: number = 50): Promise<Track[]> {
  if (likedSongsCache && likedSongsCache.limit >= limit && Date.now() - likedSongsCache.timestamp < LIKED_SONGS_CACHE_TTL) {
    return likedSongsCache.data.slice(0, limit);
  }

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
  const tracks = await fetchAllPaginated<SavedTrackItem, Track>(
    `https://api.spotify.com/v1/me/tracks?limit=${maxLimit}`,
    token,
    transformSavedTrack,
    { maxItems: limit }
  );

  likedSongsCache = { data: tracks, limit, timestamp: Date.now() };
  return tracks;
}

export async function getLikedSongsCount(signal?: AbortSignal): Promise<number> {
  if (likedSongsCountCache && Date.now() - likedSongsCountCache.timestamp < LIKED_SONGS_COUNT_TTL) {
    return likedSongsCountCache.count;
  }

  const token = await spotifyAuth.ensureValidToken();

  interface LikedSongsResponse {
    total: number;
  }

  const data = await spotifyApiRequest<LikedSongsResponse>(
    'https://api.spotify.com/v1/me/tracks?limit=1',
    token,
    { signal }
  );

  const count = data.total ?? 0;
  likedSongsCountCache = { count, timestamp: Date.now() };
  return count;
}

export async function checkTrackSaved(trackId: string): Promise<boolean> {
  const cached = trackSavedCache.get(trackId);
  if (cached && Date.now() - cached.timestamp < TRACK_SAVED_CACHE_TTL) {
    return cached.value;
  }

  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<boolean[]>(
    `https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`,
    token
  );
  const result = data[0] ?? false;
  trackSavedCache.set(trackId, { value: result, timestamp: Date.now() });
  return result;
}

async function modifyTrackSaved(trackId: string, save: boolean): Promise<void> {
  const token = await spotifyAuth.ensureValidToken();
  const method = save ? 'PUT' : 'DELETE';
  await spotifyApiRequest<void>('https://api.spotify.com/v1/me/tracks', token, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [trackId] }),
  });

  // Optimistically update the saved-track cache
  invalidateTrackSavedCache(trackId);
  trackSavedCache.set(trackId, { value: save, timestamp: Date.now() });

  // Also invalidate liked songs caches since the list changed
  likedSongsCache = null;
  likedSongsCountCache = null;
}

export async function saveTrack(trackId: string): Promise<void> {
  return modifyTrackSaved(trackId, true);
}

export async function unsaveTrack(trackId: string): Promise<void> {
  return modifyTrackSaved(trackId, false);
}

// =============================================================================
// Lightweight Library Check Functions (for background sync change detection)
// =============================================================================

/** Get just the total count of user's playlists (1 API call, returns 1 item). */
export async function getPlaylistCount(signal?: AbortSignal): Promise<number> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<PaginatedResponse<unknown>>(
    'https://api.spotify.com/v1/me/playlists?limit=1&offset=0',
    token,
    { signal }
  );
  return data.total ?? 0;
}

/** Get just the total count of user's saved albums (1 API call, returns 1 item). */
export async function getAlbumCount(signal?: AbortSignal): Promise<number> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<PaginatedResponse<unknown>>(
    'https://api.spotify.com/v1/me/albums?limit=1&offset=0',
    token,
    { signal }
  );
  return data.total ?? 0;
}

/** Fetch first page of playlists with snapshot_ids for change comparison. */
export async function getPlaylistsPage(
  limit: number = 50,
  signal?: AbortSignal
): Promise<{ playlists: PlaylistInfo[]; total: number; hasMore: boolean }> {
  const token = await spotifyAuth.ensureValidToken();
  const data = await spotifyApiRequest<PaginatedResponse<PlaylistInfo>>(
    `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=0`,
    token,
    { signal }
  );
  const fetchTimestamp = new Date().toISOString();
  const playlists = (data.items ?? []).map((p) => ({
    ...p,
    added_at: p.added_at || fetchTimestamp,
  }));
  return {
    playlists,
    total: data.total ?? 0,
    hasMore: data.next !== null,
  };
}

/** Fetch first page of albums for change comparison. */
export async function getAlbumsPage(
  limit: number = 50,
  signal?: AbortSignal
): Promise<{ albums: AlbumInfo[]; total: number; hasMore: boolean }> {
  const token = await spotifyAuth.ensureValidToken();

  interface SavedAlbumItem {
    added_at: string;
    album: SpotifyAlbum;
  }

  const data = await spotifyApiRequest<PaginatedResponse<SavedAlbumItem>>(
    `https://api.spotify.com/v1/me/albums?limit=${limit}&offset=0`,
    token,
    { signal }
  );
  const albums = (data.items ?? []).map((item) => {
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
      added_at: item.added_at,
    } as AlbumInfo;
  });
  return {
    albums,
    total: data.total ?? 0,
    hasMore: data.next !== null,
  };
}

/** Invalidate the in-memory liked songs caches (used by sync engine). */
export function invalidateLikedSongsCaches(): void {
  likedSongsCache = null;
  likedSongsCountCache = null;
}

