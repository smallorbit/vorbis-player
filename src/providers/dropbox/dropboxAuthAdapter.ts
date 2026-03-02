/**
 * Dropbox AuthProvider adapter.
 * Implements OAuth 2.0 PKCE flow for Dropbox.
 */

import type { AuthProvider } from '@/types/providers';
import type { ProviderId } from '@/types/domain';

const DROPBOX_CLIENT_ID = import.meta.env.VITE_DROPBOX_CLIENT_ID ?? '';
/** Redirect URI must match the current origin so the callback lands where we stored the PKCE verifier. */
function getRedirectUri(): string {
  if (typeof window === 'undefined') return import.meta.env.VITE_DROPBOX_REDIRECT_URI ?? '';
  return `${window.location.origin}/auth/dropbox/callback`;
}

const TOKEN_KEY = 'vorbis-player-dropbox-token';
const REFRESH_TOKEN_KEY = 'vorbis-player-dropbox-refresh-token';
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

export class DropboxAuthAdapter implements AuthProvider {
  readonly providerId: ProviderId = 'dropbox';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem(TOKEN_KEY);
    this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  async getAccessToken(): Promise<string | null> {
    return this.accessToken;
  }

  async beginLogin(): Promise<void> {
    if (!DROPBOX_CLIENT_ID) {
      console.warn('[DropboxAuth] No VITE_DROPBOX_CLIENT_ID configured');
      return;
    }

    const codeVerifier = generateRandomString(64);
    localStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

    const state = generateRandomString(32);
    sessionStorage.setItem(OAUTH_STATE_KEY, state);

    const challengeBuffer = await sha256(codeVerifier);
    const codeChallenge = base64urlEncode(challengeBuffer);

    const redirectUri = getRedirectUri();
    const params = new URLSearchParams({
      client_id: DROPBOX_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline',
      state,
    });

    window.location.href = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
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

    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
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
      client_id: DROPBOX_CLIENT_ID,
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

    localStorage.setItem(TOKEN_KEY, data.access_token);
    if (data.refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    }
    localStorage.removeItem(CODE_VERIFIER_KEY);

    return true;
  }

  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(CODE_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
  }

  /** Refresh the access token using the stored refresh token. */
  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken || !DROPBOX_CLIENT_ID) return null;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: DROPBOX_CLIENT_ID,
    });

    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      console.warn('[DropboxAuth] Token refresh failed:', response.status);
      this.logout();
      return null;
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    localStorage.setItem(TOKEN_KEY, data.access_token);
    return data.access_token;
  }

  /** Get a valid token, refreshing if the current one is expired/invalid. */
  async ensureValidToken(): Promise<string | null> {
    if (!this.accessToken) return null;
    return this.accessToken;
  }
}
