import { describe, it, expect, vi, beforeEach } from 'vitest';

function mockFetchResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

async function freshAuth() {
  vi.resetModules();
  const mod = await import('@/services/spotify');
  return mod.spotifyAuth;
}

describe('SpotifyAuth', () => {
  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockImplementation(() => {});
    vi.mocked(localStorage.removeItem).mockImplementation(() => {});
    vi.mocked(sessionStorage.getItem).mockReturnValue(null);
    vi.mocked(sessionStorage.setItem).mockImplementation(() => {});
    vi.mocked(sessionStorage.removeItem).mockImplementation(() => {});
  });

  describe('isAuthenticated', () => {
    it('returns false when no token in localStorage', async () => {
      const auth = await freshAuth();
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('returns true with a valid non-expired token', async () => {
      // #given
      const token = {
        access_token: 'valid-token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));

      // #when
      const auth = await freshAuth();

      // #then
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('returns true when token is expired but refresh token exists', async () => {
      // #given
      const token = {
        access_token: 'expired-token',
        refresh_token: 'refresh',
        expires_at: Date.now() - 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));

      // #when
      const auth = await freshAuth();

      // #then
      expect(auth.isAuthenticated()).toBe(true);
      expect(localStorage.removeItem).not.toHaveBeenCalledWith('spotify_token');
    });

    it('returns false and clears storage when token is expired without refresh token', async () => {
      // #given
      const token = {
        access_token: 'expired-token',
        expires_at: Date.now() - 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));

      // #when
      const auth = await freshAuth();

      // #then
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith('spotify_token');
    });
  });

  describe('loadTokenFromStorage', () => {
    it('clears localStorage on invalid JSON', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue('not-valid-json{{{');
      const auth = await freshAuth();
      expect(auth.isAuthenticated()).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith('spotify_token');
    });
  });

  describe('ensureValidToken', () => {
    it('returns current access_token when not near expiry', async () => {
      // #given
      const token = {
        access_token: 'my-token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 30 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      // #when
      const result = await auth.ensureValidToken();

      // #then
      expect(result).toBe('my-token');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refreshes token when access token is already expired', async () => {
      // #given
      const token = {
        access_token: 'expired-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() - 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });

      // #when
      const result = await auth.ensureValidToken();

      // #then
      expect(result).toBe('new-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('calls refresh when within 5-minute buffer of expiry', async () => {
      // #given
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() + 2 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });

      // #when
      const result = await auth.ensureValidToken();

      // #then
      expect(result).toBe('new-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshAccessToken', () => {
    it('POSTs to Spotify token endpoint with correct body', async () => {
      // #given
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh-token',
        expires_at: Date.now() + 30 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });

      // #when
      await auth.refreshAccessToken();

      // #then
      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://accounts.spotify.com/api/token');
      expect(options?.method).toBe('POST');
      const body = options?.body as URLSearchParams;
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('my-refresh-token');
      expect(body.get('client_id')).toBeTruthy();
    });

    it('throws on non-ok response', async () => {
      // #given
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() + 30 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({}, 401);

      // #when / #then
      await expect(auth.refreshAccessToken()).rejects.toThrow('Token refresh failed');
    });

    it('logs out and emits SESSION_EXPIRED_EVENT on 401 refresh', async () => {
      // #given
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() + 30 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({}, 401);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      // #when
      await expect(auth.refreshAccessToken()).rejects.toThrow('Token refresh failed');

      // #then
      expect(localStorage.removeItem).toHaveBeenCalledWith('spotify_token');
      const dispatchedEvents = dispatchSpy.mock.calls.map(call => (call[0] as Event).type);
      expect(dispatchedEvents).toContain('vorbis-session-expired');
      dispatchSpy.mockRestore();
    });

    it('logs out and emits SESSION_EXPIRED_EVENT on 400 refresh', async () => {
      // #given
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() + 30 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({}, 400);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      // #when
      await expect(auth.refreshAccessToken()).rejects.toThrow('Token refresh failed');

      // #then
      expect(localStorage.removeItem).toHaveBeenCalledWith('spotify_token');
      const dispatchedEvents = dispatchSpy.mock.calls.map(call => (call[0] as Event).type);
      expect(dispatchedEvents).toContain('vorbis-session-expired');
      dispatchSpy.mockRestore();
    });

    it('preserves refresh token on 5xx (transient) — no logout, no event', async () => {
      // #given
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() + 30 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({}, 500);

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      // #when
      await expect(auth.refreshAccessToken()).rejects.toThrow('Token refresh failed');

      // #then
      expect(localStorage.removeItem).not.toHaveBeenCalledWith('spotify_token');
      const dispatchedEvents = dispatchSpy.mock.calls.map(call => (call[0] as Event).type);
      expect(dispatchedEvents).not.toContain('vorbis-session-expired');
      dispatchSpy.mockRestore();
    });

    it('single-flights concurrent refresh calls into one fetch', async () => {
      // #given
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() + 30 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });

      // #when
      const [a, b, c] = await Promise.all([
        auth.refreshAccessToken(),
        auth.refreshAccessToken(),
        auth.refreshAccessToken(),
      ]);

      // #then
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
      expect(c).toBeUndefined();
    });
  });

  describe('handleAuthCallback', () => {
    it('exchanges code+verifier, stores tokens, clears code_verifier', async () => {
      // #given
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'spotify_code_verifier') return 'test-verifier';
        return null;
      });
      const auth = await freshAuth();

      mockFetchResponse({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });

      // #when
      await auth.handleAuthCallback('test-code');

      // #then
      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://accounts.spotify.com/api/token');
      const body = options?.body as URLSearchParams;
      expect(body.get('grant_type')).toBe('authorization_code');
      expect(body.get('code')).toBe('test-code');
      expect(body.get('code_verifier')).toBe('test-verifier');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'spotify_token',
        expect.stringContaining('new-access')
      );
      expect(localStorage.removeItem).toHaveBeenCalledWith('spotify_code_verifier');
    });
  });

  describe('handleRedirect', () => {
    it('is a no-op when pathname is not the callback path', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'http://127.0.0.1:3000', pathname: '/', search: '' },
        writable: true,
      });
      const auth = await freshAuth();
      await auth.handleRedirect();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('calls handleAuthCallback when code param present and on callback path', async () => {
      // #given
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://127.0.0.1:3000/auth/spotify/callback?code=abc123',
          pathname: '/auth/spotify/callback',
          search: '?code=abc123',
        },
        writable: true,
      });
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'spotify_code_verifier') return 'verifier';
        return null;
      });
      const auth = await freshAuth();

      mockFetchResponse({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_in: 3600,
      });

      // #when
      await auth.handleRedirect();

      // #then
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(sessionStorage.setItem).toHaveBeenCalledWith('spotify_processed_code', 'abc123');
    });

    it('skips already-seen code via sessionStorage deduplication', async () => {
      // #given
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://127.0.0.1:3000/auth/spotify/callback?code=abc123',
          pathname: '/auth/spotify/callback',
          search: '?code=abc123',
        },
        writable: true,
      });
      vi.mocked(sessionStorage.getItem).mockReturnValue('abc123');
      const auth = await freshAuth();

      // #when
      await auth.handleRedirect();

      // #then
      expect(global.fetch).not.toHaveBeenCalled();
      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });
});
