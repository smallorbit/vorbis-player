import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSimilarTracks,
  getSimilarArtists,
  getArtistTopTracks,
  getAlbumTracks,
  isLastFmConfigured,
  _resetRateLimiter,
} from '../lastfm';

// Mock import.meta.env
vi.stubEnv('VITE_LASTFM_API_KEY', 'test-api-key');

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

function errorResponse(status: number) {
  return { ok: false, status, statusText: 'Error', json: () => Promise.resolve({}) };
}

beforeEach(() => {
  mockFetch.mockReset();
  _resetRateLimiter();
});

describe('getSimilarTracks', () => {
  it('parses a valid response with multiple tracks', async () => {
    // #given
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        similartracks: {
          track: [
            {
              name: 'Fake Plastic Trees',
              artist: { name: 'Radiohead', mbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711' },
              mbid: 'abc123',
              match: '0.91',
            },
            {
              name: 'Paranoid Android',
              artist: { name: 'Radiohead', mbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711' },
              mbid: '',
              match: '0.87',
            },
          ],
        },
      }),
    );

    // #when
    const result = await getSimilarTracks('Radiohead', 'Creep', 50);

    // #then
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'Fake Plastic Trees',
      artist: 'Radiohead',
      artistMbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711',
      trackMbid: 'abc123',
      matchScore: 0.91,
    });
    expect(result[1].trackMbid).toBeNull(); // empty string → null
  });

  it('returns empty array when no similar tracks found', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ similartracks: { track: [] } }),
    );

    const result = await getSimilarTracks('Unknown', 'Unknown Track');
    expect(result).toEqual([]);
  });

  it('returns empty array for missing similartracks container', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    const result = await getSimilarTracks('X', 'Y');
    expect(result).toEqual([]);
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));
    await expect(getSimilarTracks('A', 'B')).rejects.toThrow('Last.fm API error: 500');
  });

  it('throws on Last.fm logical error', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 6, message: 'Track not found' }),
    );
    await expect(getSimilarTracks('A', 'B')).rejects.toThrow('Last.fm error 6: Track not found');
  });
});

describe('getSimilarArtists', () => {
  it('parses a valid response', async () => {
    // #given
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        similarartists: {
          artist: [
            { name: 'Muse', mbid: 'muse-mbid', match: '0.75' },
            { name: 'Coldplay', mbid: '', match: '0.60' },
          ],
        },
      }),
    );

    // #when
    const result = await getSimilarArtists('Radiohead', 20);

    // #then
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Muse', mbid: 'muse-mbid', matchScore: 0.75 });
    expect(result[1].mbid).toBeNull();
  });

  it('returns empty array for missing container', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    const result = await getSimilarArtists('X');
    expect(result).toEqual([]);
  });
});

describe('getArtistTopTracks', () => {
  it('parses a valid response and sets matchScore to 1.0', async () => {
    // #given
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        toptracks: {
          track: [
            {
              name: 'Creep',
              artist: { name: 'Radiohead', mbid: 'rh-mbid' },
              mbid: 'creep-mbid',
              match: '0',
            },
          ],
        },
      }),
    );

    // #when
    const result = await getArtistTopTracks('Radiohead', 10);

    // #then
    expect(result).toHaveLength(1);
    expect(result[0].matchScore).toBe(1.0);
    expect(result[0].name).toBe('Creep');
  });
});

describe('getAlbumTracks', () => {
  it('parses album track list', async () => {
    // #given
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        album: {
          tracks: {
            track: [
              { name: 'Everything in Its Right Place', artist: { name: 'Radiohead' } },
              { name: 'Kid A', artist: { name: 'Radiohead' } },
            ],
          },
        },
      }),
    );

    // #when
    const result = await getAlbumTracks('Radiohead', 'Kid A');

    // #then
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Everything in Its Right Place', artist: 'Radiohead' });
  });

  it('returns empty array for missing album data', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({}));
    const result = await getAlbumTracks('X', 'Y');
    expect(result).toEqual([]);
  });
});

describe('isLastFmConfigured', () => {
  it('returns true when API key is set', () => {
    expect(isLastFmConfigured()).toBe(true);
  });
});

describe('URL construction', () => {
  it('includes correct query parameters', async () => {
    // #given
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ similartracks: { track: [] } }),
    );

    // #when
    await getSimilarTracks('Radiohead', 'Creep', 100);

    // #then
    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('method')).toBe('track.getsimilar');
    expect(calledUrl.searchParams.get('artist')).toBe('Radiohead');
    expect(calledUrl.searchParams.get('track')).toBe('Creep');
    expect(calledUrl.searchParams.get('limit')).toBe('100');
    expect(calledUrl.searchParams.get('api_key')).toBe('test-api-key');
    expect(calledUrl.searchParams.get('format')).toBe('json');
    expect(calledUrl.searchParams.get('autocorrect')).toBe('1');
  });
});
