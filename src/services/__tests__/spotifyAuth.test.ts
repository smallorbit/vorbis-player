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
      const token = {
        access_token: 'valid-token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 3600 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('returns false when token is expired', async () => {
      const token = {
        access_token: 'expired-token',
        refresh_token: 'refresh',
        expires_at: Date.now() - 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();
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
      const token = {
        access_token: 'my-token',
        refresh_token: 'refresh',
        expires_at: Date.now() + 30 * 60 * 1000, // 30 min from now
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();
      const result = await auth.ensureValidToken();
      expect(result).toBe('my-token');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('calls refresh when within 5-minute buffer of expiry', async () => {
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() + 2 * 60 * 1000, // 2 min from now (within 5-min buffer)
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      });

      const result = await auth.ensureValidToken();
      expect(result).toBe('new-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshAccessToken', () => {
    it('POSTs to Spotify token endpoint with correct body', async () => {
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

      await auth.refreshAccessToken();

      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://accounts.spotify.com/api/token');
      expect(options?.method).toBe('POST');
      const body = options?.body as URLSearchParams;
      expect(body.get('grant_type')).toBe('refresh_token');
      expect(body.get('refresh_token')).toBe('my-refresh-token');
      expect(body.get('client_id')).toBeTruthy();
    });

    it('throws on non-ok response', async () => {
      const token = {
        access_token: 'old-token',
        refresh_token: 'my-refresh',
        expires_at: Date.now() + 30 * 60 * 1000,
      };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(token));
      const auth = await freshAuth();

      mockFetchResponse({}, 401);

      await expect(auth.refreshAccessToken()).rejects.toThrow('Token refresh failed');
    });
  });

  describe('handleAuthCallback', () => {
    it('exchanges code+verifier, stores tokens, clears code_verifier', async () => {
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

      await auth.handleAuthCallback('test-code');

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

      await auth.handleRedirect();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(sessionStorage.setItem).toHaveBeenCalledWith('spotify_processed_code', 'abc123');
    });

    it('skips already-seen code via sessionStorage deduplication', async () => {
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

      await auth.handleRedirect();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(window.history.replaceState).toHaveBeenCalled();
    });
  });
});
