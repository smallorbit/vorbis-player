/**
 * Last.fm API client for the Radio feature.
 * Stateless, uses fetch directly. No user authentication required — only an API key.
 * Rate-limited to 5 requests/second via a simple token-bucket approach.
 */

import type { LastFmSimilarTrack, LastFmSimilarArtist } from '@/types/radio';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

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
    const waitMs = WINDOW_MS - (now - oldest) + 10;
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

  // Last.fm returns { error: N, message: "..." } on logical errors
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  }

  return data;
}

// ── Response parsers ────────────────────────────────────────────────

function parseSimilarTrack(raw: Record<string, unknown>): LastFmSimilarTrack {
  const artist =
    typeof raw.artist === 'object' && raw.artist !== null
      ? ((raw.artist as Record<string, unknown>).name as string) ?? ''
      : (raw.artist as string) ?? '';

  return {
    name: (raw.name as string) ?? '',
    artist,
    artistMbid:
      typeof raw.artist === 'object' && raw.artist !== null
        ? ((raw.artist as Record<string, unknown>).mbid as string) || null
        : null,
    trackMbid: (raw.mbid as string) || null,
    matchScore: parseFloat(raw.match as string) || 0,
  };
}

function parseSimilarArtist(raw: Record<string, unknown>): LastFmSimilarArtist {
  return {
    name: (raw.name as string) ?? '',
    mbid: (raw.mbid as string) || null,
    matchScore: parseFloat(raw.match as string) || 0,
  };
}

// ── Public API ──────────────────────────────────────────────────────

export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = 50,
): Promise<LastFmSimilarTrack[]> {
  const data = (await lastfmGet({
    method: 'track.getsimilar',
    artist,
    track,
    limit: String(limit),
    autocorrect: '1',
  })) as Record<string, unknown>;

  const container = data.similartracks as Record<string, unknown> | undefined;
  if (!container) return [];

  const rawTracks = container.track;
  if (!Array.isArray(rawTracks)) return [];

  return rawTracks.map((t: Record<string, unknown>) => parseSimilarTrack(t));
}

export async function getSimilarArtists(
  artist: string,
  limit = 20,
): Promise<LastFmSimilarArtist[]> {
  const data = (await lastfmGet({
    method: 'artist.getsimilar',
    artist,
    limit: String(limit),
    autocorrect: '1',
  })) as Record<string, unknown>;

  const container = data.similarartists as Record<string, unknown> | undefined;
  if (!container) return [];

  const rawArtists = container.artist;
  if (!Array.isArray(rawArtists)) return [];

  return rawArtists.map((a: Record<string, unknown>) => parseSimilarArtist(a));
}

export async function getArtistTopTracks(
  artist: string,
  limit = 10,
): Promise<LastFmSimilarTrack[]> {
  const data = (await lastfmGet({
    method: 'artist.gettoptracks',
    artist,
    limit: String(limit),
    autocorrect: '1',
  })) as Record<string, unknown>;

  const container = data.toptracks as Record<string, unknown> | undefined;
  if (!container) return [];

  const rawTracks = container.track;
  if (!Array.isArray(rawTracks)) return [];

  return rawTracks.map((t: Record<string, unknown>) => ({
    ...parseSimilarTrack(t),
    matchScore: 1.0, // Top tracks are inherently relevant
  }));
}

export async function getAlbumTracks(
  artist: string,
  album: string,
): Promise<{ name: string; artist: string }[]> {
  const data = (await lastfmGet({
    method: 'album.getinfo',
    artist,
    album,
    autocorrect: '1',
  })) as Record<string, unknown>;

  const albumInfo = data.album as Record<string, unknown> | undefined;
  if (!albumInfo) return [];

  const tracksContainer = albumInfo.tracks as Record<string, unknown> | undefined;
  if (!tracksContainer) return [];

  const rawTracks = tracksContainer.track;
  if (!Array.isArray(rawTracks)) return [];

  return rawTracks.map((t: Record<string, unknown>) => ({
    name: (t.name as string) ?? '',
    artist:
      typeof t.artist === 'object' && t.artist !== null
        ? ((t.artist as Record<string, unknown>).name as string) ?? artist
        : artist,
  }));
}

/** Returns true if the Last.fm API key is configured. */
export function isLastFmConfigured(): boolean {
  return !!import.meta.env.VITE_LASTFM_API_KEY;
}

/** Reset rate limiter state (for testing). */
export function _resetRateLimiter(): void {
  requestTimestamps = [];
}
