import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DropboxAuthAdapter } from '../dropboxAuthAdapter';
import { contentApiRequest } from '../dropboxContentApiClient';

function createMockAuth(overrides: Partial<DropboxAuthAdapter> = {}): DropboxAuthAdapter {
  return {
    providerId: 'dropbox' as const,
    isAuthenticated: vi.fn().mockReturnValue(true),
    getAccessToken: vi.fn().mockResolvedValue('initial-token'),
    beginLogin: vi.fn(),
    handleCallback: vi.fn(),
    logout: vi.fn(),
    ensureValidToken: vi.fn().mockResolvedValue('initial-token'),
    refreshAccessToken: vi.fn().mockResolvedValue('refreshed-token'),
    reportUnauthorized: vi.fn(),
    ...overrides,
  } satisfies DropboxAuthAdapter;
}

describe('contentApiRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns response directly when initial call succeeds', async () => {
    // #given
    const auth = createMockAuth();
    const successResponse = new Response('ok', { status: 200 });
    const requestFn = vi.fn().mockResolvedValue(successResponse);

    // #when
    const result = await contentApiRequest(auth, requestFn);

    // #then
    expect(result).toBe(successResponse);
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(requestFn).toHaveBeenCalledWith('initial-token');
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.reportUnauthorized).not.toHaveBeenCalled();
  });

  it('refreshes token on 401 and returns retry response on success', async () => {
    // #given
    const auth = createMockAuth();
    const unauthorized = new Response(null, { status: 401 });
    const success = new Response('ok', { status: 200 });
    const requestFn = vi.fn()
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(success);

    // #when
    const result = await contentApiRequest(auth, requestFn);

    // #then
    expect(result).toBe(success);
    expect(requestFn).toHaveBeenCalledTimes(2);
    expect(requestFn).toHaveBeenNthCalledWith(1, 'initial-token');
    expect(requestFn).toHaveBeenNthCalledWith(2, 'refreshed-token');
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.reportUnauthorized).not.toHaveBeenCalled();
  });

  it('calls reportUnauthorized and returns null when retry also returns 401', async () => {
    // #given
    const auth = createMockAuth();
    const requestFn = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

    // #when
    const result = await contentApiRequest(auth, requestFn);

    // #then
    expect(result).toBeNull();
    expect(requestFn).toHaveBeenCalledTimes(2);
    expect(auth.reportUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('returns null without invoking requestFn when ensureValidToken returns null', async () => {
    // #given
    const auth = createMockAuth({
      ensureValidToken: vi.fn().mockResolvedValue(null),
    });
    const requestFn = vi.fn();

    // #when
    const result = await contentApiRequest(auth, requestFn);

    // #then
    expect(result).toBeNull();
    expect(requestFn).not.toHaveBeenCalled();
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.reportUnauthorized).not.toHaveBeenCalled();
  });

  it('returns null without calling reportUnauthorized when refreshAccessToken returns null', async () => {
    // #given
    const auth = createMockAuth({
      refreshAccessToken: vi.fn().mockResolvedValue(null),
    });
    const requestFn = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

    // #when
    const result = await contentApiRequest(auth, requestFn);

    // #then
    expect(result).toBeNull();
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.reportUnauthorized).not.toHaveBeenCalled();
  });

  it('returns non-401 error responses directly without retry', async () => {
    // #given
    const auth = createMockAuth();
    const serverError = new Response('server error', { status: 500 });
    const requestFn = vi.fn().mockResolvedValue(serverError);

    // #when
    const result = await contentApiRequest(auth, requestFn);

    // #then
    expect(result).toBe(serverError);
    expect(requestFn).toHaveBeenCalledTimes(1);
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.reportUnauthorized).not.toHaveBeenCalled();
  });
});
