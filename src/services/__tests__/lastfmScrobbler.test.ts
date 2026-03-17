import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isScrobblingConfigured,
  isScrobblingAuthenticated,
  getSessionKey,
  getLastFmUsername,
  handleLastFmCallback,
  logoutLastFm,
  updateNowPlaying,
  scrobble,
  _md5,
  _apiSignature,
} from '../lastfmScrobbler';

// Set up Last.fm env vars (merges with the ones in test/setup.ts)
beforeEach(() => {
  Object.assign(import.meta.env, {
    VITE_LASTFM_API_KEY: 'test-api-key',
    VITE_LASTFM_API_SECRET: 'test-api-secret',
  });
});

// localStorage is mocked in test/setup.ts; we need a backing store for tests that write+read
let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.mocked(localStorage.getItem).mockImplementation((key: string) => store[key] ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((key: string, val: string) => { store[key] = val; });
  vi.mocked(localStorage.removeItem).mockImplementation((key: string) => { delete store[key]; });
  vi.mocked(localStorage.clear).mockImplementation(() => { store = {}; });
  vi.mocked(global.fetch).mockReset();
});

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) };
}

function errorResponse(status: number) {
  return { ok: false, status, statusText: 'Error', json: () => Promise.resolve({}), text: () => Promise.resolve('Error') };
}

describe('md5', () => {
  it('computes correct MD5 hash for empty string', () => {
    expect(_md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('computes correct MD5 hash for "hello"', () => {
    expect(_md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('computes correct MD5 for a longer string', () => {
    expect(_md5('The quick brown fox jumps over the lazy dog'))
      .toBe('9e107d9d372bb6826bd81d3542a419d6');
  });
});

describe('apiSignature', () => {
  it('builds signature from sorted params + secret', () => {
    // apiSignature only processes what's passed to it; api_key is added by lastfmPost
    const sig = _apiSignature({ method: 'auth.getSession', token: 'abc' });
    const expected = _md5('methodauth.getSessiontokenabctest-api-secret');
    expect(sig).toBe(expected);
  });
});

describe('isScrobblingConfigured', () => {
  it('returns true when both key and secret are set', () => {
    expect(isScrobblingConfigured()).toBe(true);
  });

  it('returns false when secret is missing', () => {
    import.meta.env.VITE_LASTFM_API_SECRET = '';
    expect(isScrobblingConfigured()).toBe(false);
  });
});

describe('session management', () => {
  it('returns null when no session', () => {
    expect(getSessionKey()).toBeNull();
    expect(getLastFmUsername()).toBeNull();
    expect(isScrobblingAuthenticated()).toBe(false);
  });

  it('returns session key when stored', () => {
    store['vorbis-player-lastfm-session-key'] = 'sk-123';
    expect(getSessionKey()).toBe('sk-123');
    expect(isScrobblingAuthenticated()).toBe(true);
  });

  it('logoutLastFm clears storage', () => {
    store['vorbis-player-lastfm-session-key'] = 'sk-123';
    store['vorbis-player-lastfm-username'] = 'testuser';
    logoutLastFm();
    expect(getSessionKey()).toBeNull();
    expect(getLastFmUsername()).toBeNull();
  });
});

describe('handleLastFmCallback', () => {
  it('returns false for non-lastfm URLs', async () => {
    const url = new URL('http://localhost/auth/spotify/callback?code=abc');
    expect(await handleLastFmCallback(url)).toBe(false);
  });

  it('returns false when no token param', async () => {
    const url = new URL('http://localhost/auth/lastfm/callback');
    expect(await handleLastFmCallback(url)).toBe(false);
  });

  it('exchanges token for session key', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ session: { key: 'session-abc', name: 'cooluser' } }) as Response,
    );

    const url = new URL('http://localhost/auth/lastfm/callback?token=mytoken');
    const result = await handleLastFmCallback(url);

    expect(result).toBe(true);
    expect(store['vorbis-player-lastfm-session-key']).toBe('session-abc');
    expect(store['vorbis-player-lastfm-username']).toBe('cooluser');

    // Verify the fetch was called with POST
    expect(global.fetch).toHaveBeenCalledOnce();
    const [fetchUrl, fetchOpts] = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchUrl).toBe('https://ws.audioscrobbler.com/2.0/');
    expect((fetchOpts as RequestInit).method).toBe('POST');
    const body = (fetchOpts as RequestInit).body as string;
    expect(body).toContain('method=auth.getSession');
    expect(body).toContain('token=mytoken');
    expect(body).toContain('api_sig=');
  });

  it('throws on missing session in response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({}) as Response);
    const url = new URL('http://localhost/auth/lastfm/callback?token=badtoken');
    await expect(handleLastFmCallback(url)).rejects.toThrow('Failed to obtain Last.fm session key');
  });
});

describe('updateNowPlaying', () => {
  it('does nothing when not authenticated', async () => {
    await updateNowPlaying({ artist: 'Radiohead', track: 'Creep' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends now playing with session key', async () => {
    store['vorbis-player-lastfm-session-key'] = 'sk-test';
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ nowplaying: {} }) as Response);

    await updateNowPlaying({ artist: 'Radiohead', track: 'Creep', album: 'Pablo Honey', duration: 238 });

    expect(global.fetch).toHaveBeenCalledOnce();
    const body = (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string;
    expect(body).toContain('method=track.updateNowPlaying');
    expect(body).toContain('artist=Radiohead');
    expect(body).toContain('track=Creep');
    expect(body).toContain('album=Pablo+Honey');
    expect(body).toContain('duration=238');
    expect(body).toContain('sk=sk-test');
  });

  it('logs warning on failure but does not throw', async () => {
    store['vorbis-player-lastfm-session-key'] = 'sk-test';
    vi.mocked(global.fetch).mockResolvedValueOnce(errorResponse(500) as unknown as Response);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await updateNowPlaying({ artist: 'Test', track: 'Song' });
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe('scrobble', () => {
  it('does nothing when not authenticated', async () => {
    await scrobble({ artist: 'Radiohead', track: 'Creep' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends scrobble with timestamp', async () => {
    store['vorbis-player-lastfm-session-key'] = 'sk-test';
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse({ scrobbles: {} }) as Response);

    await scrobble({ artist: 'Radiohead', track: 'Creep', album: 'Pablo Honey' }, 1700000000);

    expect(global.fetch).toHaveBeenCalledOnce();
    const body = (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).body as string;
    expect(body).toContain('method=track.scrobble');
    expect(body).toContain('artist=Radiohead');
    expect(body).toContain('track=Creep');
    expect(body).toContain('timestamp=1700000000');
    expect(body).toContain('sk=sk-test');
  });
});
