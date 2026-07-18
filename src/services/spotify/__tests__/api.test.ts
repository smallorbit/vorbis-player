import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const refreshAccessToken = vi.fn();
const getAccessToken = vi.fn();
const reportUnauthorized = vi.fn();

vi.mock('../auth', () => ({
  spotifyAuth: {
    refreshAccessToken: (...args: unknown[]) => refreshAccessToken(...args),
    getAccessToken: (...args: unknown[]) => getAccessToken(...args),
    reportUnauthorized: (...args: unknown[]) => reportUnauthorized(...args),
  },
}));

import { spotifyApiRequest, SpotifyApiError } from '../api';
import { AuthExpiredError } from '@/providers/errors';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function emptyResponse(status: number, statusText = ''): Response {
  return new Response(null, { status, statusText });
}

describe('spotifyApiRequest — structured errors and retry-after-refresh', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    refreshAccessToken.mockReset();
    getAccessToken.mockReset();
    reportUnauthorized.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws SpotifyApiError carrying status on a 5xx (transient — no refresh, no logout)', async () => {
    // #given — server returns 500
    fetchMock.mockResolvedValueOnce(emptyResponse(500, 'Internal Server Error'));

    // #when / #then
    const promise = spotifyApiRequest<unknown>(
      'https://api.spotify.com/v1/me',
      'token-1',
      { method: 'POST' },
    );
    await expect(promise).rejects.toBeInstanceOf(SpotifyApiError);
    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(reportUnauthorized).not.toHaveBeenCalled();
  });

  it('forces a refresh and retries once on first 401, succeeding on the retry', async () => {
    // #given — first call 401, second call (after refresh) 200
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(jsonResponse({ id: 'me-1' }));
    refreshAccessToken.mockResolvedValue(undefined);
    getAccessToken.mockReturnValue('token-2-fresh');

    // #when
    const result = await spotifyApiRequest<{ id: string }>(
      'https://api.spotify.com/v1/me',
      'token-1-stale',
      { method: 'POST' },
    );

    // #then
    expect(result).toEqual({ id: 'me-1' });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reportUnauthorized).not.toHaveBeenCalled();

    // #and the retry used the freshly-refreshed token
    const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer token-2-fresh',
    );
  });

  it('throws AuthExpiredError and calls reportUnauthorized on a second 401 after refresh', async () => {
    // #given — both calls 401; refresh succeeds but the freshly-minted token is also rejected
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401, 'Unauthorized'))
      .mockResolvedValueOnce(emptyResponse(401, 'Unauthorized'));
    refreshAccessToken.mockResolvedValue(undefined);
    getAccessToken.mockReturnValue('token-2-fresh-but-dead');

    // #when / #then
    const promise = spotifyApiRequest<unknown>(
      'https://api.spotify.com/v1/me',
      'token-1-stale',
      { method: 'POST' },
    );
    await expect(promise).rejects.toBeInstanceOf(AuthExpiredError);
    await expect(promise).rejects.toMatchObject({ providerId: 'spotify' });
    expect(reportUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('throws AuthExpiredError when refresh fails terminally (auth cleared by performRefresh)', async () => {
    // #given — first call 401, refresh throws AND performRefresh cleared tokenData
    //          (i.e. accounts.spotify.com/api/token returned 400/401 and the auth
    //          singleton already invoked reportUnauthorized → logout → getAccessToken null)
    fetchMock.mockResolvedValueOnce(emptyResponse(401, 'Unauthorized'));
    refreshAccessToken.mockRejectedValue(new Error('Token refresh failed: Bad Request'));
    getAccessToken.mockReturnValue(null);

    // #when / #then
    const promise = spotifyApiRequest<unknown>(
      'https://api.spotify.com/v1/me',
      'token-1-stale',
      { method: 'POST' },
    );
    await expect(promise).rejects.toBeInstanceOf(AuthExpiredError);
    // reportUnauthorized was called by performRefresh itself, not by the wrapper —
    // the wrapper relies on the cleared-token signal and does not re-invoke it.
    expect(reportUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows original SpotifyApiError(401) on transient refresh failure (network blip / 5xx)', async () => {
    // #given — first call 401, refresh throws a transient error (network blip),
    //          and the auth singleton still has its tokenData (getAccessToken returns the stale token)
    fetchMock.mockResolvedValueOnce(emptyResponse(401, 'Unauthorized'));
    refreshAccessToken.mockRejectedValue(new Error('network blip'));
    getAccessToken.mockReturnValue('token-1-stale');

    // #when / #then — caller sees the original 401, not AuthExpiredError; user is NOT logged out
    const promise = spotifyApiRequest<unknown>(
      'https://api.spotify.com/v1/me',
      'token-1-stale',
      { method: 'POST' },
    );
    await expect(promise).rejects.toBeInstanceOf(SpotifyApiError);
    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(reportUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-401 errors (e.g. 403)', async () => {
    // #given — server returns 403
    fetchMock.mockResolvedValueOnce(emptyResponse(403, 'Forbidden'));

    // #when / #then
    const promise = spotifyApiRequest<unknown>(
      'https://api.spotify.com/v1/me/player',
      'token-1',
      { method: 'PUT' },
    );
    await expect(promise).rejects.toBeInstanceOf(SpotifyApiError);
    await expect(promise).rejects.toMatchObject({ status: 403 });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(reportUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('spotifyApiRequest — response body parsing', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    getAccessToken.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves undefined for a successful non-JSON body (e.g. player seek) instead of throwing', async () => {
    // #given a 200 with a non-JSON body and no application/json content-type,
    // as Spotify's player seek endpoint sometimes returns (#1671 diagnosis).
    fetchMock.mockResolvedValueOnce(
      new Response('FERpzaDjxZabc', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );

    // #when a void-returning write is issued
    const result = await spotifyApiRequest<void>(
      'https://api.spotify.com/v1/me/player/seek?position_ms=1000',
      'token-1',
      { method: 'PUT' },
    );

    // #then it resolves cleanly rather than throwing a JSON parse error
    expect(result).toBeUndefined();
  });

  it('resolves undefined for a 204 no-content response', async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    const result = await spotifyApiRequest<void>(
      'https://api.spotify.com/v1/me/player/pause',
      'token-1',
      { method: 'PUT' },
    );
    expect(result).toBeUndefined();
  });

  it('still throws when an application/json body is malformed (a real error)', async () => {
    // #given a body declared as JSON but syntactically broken
    fetchMock.mockResolvedValueOnce(
      new Response('{ not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    // #then the parse error surfaces — we only swallow non-JSON bodies
    await expect(
      spotifyApiRequest<{ id: string }>('https://api.spotify.com/v1/me', 'token-1'),
    ).rejects.toThrow();
  });

  it('parses a well-formed JSON body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'me-1' }));
    const result = await spotifyApiRequest<{ id: string }>('https://api.spotify.com/v1/me', 'token-1');
    expect(result).toEqual({ id: 'me-1' });
  });
});
