/**
 * Dropbox AuthProvider adapter.
 * Implements OAuth 2.0 PKCE flow for Dropbox.
 */

import type { AuthProvider } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import { STORAGE_KEYS } from '@/constants/storage';
import {
  DROPBOX_AUTH_ERROR_EVENT,
  SESSION_EXPIRED_EVENT,
  dispatchAppEvent,
} from '@/constants/events';
import { getLikesSync } from './dropboxLikesSync';
import { getPreferencesSync } from './dropboxPreferencesSync';
import { purgeProviderPersistedData } from '@/providers/providerDataPurge';
import {
  readLocalStorageRaw,
  removeLocalStorageKey,
  writeLocalStorageRaw,
} from '@/utils/persistedStorage';
import { PkceOAuthClient, type RefreshOutcome } from '@/services/oauth/pkceOAuthClient';

function notifyDropboxSessionExpired(): void {
  dispatchAppEvent(DROPBOX_AUTH_ERROR_EVENT);
  dispatchAppEvent(SESSION_EXPIRED_EVENT, { providerId: 'dropbox' });
}

function getDropboxClientId(): string {
  return import.meta.env.VITE_DROPBOX_CLIENT_ID ?? '';
}
/** Redirect URI must match the current origin so the callback lands where we stored the PKCE verifier. */
function getRedirectUri(): string {
  if (typeof window === 'undefined') return import.meta.env.VITE_DROPBOX_REDIRECT_URI ?? '';
  return `${window.location.origin}/auth/dropbox/callback`;
}

/** How many seconds before expiry to proactively refresh the token. */
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

export class DropboxAuthAdapter implements AuthProvider {
  readonly providerId: ProviderId = 'dropbox';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private readonly oauth = new PkceOAuthClient<string | null>({
    label: 'Dropbox',
    authorizeUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    getClientId: getDropboxClientId,
    getRedirectUri,
    storageKeys: {
      codeVerifier: STORAGE_KEYS.DROPBOX_CODE_VERIFIER,
      state: STORAGE_KEYS.DROPBOX_OAUTH_STATE,
    },
    authorizeParams: { token_access_type: 'offline' },
  });

  constructor() {
    this.accessToken = readLocalStorageRaw(STORAGE_KEYS.DROPBOX_TOKEN);
    this.refreshToken = readLocalStorageRaw(STORAGE_KEYS.DROPBOX_REFRESH_TOKEN);
    const stored = readLocalStorageRaw(STORAGE_KEYS.DROPBOX_TOKEN_EXPIRY);
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
    this.accessToken = readLocalStorageRaw(STORAGE_KEYS.DROPBOX_TOKEN);
    this.refreshToken = readLocalStorageRaw(STORAGE_KEYS.DROPBOX_REFRESH_TOKEN);
    const stored = readLocalStorageRaw(STORAGE_KEYS.DROPBOX_TOKEN_EXPIRY);
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

    const authUrl = await this.oauth.buildAuthorizeUrl();

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

    const data = await this.oauth.exchangeCode(code, returnedState);
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token ?? null;
    this.tokenExpiresAt = data.expires_in
      ? Date.now() + data.expires_in * 1000
      : null;

    writeLocalStorageRaw(STORAGE_KEYS.DROPBOX_TOKEN, data.access_token);
    if (data.refresh_token) {
      writeLocalStorageRaw(STORAGE_KEYS.DROPBOX_REFRESH_TOKEN, data.refresh_token);
    }
    if (this.tokenExpiresAt !== null) {
      writeLocalStorageRaw(STORAGE_KEYS.DROPBOX_TOKEN_EXPIRY, String(this.tokenExpiresAt));
    }

    // Kick provider-owned syncs now that a fresh token is in place. Fire and
    // forget: login success must not depend on sync availability.
    getLikesSync()?.initialSync().catch((err) => {
      console.warn('[DropboxAuth] Post-login likes sync failed:', err);
    });
    getPreferencesSync()?.initialSync().catch((err) => {
      console.warn('[DropboxAuth] Post-login preferences sync failed:', err);
    });

    return true;
  }

  /** Clear the access token and expiry while preserving the refresh token for retry. */
  private clearAccessToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    removeLocalStorageKey(STORAGE_KEYS.DROPBOX_TOKEN);
    removeLocalStorageKey(STORAGE_KEYS.DROPBOX_TOKEN_EXPIRY);
  }

  async logout(): Promise<void> {
    // Flip in-memory auth immediately; purge owns all persisted keys/DBs.
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
    await purgeProviderPersistedData('dropbox');
  }

  /**
   * Called by API consumers when a freshly-refreshed token is still rejected (401).
   * Treats this as an invalid session: clears all tokens and notifies the UI.
   */
  reportUnauthorized(): void {
    if (!this.accessToken && !this.refreshToken) return;
    console.warn('[DropboxAuth] Persistent 401 after token refresh — logging out');
    void this.logout();
    notifyDropboxSessionExpired();
  }

  /** Refresh the access token using the stored refresh token. Single-flight: concurrent callers share one request. */
  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken || !getDropboxClientId()) return null;
    return this.oauth.refresh(this.refreshToken, (outcome) => this.applyRefresh(outcome));
  }

  private applyRefresh(outcome: RefreshOutcome): string | null {
    switch (outcome.kind) {
      case 'success': {
        const { token } = outcome;
        this.accessToken = token.access_token;
        this.tokenExpiresAt = token.expires_in ? Date.now() + token.expires_in * 1000 : null;
        writeLocalStorageRaw(STORAGE_KEYS.DROPBOX_TOKEN, token.access_token);
        if (this.tokenExpiresAt !== null) {
          writeLocalStorageRaw(STORAGE_KEYS.DROPBOX_TOKEN_EXPIRY, String(this.tokenExpiresAt));
        }
        return token.access_token;
      }
      case 'terminal':
        console.warn('[DropboxAuth] Token refresh rejected:', outcome.status);
        void this.logout();
        notifyDropboxSessionExpired();
        return null;
      case 'transient':
        console.warn('[DropboxAuth] Token refresh failed:', outcome.status ?? outcome.error);
        this.clearAccessToken();
        return null;
    }
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
