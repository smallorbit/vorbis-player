import type { TokenData } from './types';
import { SESSION_EXPIRED_EVENT } from '@/constants/events';

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

function getSpotifyRedirectUri(): string {
  return import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/auth/spotify/callback`;
}

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
  'playlist-modify-public',
  'playlist-modify-private',
];

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// =============================================================================
// SpotifyAuth Class
// =============================================================================

class SpotifyAuth {
  private tokenData: TokenData | null = null;
  private refreshInFlight: Promise<void> | null = null;

  constructor() {
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage(): void {
    const stored = localStorage.getItem('spotify_token');
    if (!stored) return;

    try {
      const tokenData = JSON.parse(stored);
      if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
        if (tokenData.refresh_token) {
          // Access token expired but refresh token is still valid.
          // Keep the data so ensureValidToken() can refresh on first API call.
          this.tokenData = tokenData;
        } else {
          localStorage.removeItem('spotify_token');
        }
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
      redirect_uri: getSpotifyRedirectUri(),
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
        redirect_uri: getSpotifyRedirectUri(),
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
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.performRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async performRefresh(): Promise<void> {
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
      if (response.status === 400 || response.status === 401) {
        this.logout();
        this.notifySessionExpired();
      }
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.saveTokenToStorage({
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokenData.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });
  }

  private notifySessionExpired(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { providerId: 'spotify' } }),
    );
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
    if (!this.tokenData) {
      this.loadTokenFromStorage();
    }
    return !!(this.tokenData?.access_token || this.tokenData?.refresh_token);
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
