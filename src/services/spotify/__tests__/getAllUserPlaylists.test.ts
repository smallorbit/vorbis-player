import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth', () => ({
  spotifyAuth: {
    ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
  },
}));

vi.mock('@/services/cache/libraryCache', () => ({
  getTrackList: vi.fn().mockResolvedValue(undefined),
  putTrackList: vi.fn().mockResolvedValue(undefined),
}));

import { getAllUserPlaylists } from '../playlists';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('getAllUserPlaylists — pagination and domain mapping', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches every page and returns collections in API order', async () => {
    // #given two pages of two playlists each
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

    // #then — four playlists fetched in order, spanning the page boundary
    expect(playlists.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // #then — every record is a neutral spotify playlist collection
    for (const playlist of playlists) {
      expect(playlist.provider).toBe('spotify');
      expect(playlist.kind).toBe('playlist');
    }
  });

  it('maps wire fields to the neutral MediaCollection shape', async () => {
    // #given a fully populated wire playlist
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'p1',
            name: 'Chill',
            description: 'late night mix',
            images: [
              { url: 'small.jpg', width: 64, height: 64 },
              { url: 'big.jpg', width: 640, height: 640 },
            ],
            tracks: { total: 42 },
            owner: { display_name: 'Alice' },
            snapshot_id: 'snap-1',
          },
        ],
        next: null,
        total: 1,
      }),
    );

    // #when
    const playlists = await getAllUserPlaylists();

    // #then — wire shape converted once at the boundary (snapshot_id → revision,
    // largest image → imageUrl, tracks.total → trackCount)
    expect(playlists).toEqual([
      {
        id: 'p1',
        provider: 'spotify',
        kind: 'playlist',
        name: 'Chill',
        description: 'late night mix',
        imageUrl: 'big.jpg',
        trackCount: 42,
        ownerName: 'Alice',
        revision: 'snap-1',
        genres: [],
      },
    ]);
  });

  it('omits optional fields that the wire payload does not provide', async () => {
    // #given a minimal wire playlist (no description, images, owner, or snapshot_id)
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [{ id: 'p1', name: 'Bare', description: null, images: [], tracks: null, owner: null }],
        next: null,
        total: 1,
      }),
    );

    // #when
    const playlists = await getAllUserPlaylists();

    // #then — optional fields are absent rather than null/empty
    expect(playlists).toEqual([
      {
        id: 'p1',
        provider: 'spotify',
        kind: 'playlist',
        name: 'Bare',
        trackCount: 0,
        genres: [],
      },
    ]);
  });
});
