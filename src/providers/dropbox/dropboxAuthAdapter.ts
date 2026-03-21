/**
 * Dropbox AuthProvider adapter.
 * Implements OAuth 2.0 PKCE flow for Dropbox.
 */

import type { AuthProvider } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import { resetPlaylistsFolderCache } from './dropboxPlaylistStorage';

export const DROPBOX_AUTH_ERROR_EVENT = 'vorbis-dropbox-auth-error';

function getDropboxClientId(): string {
  return import.meta.env.VITE_DROPBOX_CLIENT_ID ?? '';
}
/** Redirect URI must match the current origin so the callback lands where we stored the PKCE verifier. */
function getRedirectUri(): string {
  if (typeof window === 'undefined') return import.meta.env.VITE_DROPBOX_REDIRECT_URI ?? '';
  return `${window.location.origin}/auth/dropbox/callback`;
}

const TOKEN_KEY = 'vorbis-player-dropbox-token';
const REFRESH_TOKEN_KEY = 'vorbis-player-dropbox-refresh-token';
const TOKEN_EXPIRY_KEY = 'vorbis-player-dropbox-token-expiry';
const CODE_VERIFIER_KEY = 'vorbis-player-dropbox-code-verifier';
const OAUTH_STATE_KEY = 'vorbis-player-dropbox-oauth-state';

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** How many seconds before expiry to proactively refresh the token. */
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export class DropboxAuthAdapter implements AuthProvider {
  readonly providerId: ProviderId = 'dropbox';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  constructor() {
    this.accessToken = localStorage.getItem(TOKEN_KEY);
    this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const stored = localStorage.getItem(TOKEN_EXPIRY_KEY);
    this.tokenExpiresAt = stored ? parseInt(stored, 10) : null;
  }

  isAuthenticated(): boolean {
    if (!this.accessToken && !this.refreshToken) {
      this.syncFromStorage();
    }
    return !!(this.accessToken || this.refreshToken);
  }

  /** Re-read tokens from localStorage (e.g. written by a popup tab). */
  private syncFromStorage(): void {
    this.accessToken = localStorage.getItem(TOKEN_KEY);
    this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const stored = localStorage.getItem(TOKEN_EXPIRY_KEY);
    this.tokenExpiresAt = stored ? parseInt(stored, 10) : null;
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.accessToken) {
      return this.refreshToken ? this.refreshAccessToken() : null;
    }
    return this.ensureValidToken();
  }

  async beginLogin(options?: { popup?: boolean }): Promise<void> {
    if (!getDropboxClientId()) {
      console.warn('[DropboxAuth] No VITE_DROPBOX_CLIENT_ID configured');
      return;
    }

    const codeVerifier = generateRandomString(64);
    localStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

    const state = generateRandomString(32);
    localStorage.setItem(OAUTH_STATE_KEY, state);

    const challengeBuffer = await sha256(codeVerifier);
    const codeChallenge = base64urlEncode(challengeBuffer);

    const redirectUri = getRedirectUri();
    const params = new URLSearchParams({
      client_id: getDropboxClientId(),
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline',
      state,
    });

    const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;

    if (options?.popup) {
      const win = window.open(authUrl, '_blank');
      if (!win) {
        window.location.href = authUrl;
      }
      return;
    }

    window.location.href = authUrl;
  }

  async handleCallback(url: URL): Promise<boolean> {
    if (!url.pathname.includes('/auth/dropbox/callback')) {
      return false;
    }

    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const returnedState = url.searchParams.get('state');

    if (error) {
      throw new Error(`Dropbox auth error: ${error}`);
    }

    if (!code) {
      return false;
    }

    const expectedState = localStorage.getItem(OAUTH_STATE_KEY);
    localStorage.removeItem(OAUTH_STATE_KEY);
    if (!expectedState || returnedState !== expectedState) {
      throw new Error('OAuth state mismatch — possible CSRF attack');
    }

    const codeVerifier = localStorage.getItem(CODE_VERIFIER_KEY);
    if (!codeVerifier) {
      throw new Error('Missing code verifier for Dropbox PKCE');
    }

    // Exchange code for token (use same redirect_uri as beginLogin so Dropbox accepts it)
    const redirectUri = getRedirectUri();
    const body = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: getDropboxClientId(),
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Dropbox token exchange failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token ?? null;
    this.tokenExpiresAt = data.expires_in
      ? Date.now() + data.expires_in * 1000
      : null;

    localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    if (this.tokenExpiresAt !== null) {
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(this.tokenExpiresAt));
    }
    localStorage.removeItem(CODE_VERIFIER_KEY);

    return true;
  }

  /** Clear the access token and expiry while preserving the refresh token for retry. */
  private clearAccessToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  logout(): void {
    this.clearAccessToken();
    this.refreshToken = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(CODE_VERIFIER_KEY);
    localStorage.removeItem(OAUTH_STATE_KEY);
    resetPlaylistsFolderCache();
  }

  /**
   * Called by API consumers when a freshly-refreshed token is still rejected (401).
   * Treats this as an invalid session: clears all tokens and notifies the UI.
   */
  reportUnauthorized(): void {
    if (!this.accessToken && !this.refreshToken) return;
    console.warn('[DropboxAuth] Persistent 401 after token refresh — logging out');
    this.logout();
    window.dispatchEvent(new CustomEvent(DROPBOX_AUTH_ERROR_EVENT));
  }

  /** Refresh the access token using the stored refresh token. */
  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken || !getDropboxClientId()) return null;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: getDropboxClientId(),
    });

    let response: Response;
    try {
      response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (error) {
      // Network error — preserve refresh token for future retry.
      console.warn('[DropboxAuth] Token refresh network error:', error);
      this.clearAccessToken();
      return null;
    }

    if (!response.ok) {
      console.warn('[DropboxAuth] Token refresh failed:', response.status);
      if (response.status === 400 || response.status === 401) {
        // Invalid or revoked grant — full logout.
        this.logout();
      } else {
        // Transient failure — clear access token but keep refresh token for retry.
        this.clearAccessToken();
      }
      return null;
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = data.expires_in
      ? Date.now() + data.expires_in * 1000
      : null;

    localStorage.setItem(TOKEN_KEY, data.access_token);
    if (this.tokenExpiresAt !== null) {
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(this.tokenExpiresAt));
    }
    return data.access_token;
  }

  /** Get a valid token, refreshing proactively if it is expired or near expiry. */
  async ensureValidToken(): Promise<string | null> {
    if (!this.accessToken) {
      return this.refreshToken ? this.refreshAccessToken() : null;
    }

    const isExpiredOrExpiringSoon =
      this.tokenExpiresAt !== null &&
      Date.now() >= this.tokenExpiresAt - TOKEN_EXPIRY_BUFFER_MS;

    if (isExpiredOrExpiringSoon) {
      return await this.refreshAccessToken();
    }

    return this.accessToken;
  }
}
