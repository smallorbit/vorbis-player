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
    it('stores a state value in sessionStorage before redirecting', async () => {
      // #given
      const adapter = new DropboxAuthAdapter();

      // #when
      await adapter.beginLogin();

      // #then
      expect(sessionStorage.getItem('vorbis-player-dropbox-oauth-state')).not.toBeNull();
    });

    it('includes the state parameter in the authorization URL', async () => {
      // #given
      const adapter = new DropboxAuthAdapter();

      // #when
      await adapter.beginLogin();

      // #then
      const storedState = sessionStorage.getItem('vorbis-player-dropbox-oauth-state');
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
      const state = sessionStorage.getItem('vorbis-player-dropbox-oauth-state')!;
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
      expect(sessionStorage.getItem('vorbis-player-dropbox-oauth-state')).toBeNull();
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

    it('clears state from sessionStorage after a successful exchange', async () => {
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
      expect(sessionStorage.getItem('vorbis-player-dropbox-oauth-state')).toBeNull();
    });
  });

  describe('logout', () => {
    it('clears the oauth state from sessionStorage', () => {
      // #given
      const adapter = new DropboxAuthAdapter();
      sessionStorage.setItem('vorbis-player-dropbox-oauth-state', 'leftover-state');

      // #when
      adapter.logout();

      // #then
      expect(sessionStorage.getItem('vorbis-player-dropbox-oauth-state')).toBeNull();
    });
  });
});
