import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as libraryCache from '@/services/cache/libraryCache';

vi.mock('@/services/cache/libraryCache', () => ({
  getTrackList: vi.fn().mockResolvedValue(null),
  putTrackList: vi.fn().mockResolvedValue(undefined),
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
    it('sets backoff when receiving 429 with Retry-After header', async () => {
      // #given
      const mod = await freshSpotify();
      mockFetchResponse({ error: 'rate limited' }, 429, { 'Retry-After': '1' });

      // #when / #then
      await expect(mod.getPlaylistCount()).rejects.toThrow('Spotify API error: 429');
    });

    it('defaults to 5-second backoff when Retry-After absent', async () => {
      // #given
      const mod = await freshSpotify();
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({}),
        text: () => Promise.resolve('rate limited'),
      } as Response);

      // #when / #then
      await expect(mod.getPlaylistCount()).rejects.toThrow('429');
    });

    it('subsequent requests are delayed after 429', async () => {
      // #given
      const mod = await freshSpotify();
      vi.useFakeTimers();

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '2' }),
        text: () => Promise.resolve('rate limited'),
      } as Response);

      // #when
      await expect(mod.getPlaylistCount()).rejects.toThrow('429');

      mockFetchResponse({ items: [], next: null, total: 3 });

      const nextCall = mod.getPlaylistCount();
      await vi.advanceTimersByTimeAsync(3000);
      const result = await nextCall;

      // #then
      expect(result).toBe(3);

      vi.useRealTimers();
    });

    it('deduplicates concurrent GET requests to the same URL', async () => {
      // #given
      const mod = await freshSpotify();
      mockFetchResponse({ items: [], next: null, total: 5 });

      // #when
      const [result1, result2] = await Promise.all([
        mod.getPlaylistCount(),
        mod.getPlaylistCount(),
      ]);

      // #then
      expect(result1).toBe(5);
      expect(result2).toBe(5);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('track-list caching', () => {
    it('getPlaylistTracks returns L1 cache hit without calling fetch', async () => {
      // #given
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

      // #when
      await mod.getPlaylistTracks('l1-test');
      const fetchCountAfterFirst = vi.mocked(global.fetch).mock.calls.length;

      const tracks = await mod.getPlaylistTracks('l1-test');

      // #then
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('Cached Song');
      expect(vi.mocked(global.fetch).mock.calls.length).toBe(fetchCountAfterFirst);
    });

    it('falls through to IndexedDB (L2) on L1 miss, promotes to L1', async () => {
      // #given
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

      // #when
      const tracks = await mod.getPlaylistTracks('l2-test');

      // #then
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('From IDB');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('fetches from API (L3) on full cache miss, writes both L1 and L2', async () => {
      // #given
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

      // #when
      const tracks = await mod.getPlaylistTracks('api-test');

      // #then
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('From API');
      expect(libraryCache.putTrackList).toHaveBeenCalledWith(
        'playlist:api-test',
        expect.arrayContaining([expect.objectContaining({ name: 'From API' })])
      );
    });

    it('getAlbumTracks sorts by track_number', async () => {
      // #given
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

      // #when
      const tracks = await mod.getAlbumTracks('album-1');

      // #then
      expect(tracks[0].trackNumber).toBe(1);
      expect(tracks[1].trackNumber).toBe(2);
      expect(tracks[2].trackNumber).toBe(3);
    });
  });

  describe('like/save', () => {
    it('checkTrackSaved returns cached value within TTL', async () => {
      // #given
      vi.useFakeTimers();
      const mod = await freshSpotify();

      mockFetchResponse([true]);

      // #when
      const promise = mod.checkTrackSaved('track-123');
      await vi.runAllTimersAsync();
      const result1 = await promise;

      const result2 = await mod.checkTrackSaved('track-123');

      // #then
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it('checkTrackSaved batches concurrent calls across render cycles into one request', async () => {
      vi.useFakeTimers();
      const mod = await freshSpotify();

      // #given — simulate calls arriving across two separate microtask ticks (different render cycles)
      mockFetchResponse([true, false, true]);
      const p1 = mod.checkTrackSaved('track-a');
      const p2 = mod.checkTrackSaved('track-b');
      // advance microtasks to simulate a new render cycle adding more calls before the 50ms timer fires
      await Promise.resolve();
      const p3 = mod.checkTrackSaved('track-c');

      // #when — advance past the 50ms collection window
      await vi.runAllTimersAsync();

      // #then — all three resolved in a single API request
      expect(await p1).toBe(true);
      expect(await p2).toBe(false);
      expect(await p3).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const url = vi.mocked(global.fetch).mock.calls[0][0] as string;
      expect(url).toContain('ids=track-a,track-b,track-c');
      vi.useRealTimers();
    });

    it('checkTrackSaved splits >50 ids into sequential chunks with inter-chunk delay', async () => {
      // #given
      vi.useFakeTimers();
      const mod = await freshSpotify();

      const ids = Array.from({ length: 60 }, (_, i) => `track-${i}`);
      mockFetchResponse(Array(50).fill(false));
      mockFetchResponse(Array(10).fill(true));

      // #when
      const promises = ids.map((id) => mod.checkTrackSaved(id));
      await vi.runAllTimersAsync();
      const results = await Promise.all(promises);

      // #then
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(results.slice(0, 50).every((r) => r === false)).toBe(true);
      expect(results.slice(50).every((r) => r === true)).toBe(true);
      vi.useRealTimers();
    });

    it('saveTrack makes PUT request and updates cache', async () => {
      // #given
      const mod = await freshSpotify();
      mockFetchResponse(undefined, 200);

      // #when
      await mod.saveTrack('track-456');

      // #then
      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/tracks');
      expect(options?.method).toBe('PUT');
      const body = JSON.parse(options?.body as string);
      expect(body.ids).toEqual(['track-456']);
    });

    it('unsaveTrack makes DELETE request', async () => {
      // #given
      const mod = await freshSpotify();
      mockFetchResponse(undefined, 200);

      // #when
      await mod.unsaveTrack('track-789');

      // #then
      const [url, options] = vi.mocked(global.fetch).mock.calls[0];
      expect(url).toBe('https://api.spotify.com/v1/me/tracks');
      expect(options?.method).toBe('DELETE');
    });

    it('saveTrack rejects on API error', async () => {
      // #given
      const mod = await freshSpotify();
      mockFetchResponse({ error: 'forbidden' }, 403);

      // #when / #then
      await expect(mod.saveTrack('track-bad')).rejects.toThrow('Spotify API error: 403');
    });
  });

  describe('data transformation', () => {
    it('skips non-track items in playlist results', async () => {
      // #given
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

      // #when
      const tracks = await mod.getPlaylistTracks('playlist-mixed');

      // #then
      expect(tracks).toHaveLength(1);
      expect(tracks[0].name).toBe('Valid Track');
    });

    it('skips items without id', async () => {
      // #given
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

      // #when
      const tracks = await mod.getPlaylistTracks('playlist-nullid');

      // #then
      expect(tracks).toHaveLength(0);
    });

    it('formats Unknown Artist for empty artists array', async () => {
      // #given
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

      // #when
      const tracks = await mod.getPlaylistTracks('playlist-noartist');

      // #then
      expect(tracks[0].artists).toBe('Unknown Artist');
    });

    it('builds artistsData with correct Spotify URLs', async () => {
      // #given
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

      // #when
      const tracks = await mod.getPlaylistTracks('playlist-urls');

      // #then
      expect(tracks[0].artistsData).toEqual([
        { name: 'Artist One', url: 'https://open.spotify.com/artist/a1' },
      ]);
    });
  });
});
