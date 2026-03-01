import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as libraryCache from '@/services/cache/libraryCache';
import { logNetwork } from '@/services/errorLogger';

vi.mock('@/services/cache/libraryCache', () => ({
  getTrackList: vi.fn().mockResolvedValue(null),
  putTrackList: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/errorLogger', () => ({
  logError: vi.fn(),
  logNetwork: vi.fn(),
}));

function mockFetchResponse(body: unknown, status = 200, headers?: Record<string, string>) {
  return vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response);
}

function setupAuthenticatedModule() {
  const token = {
    access_token: 'test-token',
    refresh_token: 'refresh',
    expires_at: Date.now() + 3600 * 1000,
  };
  vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
    if (key === 'spotify_token') return JSON.stringify(token);
    return null;
  });
}

async function freshSpotify() {
  vi.resetModules();
  setupAuthenticatedModule();
  return await import('@/services/spotify');
}

describe('Spotify API', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    vi.mocked(localStorage.setItem).mockImplementation(() => {});
    vi.mocked(localStorage.removeItem).mockImplementation(() => {});
    vi.mocked(libraryCache.getTrackList).mockResolvedValue(null);
    vi.mocked(libraryCache.putTrackList).mockResolvedValue(undefined);
  });

  describe('rate limiting', () => {
    it('logs request and response entries at NETWORK level format', async () => {
      const mod = await freshSpotify();
      mockFetchResponse({ items: [], next: null, total: 3 });

      await mod.getPlaylistCount();

      const messages = vi.mocked(logNetwork).mock.calls.map(([message]) => String(message));
      expect(messages.some((m) => m.includes('[REQ] GET https://api.spotify.com/v1/me/playlists?limit=1&offset=0'))).toBe(true);
      expect(messages.some((m) => m.includes('[RESP] 200 GET https://api.spotify.com/v1/me/playlists?limit=1&offset=0'))).toBe(true);
      expect(messages.some((m) => m.includes('Bearer [REDACTED]'))).toBe(true);
      expect(messages.some((m) => m.includes('test-token'))).toBe(false);
    });

    it('sets backoff when receiving 429 with Retry-After header', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({ error: 'rate limited' }, 429, { 'Retry-After': '1' });

      await expect(mod.getPlaylistCount()).rejects.toThrow('Spotify API error: 429');
    });

    it('defaults to 5-second backoff when Retry-After absent', async () => {
      const mod = await freshSpotify();

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({}),
        text: () => Promise.resolve('rate limited'),
      } as Response);

      await expect(mod.getPlaylistCount()).rejects.toThrow('429');
    });

    it('subsequent requests are delayed after 429', async () => {
      const mod = await freshSpotify();
      vi.useFakeTimers();

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '2' }),
        text: () => Promise.resolve('rate limited'),
      } as Response);

      await expect(mod.getPlaylistCount()).rejects.toThrow('429');

      mockFetchResponse({ items: [], next: null, total: 3 });

      const nextCall = mod.getPlaylistCount();
      await vi.advanceTimersByTimeAsync(3000);
      const result = await nextCall;
      expect(result).toBe(3);

      vi.useRealTimers();
    });

    it('deduplicates concurrent GET requests to the same URL', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({ items: [], next: null, total: 5 });

      const [result1, result2] = await Promise.all([
        mod.getPlaylistCount(),
        mod.getPlaylistCount(),
      ]);

      expect(result1).toBe(5);
      expect(result2).toBe(5);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('track-list caching', () => {
    it('getPlaylistTracks returns L1 cache hit without calling fetch', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({
        items: [
          {
            track: {
              id: 'track-1',
              name: 'Cached Song',
              type: 'track',
              artists: [{ name: 'Artist' }],
              album: { name: 'Album', images: [] },
              duration_ms: 200000,
              uri: 'spotify:track:track-1',
            },
          },
        ],
        next: null,
      });

      await mod.getPlaylistTracks('l1-test');
      const fetchCountAfterFirst = vi.mocked(global.fetch).mock.calls.length;

      const tracks = await mod.getPlaylistTracks('l1-test');
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('Cached Song');
      expect(vi.mocked(global.fetch).mock.calls.length).toBe(fetchCountAfterFirst);
    });

    it('falls through to IndexedDB (L2) on L1 miss, promotes to L1', async () => {
      vi.mocked(libraryCache.getTrackList).mockResolvedValueOnce({
        id: 'playlist:l2-test',
        tracks: [
          {
            id: 'l2-track',
            name: 'From IDB',
            artists: 'IDB Artist',
            album: 'IDB Album',
            duration_ms: 200000,
            uri: 'spotify:track:l2-track',
          },
        ],
        timestamp: Date.now() - 1000,
      });

      const mod = await freshSpotify();
      const tracks = await mod.getPlaylistTracks('l2-test');

      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('From IDB');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches from API (L3) on full cache miss, writes both L1 and L2', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({
        items: [
          {
            track: {
              id: 'api-track',
              name: 'From API',
              type: 'track',
              artists: [{ name: 'API Artist' }],
              album: { name: 'API Album', images: [] },
              duration_ms: 300000,
              uri: 'spotify:track:api',
            },
          },
        ],
        next: null,
      });

      const tracks = await mod.getPlaylistTracks('api-test');
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('From API');
      expect(libraryCache.putTrackList).toHaveBeenCalledWith(
        'playlist:api-test',
        expect.arrayContaining([expect.objectContaining({ name: 'From API' })])
      );
    });

    it('getAlbumTracks sorts by track_number', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({
        id: 'album-1',
        name: 'Test Album',
        images: [{ url: 'img.jpg' }],
        tracks: {
          items: [
            { id: 't3', name: 'Track 3', type: 'track', track_number: 3, artists: [{ name: 'A' }], duration_ms: 100000, uri: 'spotify:track:t3' },
            { id: 't1', name: 'Track 1', type: 'track', track_number: 1, artists: [{ name: 'A' }], duration_ms: 100000, uri: 'spotify:track:t1' },
            { id: 't2', name: 'Track 2', type: 'track', track_number: 2, artists: [{ name: 'A' }], duration_ms: 100000, uri: 'spotify:track:t2' },
          ],
        },
      });

      const tracks = await mod.getAlbumTracks('album-1');
      expect(tracks[0].track_number).toBe(1);
      expect(tracks[1].track_number).toBe(2);
      expect(tracks[2].track_number).toBe(3);
    });
  });

  describe('like/save', () => {
    it('checkTrackSaved returns cached value within TTL', async () => {
      const mod = await freshSpotify();

      mockFetchResponse([true]);
      const result1 = await mod.checkTrackSaved('track-123');
      expect(result1).toBe(true);

      const result2 = await mod.checkTrackSaved('track-123');
      expect(result2).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('saveTrack makes PUT request and updates cache', async () => {
      const mod = await freshSpotify();

      mockFetchResponse(undefined, 200);

      await mod.saveTrack('track-456');

      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/tracks');
      expect(options?.method).toBe('PUT');
      const body = JSON.parse(options?.body as string);
      expect(body.ids).toEqual(['track-456']);
    });

    it('unsaveTrack makes DELETE request', async () => {
      const mod = await freshSpotify();

      mockFetchResponse(undefined, 200);

      await mod.unsaveTrack('track-789');

      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/tracks');
      expect(options?.method).toBe('DELETE');
    });

    it('saveTrack rejects on API error', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({ error: 'forbidden' }, 403);

      await expect(mod.saveTrack('track-bad')).rejects.toThrow('Spotify API error: 403');
    });
  });

  describe('data transformation', () => {
    it('skips non-track items in playlist results', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({
        items: [
          {
            track: {
              id: 'track-1', name: 'Valid Track', type: 'track',
              artists: [{ name: 'Artist' }], album: { name: 'Album', images: [] },
              duration_ms: 200000, uri: 'spotify:track:track-1',
            },
          },
          {
            track: {
              id: 'ep-1', name: 'Episode', type: 'episode',
              artists: [], duration_ms: 300000, uri: 'spotify:episode:ep-1',
            },
          },
          { track: null },
        ],
        next: null,
      });

      const tracks = await mod.getPlaylistTracks('playlist-mixed');
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('Valid Track');
    });

    it('skips items without id', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({
        items: [
          {
            track: {
              id: null, name: 'No ID', type: 'track',
              artists: [], duration_ms: 100000, uri: 'spotify:track:null',
            },
          },
        ],
        next: null,
      });

      const tracks = await mod.getPlaylistTracks('playlist-nullid');
      expect(tracks).toHaveLength(0);
    });

    it('formats Unknown Artist for empty artists array', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({
        items: [
          {
            track: {
              id: 'track-noart', name: 'No Artist', type: 'track',
              artists: [], album: { name: 'Album', images: [] },
              duration_ms: 100000, uri: 'spotify:track:noart',
            },
          },
        ],
        next: null,
      });

      const tracks = await mod.getPlaylistTracks('playlist-noartist');
      expect(tracks[0].artists).toBe('Unknown Artist');
    });

    it('builds artistsData with correct Spotify URLs', async () => {
      const mod = await freshSpotify();

      mockFetchResponse({
        items: [
          {
            track: {
              id: 'track-url', name: 'With URLs', type: 'track',
              artists: [
                { name: 'Artist One', id: 'a1', external_urls: { spotify: 'https://open.spotify.com/artist/a1' } },
              ],
              album: { name: 'Album', images: [] },
              duration_ms: 200000, uri: 'spotify:track:url',
            },
          },
        ],
        next: null,
      });

      const tracks = await mod.getPlaylistTracks('playlist-urls');
      expect(tracks[0].artistsData).toEqual([
        { name: 'Artist One', spotifyUrl: 'https://open.spotify.com/artist/a1' },
      ]);
    });
  });
});
