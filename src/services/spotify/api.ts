import type { PaginatedResponse } from './types';
import { SPOTIFY_RATE_LIMIT_WAIT_S } from '@/constants/spotify';
import { spotifyAuth } from './auth';
import { AuthExpiredError } from '@/providers/errors';

/**
 * Structured error thrown for any non-OK Spotify Web API response.
 * Carries the HTTP `status` so downstream consumers can branch on the status
 * code without parsing the error message string. The message format is kept
 * stable (`Spotify API error: <status> <statusText>`) so log/breadcrumb queries
 * targeting the legacy generic-Error message continue to match.
 */
export class SpotifyApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  constructor(status: number, statusText: string, message?: string) {
    super(message ?? `Spotify API error: ${status} ${statusText}`);
    this.name = 'SpotifyApiError';
    this.status = status;
    this.statusText = statusText;
  }
}

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
    const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : SPOTIFY_RATE_LIMIT_WAIT_S;
    const waitMs = (isNaN(waitSeconds) ? SPOTIFY_RATE_LIMIT_WAIT_S : Math.max(waitSeconds, 1)) * 1000;
    rateLimitedUntil = Date.now() + waitMs;
    console.warn(`[spotify] 429 rate-limited — backing off for ${waitMs}ms`);
  }
}

// =============================================================================
// API Request Functions
// =============================================================================

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
    throw new SpotifyApiError(response.status, response.statusText);
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

/**
 * Wrap a single `executeApiRequest` call with one-shot retry-after-refresh on
 * 401: on the first 401 we force a token refresh and re-issue the request with
 * the freshly-minted access token; on a second 401 we throw `AuthExpiredError`
 * and notify the auth layer via `reportUnauthorized()`, which logs out and
 * dispatches `SESSION_EXPIRED_EVENT`.
 *
 * Non-401 errors propagate as `SpotifyApiError` (transient — no logout).
 */
async function executeWithAuthRetry<T>(
  url: string,
  token: string,
  options: RequestInit,
): Promise<T> {
  try {
    return await executeApiRequest<T>(url, token, options);
  } catch (err) {
    if (!(err instanceof SpotifyApiError) || err.status !== 401) {
      throw err;
    }

    let refreshedToken: string;
    try {
      await spotifyAuth.refreshAccessToken();
      const next = spotifyAuth.getAccessToken();
      if (!next) {
        spotifyAuth.reportUnauthorized();
        throw new AuthExpiredError('spotify');
      }
      refreshedToken = next;
    } catch (refreshErr) {
      if (refreshErr instanceof AuthExpiredError) throw refreshErr;
      spotifyAuth.reportUnauthorized();
      throw new AuthExpiredError('spotify');
    }

    try {
      return await executeApiRequest<T>(url, refreshedToken, options);
    } catch (retryErr) {
      if (retryErr instanceof SpotifyApiError && retryErr.status === 401) {
        spotifyAuth.reportUnauthorized();
        throw new AuthExpiredError('spotify');
      }
      throw retryErr;
    }
  }
}

export async function spotifyApiRequest<T>(
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

    const promise = executeWithAuthRetry<T>(url, token, options).finally(() => {
      inflightRequests.delete(key);
    });
    inflightRequests.set(key, promise);
    return promise;
  }

  return executeWithAuthRetry<T>(url, token, options);
}

export async function fetchAllPaginated<TItem, TResult>(
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
