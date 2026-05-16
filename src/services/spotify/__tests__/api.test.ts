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

  it('throws AuthExpiredError and calls reportUnauthorized when refresh itself fails', async () => {
    // #given — first call 401, refresh throws (e.g. no refresh token)
    fetchMock.mockResolvedValueOnce(emptyResponse(401, 'Unauthorized'));
    refreshAccessToken.mockRejectedValue(new Error('No refresh token available'));

    // #when / #then
    const promise = spotifyApiRequest<unknown>(
      'https://api.spotify.com/v1/me',
      'token-1-stale',
      { method: 'POST' },
    );
    await expect(promise).rejects.toBeInstanceOf(AuthExpiredError);
    expect(reportUnauthorized).toHaveBeenCalledTimes(1);
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
