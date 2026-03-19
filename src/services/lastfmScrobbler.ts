/**
 * Last.fm scrobbling service.
 *
 * Handles Last.fm web authentication (session key) and the two scrobbling API
 * calls: `track.updateNowPlaying` and `track.scrobble`.
 *
 * Last.fm auth flow:
 * 1. Redirect to https://www.last.fm/api/auth/?api_key=…&cb=…
 * 2. User authorizes; Last.fm redirects back with ?token=…
 * 3. We exchange the token for a persistent session key via auth.getSession
 *
 * Scrobble rules (per Last.fm spec):
 * - Track duration > 30 seconds
 * - Scrobble after ≥ 50% played OR ≥ 4 minutes played (whichever is less)
 */

import md5 from 'blueimp-md5';

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const LASTFM_AUTH_URL = 'https://www.last.fm/api/auth/';

const SESSION_KEY_STORAGE = 'vorbis-player-lastfm-session-key';
const USERNAME_STORAGE = 'vorbis-player-lastfm-username';

// ── Env helpers ────────────────────────────────────────────────────

function getApiKey(): string {
  return (import.meta.env.VITE_LASTFM_API_KEY as string) ?? '';
}

function getApiSecret(): string {
  return (import.meta.env.VITE_LASTFM_API_SECRET as string) ?? '';
}

// ── API signature ──────────────────────────────────────────────────

function apiSignature(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  let sigStr = '';
  for (const key of keys) {
    sigStr += key + params[key];
  }
  sigStr += getApiSecret();
  return md5(sigStr);
}

// ── API call helper (POST with signature) ──────────────────────────

async function lastfmPost(params: Record<string, string>): Promise<unknown> {
  const apiKey = getApiKey();
  const allParams = { ...params, api_key: apiKey };
  const sig = apiSignature(allParams);
  const body = new URLSearchParams({ ...allParams, api_sig: sig, format: 'json' });

  const response = await fetch(LASTFM_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Last.fm API error: ${response.status} ${text}`);
  }

  // Last.fm returns HTTP 200 for API-level errors (e.g. invalid session key,
  // rate limiting). Check the JSON body before returning.
  const data = await response.json();
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(`Last.fm error ${data.error}: ${data.message}`);
  }
  return data;
}

// ── Auth ────────────────────────────────────────────────────────────

/** Returns true if both API key and API secret are configured. */
export function isScrobblingConfigured(): boolean {
  return !!getApiKey() && !!getApiSecret();
}

/** Returns the stored session key, or null if not authenticated. */
export function getSessionKey(): string | null {
  return localStorage.getItem(SESSION_KEY_STORAGE);
}

/** Returns the stored Last.fm username, or null. */
export function getLastFmUsername(): string | null {
  return localStorage.getItem(USERNAME_STORAGE);
}

/** Returns true if user has an active scrobbling session. */
export function isScrobblingAuthenticated(): boolean {
  return isScrobblingConfigured() && !!getSessionKey();
}

/** Open the Last.fm auth page. Uses popup if popup=true, else redirect. */
export function beginLastFmAuth(options?: { popup?: boolean }): void {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const callbackUrl = `${window.location.origin}/auth/lastfm/callback`;
  const authUrl = `${LASTFM_AUTH_URL}?api_key=${encodeURIComponent(apiKey)}&cb=${encodeURIComponent(callbackUrl)}`;

  if (options?.popup) {
    const w = 500;
    const h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(authUrl, 'lastfm-auth', `width=${w},height=${h},left=${left},top=${top}`);
  } else {
    window.location.href = authUrl;
  }
}

/**
 * Handle the Last.fm auth callback. Extracts the token from the URL
 * and exchanges it for a session key.
 * Returns true if this URL was a Last.fm callback.
 */
export async function handleLastFmCallback(url: URL): Promise<boolean> {
  if (!url.pathname.startsWith('/auth/lastfm/callback')) return false;

  const token = url.searchParams.get('token');
  if (!token) return false;

  const data = (await lastfmPost({
    method: 'auth.getSession',
    token,
  })) as { session?: { key?: string; name?: string } };

  if (data.session?.key) {
    localStorage.setItem(SESSION_KEY_STORAGE, data.session.key);
    if (data.session.name) {
      localStorage.setItem(USERNAME_STORAGE, data.session.name);
    }
    return true;
  }

  throw new Error('Failed to obtain Last.fm session key');
}

/** Clear the stored session. */
export function logoutLastFm(): void {
  localStorage.removeItem(SESSION_KEY_STORAGE);
  localStorage.removeItem(USERNAME_STORAGE);
}

// ── Scrobble API ───────────────────────────────────────────────────

export interface ScrobbleTrack {
  artist: string;
  track: string;
  album?: string;
  duration?: number; // seconds
}

/** Send "now playing" notification to Last.fm. */
export async function updateNowPlaying(track: ScrobbleTrack): Promise<void> {
  const sk = getSessionKey();
  if (!sk) return;

  const params: Record<string, string> = {
    method: 'track.updateNowPlaying',
    artist: track.artist,
    track: track.track,
    sk,
  };
  if (track.album) params.album = track.album;
  if (track.duration && track.duration > 0) params.duration = String(track.duration);

  try {
    await lastfmPost(params);
  } catch (err) {
    // Error 9 = Invalid session key (revoked). Clear stale session so the UI
    // reflects the disconnected state and the user can reconnect.
    if (err instanceof Error && err.message.includes('Last.fm error 9')) {
      logoutLastFm();
    }
    console.warn('[Scrobbler] Failed to update now playing:', err);
  }
}

/** Scrobble a track (mark as listened). */
export async function scrobble(track: ScrobbleTrack, timestamp?: number): Promise<void> {
  const sk = getSessionKey();
  if (!sk) return;

  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    method: 'track.scrobble',
    artist: track.artist,
    track: track.track,
    timestamp: String(ts),
    sk,
  };
  if (track.album) params.album = track.album;
  if (track.duration && track.duration > 0) params.duration = String(track.duration);

  try {
    await lastfmPost(params);
  } catch (err) {
    if (err instanceof Error && err.message.includes('Last.fm error 9')) {
      logoutLastFm();
    }
    console.warn('[Scrobbler] Failed to scrobble:', err);
  }
}

