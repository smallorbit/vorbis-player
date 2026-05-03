import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth', () => ({
  spotifyAuth: {
    ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
  },
}));

vi.mock('@/services/cache/libraryCache', () => ({
  getTrackList: vi.fn().mockResolvedValue(null),
  putTrackList: vi.fn().mockResolvedValue(undefined),
}));

import { getAllUserPlaylists } from '../playlists';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getAllUserPlaylists — fallback added_at stamping across pages', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('assigns unique fallback added_at stamps that span page boundaries', async () => {
    // #given two pages of two playlists each, none carrying added_at
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: 'p0', name: 'P0' },
            { id: 'p1', name: 'P1' },
          ],
          next: 'https://api.spotify.com/v1/me/playlists?limit=50&offset=50',
          total: 4,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: 'p2', name: 'P2' },
            { id: 'p3', name: 'P3' },
          ],
          next: null,
          total: 4,
        }),
      );

    // #when
    const playlists = await getAllUserPlaylists();

    // #then — four playlists fetched in order
    expect(playlists.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3']);

    // #then — every fallback added_at is set, all unique (closure counter survived page boundary)
    const stamps = playlists.map((p) => p.added_at) as string[];
    expect(new Set(stamps).size).toBe(4);

    // #then — each subsequent stamp is ~60_000ms earlier than the previous
    // (uses Date.now() at transform time so absolute spacing has small jitter)
    const times = stamps.map((s) => new Date(s).getTime());
    for (let i = 0; i < times.length - 1; i++) {
      const delta = times[i] - times[i + 1];
      expect(delta).toBeGreaterThan(59_000);
      expect(delta).toBeLessThan(61_000);
    }
  });

  it('preserves explicit added_at when present and applies fallback only when absent', async () => {
    // #given an item with explicit added_at and one without
    const explicit = '2024-06-15T12:00:00.000Z';
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: 'p0', name: 'P0', added_at: explicit },
          { id: 'p1', name: 'P1' },
        ],
        next: null,
        total: 2,
      }),
    );

    // #when
    const playlists = await getAllUserPlaylists();

    // #then — explicit stamp preserved
    expect(playlists[0].added_at).toBe(explicit);
    // #then — fallback applied to second item
    expect(playlists[1].added_at).not.toBe(explicit);
    expect(typeof playlists[1].added_at).toBe('string');
  });
});
