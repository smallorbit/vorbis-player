/**
 * Last.fm API client for the Radio feature.
 * Stateless, uses fetch directly. No user authentication required — only an API key.
 * Rate-limited to 5 requests/second via a simple token-bucket approach.
 */

import type { LastFmSimilarTrack, LastFmSimilarArtist } from '@/types/radio';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const RATE_LIMIT_PADDING_MS = 10;
const SIMILAR_TRACKS_DEFAULT_LIMIT = 50;
const SIMILAR_ARTISTS_DEFAULT_LIMIT = 20;
const TOP_TRACKS_DEFAULT_LIMIT = 10;

function getApiKey(): string {
  const key = import.meta.env.VITE_LASTFM_API_KEY as string | undefined;
  if (!key) throw new Error('VITE_LASTFM_API_KEY is not configured');
  return key;
}

// ── Rate limiter (5 req/sec) ────────────────────────────────────────

const RATE_LIMIT = 5;
const WINDOW_MS = 1000;

let requestTimestamps: number[] = [];

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < WINDOW_MS);
  if (requestTimestamps.length >= RATE_LIMIT) {
    const oldest = requestTimestamps[0];
    const waitMs = WINDOW_MS - (now - oldest) + RATE_LIMIT_PADDING_MS;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  requestTimestamps.push(Date.now());
}

// ── API call helper ─────────────────────────────────────────────────

async function lastfmGet(params: Record<string, string>): Promise<unknown> {
  await waitForRateLimit();

  const url = new URL(LASTFM_BASE);
  url.searchParams.set('api_key', getApiKey());
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'VorbisPlayer/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Last.fm API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  }

  return data;
}

// ── Structural narrowers ────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === 'string' ? v : '';
}

function readNullableString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readObject(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = obj[key];
  return isPlainObject(v) ? v : null;
}

function readArray(obj: Record<string, unknown>, key: string): unknown[] {
  const v = obj[key];
  return Array.isArray(v) ? v : [];
}

// ── Response parsers ────────────────────────────────────────────────

function parseSimilarTrack(raw: unknown): LastFmSimilarTrack | null {
  if (!isPlainObject(raw)) return null;
  const artistObj = readObject(raw, 'artist');
  const artist = artistObj ? readString(artistObj, 'name') : readString(raw, 'artist');
  return {
    name: readString(raw, 'name'),
    artist,
    artistMbid: artistObj ? readNullableString(artistObj, 'mbid') : null,
    trackMbid: readNullableString(raw, 'mbid'),
    matchScore: readNumber(raw, 'match'),
  };
}

function parseSimilarArtist(raw: unknown): LastFmSimilarArtist | null {
  if (!isPlainObject(raw)) return null;
  return {
    name: readString(raw, 'name'),
    mbid: readNullableString(raw, 'mbid'),
    matchScore: readNumber(raw, 'match'),
  };
}

function parseAlbumTrack(raw: unknown, fallbackArtist: string): { name: string; artist: string } | null {
  if (!isPlainObject(raw)) return null;
  const artistObj = readObject(raw, 'artist');
  return {
    name: readString(raw, 'name'),
    artist: artistObj ? readString(artistObj, 'name') || fallbackArtist : fallbackArtist,
  };
}

function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

function asObject(data: unknown): Record<string, unknown> {
  return isPlainObject(data) ? data : {};
}

// ── Public API ──────────────────────────────────────────────────────

export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = SIMILAR_TRACKS_DEFAULT_LIMIT,
): Promise<LastFmSimilarTrack[]> {
  const data = asObject(
    await lastfmGet({
      method: 'track.getsimilar',
      artist,
      track,
      limit: String(limit),
      autocorrect: '1',
    }),
  );

  const container = readObject(data, 'similartracks');
  if (!container) return [];

  return readArray(container, 'track').map(parseSimilarTrack).filter(isNotNull);
}

export async function getSimilarArtists(
  artist: string,
  limit = SIMILAR_ARTISTS_DEFAULT_LIMIT,
): Promise<LastFmSimilarArtist[]> {
  const data = asObject(
    await lastfmGet({
      method: 'artist.getsimilar',
      artist,
      limit: String(limit),
      autocorrect: '1',
    }),
  );

  const container = readObject(data, 'similarartists');
  if (!container) return [];

  return readArray(container, 'artist').map(parseSimilarArtist).filter(isNotNull);
}

export async function getArtistTopTracks(
  artist: string,
  limit = TOP_TRACKS_DEFAULT_LIMIT,
): Promise<LastFmSimilarTrack[]> {
  const data = asObject(
    await lastfmGet({
      method: 'artist.gettoptracks',
      artist,
      limit: String(limit),
      autocorrect: '1',
    }),
  );

  const container = readObject(data, 'toptracks');
  if (!container) return [];

  return readArray(container, 'track')
    .map(parseSimilarTrack)
    .filter(isNotNull)
    .map((t) => ({ ...t, matchScore: 1.0 }));
}

export async function getAlbumTracks(
  artist: string,
  album: string,
): Promise<{ name: string; artist: string }[]> {
  const data = asObject(
    await lastfmGet({
      method: 'album.getinfo',
      artist,
      album,
      autocorrect: '1',
    }),
  );

  const albumInfo = readObject(data, 'album');
  if (!albumInfo) return [];

  const tracksContainer = readObject(albumInfo, 'tracks');
  if (!tracksContainer) return [];

  return readArray(tracksContainer, 'track')
    .map((raw) => parseAlbumTrack(raw, artist))
    .filter(isNotNull);
}

/** Returns true if the Last.fm API key is configured. */
export function isLastFmConfigured(): boolean {
  return !!import.meta.env.VITE_LASTFM_API_KEY;
}

/** Reset rate limiter state (for testing). */
export function _resetRateLimiter(): void {
  requestTimestamps = [];
}
