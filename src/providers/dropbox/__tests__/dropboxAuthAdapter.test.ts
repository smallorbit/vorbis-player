import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DropboxAuthAdapter } from '../dropboxAuthAdapter';

// jsdom clears both localStorage and sessionStorage when window.location.href is assigned
// a cross-origin URL (which beginLogin() does when redirecting to Dropbox). Replace both
// with reliable in-memory implementations so stored values survive the redirect.
function makeStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      store = {};
    },
  };
}

const localStorageMock = makeStorageMock();
const sessionStorageMock = makeStorageMock();

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);

vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) array[i] = i % 256;
    return array;
  }),
  subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
});

vi.stubEnv('VITE_DROPBOX_CLIENT_ID', 'test-client-id');

const originalHref = window.location.href;

beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: originalHref, origin: 'http://127.0.0.1:3000', pathname: '/' },
  });
});

describe('DropboxAuthAdapter', () => {
  describe('beginLogin', () => {
    it('stores a state value in localStorage before redirecting', async () => {
      // #given
      const adapter = new DropboxAuthAdapter();

      // #when
      await adapter.beginLogin();

      // #then
      expect(localStorage.getItem('vorbis-player-dropbox-oauth-state')).not.toBeNull();
    });

    it('includes the state parameter in the authorization URL', async () => {
      // #given
      const adapter = new DropboxAuthAdapter();

      // #when
      await adapter.beginLogin();

      // #then
      const storedState = localStorage.getItem('vorbis-player-dropbox-oauth-state');
      const redirected = new URL(window.location.href);
      expect(redirected.searchParams.get('state')).toBe(storedState);
    });

    it('stores the PKCE code verifier in localStorage', async () => {
      // #given
      const adapter = new DropboxAuthAdapter();

      // #when
      await adapter.beginLogin();

      // #then
      expect(localStorage.getItem('vorbis-player-dropbox-code-verifier')).not.toBeNull();
    });
  });

  describe('handleCallback', () => {
    async function beginLogin(): Promise<{ adapter: DropboxAuthAdapter; state: string }> {
      const adapter = new DropboxAuthAdapter();
      await adapter.beginLogin();
      const state = localStorage.getItem('vorbis-player-dropbox-oauth-state')!;
      return { adapter, state };
    }

    function makeCallbackUrl(code: string, state: string): URL {
      return new URL(
        `http://127.0.0.1:3000/auth/dropbox/callback?code=${code}&state=${state}`,
      );
    }

    it('returns false for non-callback URLs', async () => {
      // #given
      const adapter = new DropboxAuthAdapter();
      const url = new URL('http://127.0.0.1:3000/some/other/path');

      // #when
      const result = await adapter.handleCallback(url);

      // #then
      expect(result).toBe(false);
    });

    it('returns false when no code is present', async () => {
      // #given
      const { adapter, state } = await beginLogin();
      const url = new URL(`http://127.0.0.1:3000/auth/dropbox/callback?state=${state}`);

      // #when
      const result = await adapter.handleCallback(url);

      // #then
      expect(result).toBe(false);
    });

    it('throws when state parameter is missing from callback', async () => {
      // #given
      const { adapter } = await beginLogin();
      const url = new URL('http://127.0.0.1:3000/auth/dropbox/callback?code=abc');

      // #when / #then
      await expect(adapter.handleCallback(url)).rejects.toThrow('OAuth state mismatch');
    });

    it('throws when state parameter does not match stored value', async () => {
      // #given
      const { adapter } = await beginLogin();
      const url = makeCallbackUrl('abc', 'wrong-state-value');

      // #when / #then
      await expect(adapter.handleCallback(url)).rejects.toThrow('OAuth state mismatch');
    });

    it('throws when no state was stored (e.g. beginLogin was never called)', async () => {
      // #given
      const adapter = new DropboxAuthAdapter();
      const url = makeCallbackUrl('abc', 'some-state');

      // #when / #then
      await expect(adapter.handleCallback(url)).rejects.toThrow('OAuth state mismatch');
    });

    it('clears the stored state after a mismatched callback', async () => {
      // #given
      const { adapter } = await beginLogin();
      const url = makeCallbackUrl('abc', 'wrong-state');

      // #when
      await adapter.handleCallback(url).catch(() => {});

      // #then
      expect(localStorage.getItem('vorbis-player-dropbox-oauth-state')).toBeNull();
    });

    it('throws on Dropbox error parameter', async () => {
      // #given
      const adapter = new DropboxAuthAdapter();
      const url = new URL(
        'http://127.0.0.1:3000/auth/dropbox/callback?error=access_denied',
      );

      // #when / #then
      await expect(adapter.handleCallback(url)).rejects.toThrow(
        'Dropbox auth error: access_denied',
      );
    });

    it('exchanges code for token when state matches', async () => {
      // #given
      const { adapter, state } = await beginLogin();
      const url = makeCallbackUrl('valid-code', state);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ access_token: 'tok-123', refresh_token: 'ref-456' }),
        }),
      );

      // #when
      const result = await adapter.handleCallback(url);

      // #then
      expect(result).toBe(true);
      expect(localStorage.getItem('vorbis-player-dropbox-token')).toBe('tok-123');
      expect(localStorage.getItem('vorbis-player-dropbox-refresh-token')).toBe('ref-456');
    });

    it('clears state from localStorage after a successful exchange', async () => {
      // #given
      const { adapter, state } = await beginLogin();
      const url = makeCallbackUrl('valid-code', state);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ access_token: 'tok-123' }),
        }),
      );

      // #when
      await adapter.handleCallback(url);

      // #then
      expect(localStorage.getItem('vorbis-player-dropbox-oauth-state')).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('calls ensureValidToken to refresh when near expiry', async () => {
      // #given
      localStorageMock.setItem('vorbis-player-dropbox-token', 'old-token');
      localStorageMock.setItem('vorbis-player-dropbox-refresh-token', 'my-refresh');
      localStorageMock.setItem('vorbis-player-dropbox-token-expiry', String(Date.now() - 1000));

      const adapter = new DropboxAuthAdapter();
      vi.spyOn(adapter, 'refreshAccessToken').mockResolvedValue('new-token');

      // #when
      const token = await adapter.getAccessToken();

      // #then
      expect(token).toBe('new-token');
      expect(adapter.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it('returns current token when not expired', async () => {
      // #given
      localStorageMock.setItem('vorbis-player-dropbox-token', 'valid-token');
      localStorageMock.setItem('vorbis-player-dropbox-token-expiry', String(Date.now() + 3600000));

      const adapter = new DropboxAuthAdapter();

      // #when / #then
      const token = await adapter.getAccessToken();
      expect(token).toBe('valid-token');
    });

    it('returns null when no token exists', async () => {
      const adapter = new DropboxAuthAdapter();
      const token = await adapter.getAccessToken();
      expect(token).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    // DROPBOX_CLIENT_ID is a module-level const evaluated at static import time,
    // so we need dynamic imports after vi.stubEnv to test the real refresh logic.
    async function freshAdapter(storageInit: Record<string, string>) {
      vi.resetModules();
      for (const [k, v] of Object.entries(storageInit)) {
        localStorageMock.setItem(k, v);
      }
      const mod = await import('../dropboxAuthAdapter');
      return new mod.DropboxAuthAdapter();
    }

    it('preserves refresh token on server error (5xx)', async () => {
      // #given
      const adapter = await freshAdapter({
        'vorbis-player-dropbox-token': 'old-token',
        'vorbis-player-dropbox-refresh-token': 'my-refresh',
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      // #when
      const result = await adapter.refreshAccessToken();

      // #then
      expect(result).toBeNull();
      expect(localStorageMock.getItem('vorbis-player-dropbox-refresh-token')).toBe('my-refresh');
      expect(localStorageMock.getItem('vorbis-player-dropbox-token')).toBeNull();
    });

    it('calls full logout on 401 (invalid/revoked token)', async () => {
      // #given
      const adapter = await freshAdapter({
        'vorbis-player-dropbox-token': 'old-token',
        'vorbis-player-dropbox-refresh-token': 'my-refresh',
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }));

      // #when
      const result = await adapter.refreshAccessToken();

      // #then
      expect(result).toBeNull();
      expect(localStorageMock.getItem('vorbis-player-dropbox-refresh-token')).toBeNull();
      expect(localStorageMock.getItem('vorbis-player-dropbox-token')).toBeNull();
    });

    it('preserves refresh token on network error', async () => {
      // #given
      const adapter = await freshAdapter({
        'vorbis-player-dropbox-token': 'old-token',
        'vorbis-player-dropbox-refresh-token': 'my-refresh',
      });

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

      // #when
      const result = await adapter.refreshAccessToken();

      // #then
      expect(result).toBeNull();
      expect(localStorageMock.getItem('vorbis-player-dropbox-refresh-token')).toBe('my-refresh');
    });

    it('emits SESSION_EXPIRED_EVENT on 401 (invalid grant)', async () => {
      // #given
      const adapter = await freshAdapter({
        'vorbis-player-dropbox-token': 'old-token',
        'vorbis-player-dropbox-refresh-token': 'my-refresh',
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }));

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      // #when
      await adapter.refreshAccessToken();

      // #then
      const dispatchedEvents = dispatchSpy.mock.calls.map(call => (call[0] as Event).type);
      expect(dispatchedEvents).toContain('vorbis-session-expired');
      dispatchSpy.mockRestore();
    });

    it('single-flights concurrent refresh calls into one fetch', async () => {
      // #given
      const adapter = await freshAdapter({
        'vorbis-player-dropbox-token': 'old-token',
        'vorbis-player-dropbox-refresh-token': 'my-refresh',
      });

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      // #when
      const [a, b, c] = await Promise.all([
        adapter.refreshAccessToken(),
        adapter.refreshAccessToken(),
        adapter.refreshAccessToken(),
      ]);

      // #then
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(a).toBe('fresh-token');
      expect(b).toBe('fresh-token');
      expect(c).toBe('fresh-token');
    });
  });

  describe('logout', () => {
    it('clears the oauth state from localStorage', () => {
      // #given
      const adapter = new DropboxAuthAdapter();
      localStorage.setItem('vorbis-player-dropbox-oauth-state', 'leftover-state');

      // #when
      adapter.logout();

      // #then
      expect(localStorage.getItem('vorbis-player-dropbox-oauth-state')).toBeNull();
    });
  });
});
