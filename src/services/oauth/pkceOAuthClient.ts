/**
 * Provider-neutral OAuth 2.0 Authorization Code + PKCE client (RFC 7636).
 *
 * Owns the parts every provider repeats: verifier/challenge generation, the
 * CSRF `state` round-trip, the code exchange, single-flight refresh, and the
 * terminal-vs-transient classification of refresh failures. Token persistence
 * stays with each provider because their stored shapes differ.
 */

import {
  readLocalStorageRaw,
  removeLocalStorageKey,
  writeLocalStorageRaw,
} from '@/utils/persistedStorage';
import { parseOAuthTokenResponse, type OAuthTokenResponse } from '@/utils/oauthTokenResponse';

export interface PkceOAuthConfig {
  /** Prefix for thrown error messages, e.g. `'Spotify'`. */
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  getClientId: () => string;
  getRedirectUri: () => string;
  storageKeys: {
    codeVerifier: string;
    state: string;
  };
  authorizeParams?: Readonly<Record<string, string>>;
}

/**
 * `terminal`: the authorization server rejected the refresh token (400/401);
 * the session cannot recover without a new login.
 * `transient`: network failure or any other status; the refresh token is
 * still believed valid and a later retry may succeed.
 */
export type RefreshOutcome =
  | { kind: 'success'; token: OAuthTokenResponse }
  | { kind: 'terminal'; status: number }
  | { kind: 'transient'; status: number | null; error?: unknown };

export class OAuthStateMismatchError extends Error {
  constructor() {
    super('OAuth state mismatch — possible CSRF attack');
    this.name = 'OAuthStateMismatchError';
  }
}

/**
 * The callback arrived but this browser holds no pending login (state or
 * verifier absent): storage was cleared mid-flow, or the login began before a
 * deploy that introduced `state`. Not evidence of forgery, so callers may
 * safely restart the login.
 */
export class PendingLoginMissingError extends Error {
  constructor(label: string) {
    super(`${label} login was not started in this browser or has expired. Please sign in again.`);
    this.name = 'PendingLoginMissingError';
  }
}

const TERMINAL_REFRESH_STATUSES = new Set([400, 401]);

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function codeChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/** `TRefresh` is what a provider's refresh handler resolves to. */
export class PkceOAuthClient<TRefresh> {
  private refreshInFlight: Promise<TRefresh> | null = null;
  private exchangeInFlight: { code: string; promise: Promise<OAuthTokenResponse> } | null = null;

  private readonly config: PkceOAuthConfig;

  constructor(config: PkceOAuthConfig) {
    this.config = config;
  }

  /** Generates and stores a fresh verifier + state, returning the authorize URL. */
  async buildAuthorizeUrl(): Promise<string> {
    const { storageKeys } = this.config;
    const codeVerifier = randomBase64Url(32);
    const state = randomBase64Url(16);
    writeLocalStorageRaw(storageKeys.codeVerifier, codeVerifier);
    writeLocalStorageRaw(storageKeys.state, state);

    const params = new URLSearchParams({
      client_id: this.config.getClientId(),
      response_type: 'code',
      redirect_uri: this.config.getRedirectUri(),
      code_challenge_method: 'S256',
      code_challenge: await codeChallengeFor(codeVerifier),
      state,
      ...this.config.authorizeParams,
    });
    return `${this.config.authorizeUrl}?${params.toString()}`;
  }

  /**
   * Verifies the returned `state` against the stored one, then trades the code
   * for tokens. The stored state is single-use: it is cleared before the
   * comparison so a replayed callback cannot reuse it. A missing stored state
   * throws `PendingLoginMissingError`; a present-but-different one throws
   * `OAuthStateMismatchError`. Neither reaches the token endpoint.
   *
   * Concurrent calls for the same code share one exchange: React StrictMode
   * runs the auth effect twice, and the second run would otherwise find the
   * state already consumed.
   */
  exchangeCode(code: string, returnedState: string | null): Promise<OAuthTokenResponse> {
    if (this.exchangeInFlight?.code === code) {
      return this.exchangeInFlight.promise;
    }
    const promise = this.performExchange(code, returnedState).finally(() => {
      if (this.exchangeInFlight?.promise === promise) {
        this.exchangeInFlight = null;
      }
    });
    this.exchangeInFlight = { code, promise };
    return promise;
  }

  private async performExchange(
    code: string,
    returnedState: string | null,
  ): Promise<OAuthTokenResponse> {
    const { storageKeys, label } = this.config;
    const expectedState = readLocalStorageRaw(storageKeys.state);
    removeLocalStorageKey(storageKeys.state);
    const codeVerifier = readLocalStorageRaw(storageKeys.codeVerifier);
    if (!expectedState || !codeVerifier) {
      throw new PendingLoginMissingError(label);
    }
    if (returnedState !== expectedState) {
      throw new OAuthStateMismatchError();
    }

    const response = await this.postToTokenEndpoint({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.getRedirectUri(),
      code_verifier: codeVerifier,
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${label} token exchange failed: ${response.status} ${errorText}`);
    }

    const token = parseOAuthTokenResponse(await response.json());
    removeLocalStorageKey(storageKeys.codeVerifier);
    return token;
  }

  /**
   * Single-flight refresh: concurrent callers share one network request and
   * one run of `apply`, so providers persist the new token (or log out) once.
   */
  refresh(
    refreshToken: string,
    apply: (outcome: RefreshOutcome) => TRefresh | Promise<TRefresh>,
  ): Promise<TRefresh> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const flight = this.requestRefresh(refreshToken)
      .then(apply)
      .finally(() => {
        this.refreshInFlight = null;
      });
    this.refreshInFlight = flight;
    return flight;
  }

  /** Drops any half-finished login (verifier + state). */
  clearPendingLogin(): void {
    removeLocalStorageKey(this.config.storageKeys.codeVerifier);
    removeLocalStorageKey(this.config.storageKeys.state);
  }

  private async requestRefresh(refreshToken: string): Promise<RefreshOutcome> {
    let response: Response;
    try {
      response = await this.postToTokenEndpoint({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
    } catch (error) {
      return { kind: 'transient', status: null, error };
    }

    if (!response.ok) {
      return TERMINAL_REFRESH_STATUSES.has(response.status)
        ? { kind: 'terminal', status: response.status }
        : { kind: 'transient', status: response.status };
    }
    return { kind: 'success', token: parseOAuthTokenResponse(await response.json()) };
  }

  private postToTokenEndpoint(fields: Record<string, string>): Promise<Response> {
    return fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.config.getClientId(), ...fields }),
    });
  }
}
