import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppleMusicCatalogAdapter } from '../appleMusicCatalogAdapter';
import { appleMusicService } from '../appleMusicService';

vi.mock('../appleMusicService', () => ({
  appleMusicService: {
    ensureLoaded: vi.fn(),
    getInstance: vi.fn(),
  },
}));

describe('AppleMusicCatalogAdapter', () => {
  let adapter: AppleMusicCatalogAdapter;
  let mockMusic: ReturnType<typeof vi.fn>;
  let mockInstance: { api: { music: ReturnType<typeof vi.fn> }; musicUserToken: string; developerToken: string };

  beforeEach(() => {
    mockMusic = vi.fn();
    mockInstance = {
      api: { music: mockMusic },
      musicUserToken: 'user-token',
      developerToken: 'dev-token',
    };
    vi.mocked(appleMusicService.ensureLoaded).mockResolvedValue(mockInstance as never);
    adapter = new AppleMusicCatalogAdapter();
    vi.clearAllMocks();
    vi.mocked(appleMusicService.ensureLoaded).mockResolvedValue(mockInstance as never);
  });

  it('has providerId "apple-music"', () => {
    expect(adapter.providerId).toBe('apple-music');
  });

  it('listCollections fetches playlists and albums', async () => {
    mockMusic
      // First call: playlists
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'p.playlist1',
              type: 'library-playlists',
              attributes: { name: 'My Playlist', trackCount: 10 },
            },
          ],
        },
      })
      // Second call: albums
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'l.album1',
              type: 'library-albums',
              attributes: { name: 'Cool Album', trackCount: 12 },
            },
          ],
        },
      });

    const collections = await adapter.listCollections();
    expect(collections).toHaveLength(2);
    expect(collections[0]).toMatchObject({
      id: 'p.playlist1',
      provider: 'apple-music',
      kind: 'playlist',
      name: 'My Playlist',
    });
    expect(collections[1]).toMatchObject({
      id: 'l.album1',
      provider: 'apple-music',
      kind: 'album',
      name: 'Cool Album',
    });
  });

  it('listTracks maps Apple Music tracks to MediaTrack', async () => {
    mockMusic.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'i.track1',
            type: 'library-songs',
            attributes: {
              name: 'Song One',
              artistName: 'Artist A',
              albumName: 'Album X',
              durationInMillis: 240000,
              trackNumber: 1,
              artwork: { url: 'https://example.com/{w}x{h}.jpg' },
              playParams: { catalogId: 'cat.123' },
              url: 'https://music.apple.com/song/cat.123',
            },
          },
        ],
      },
    });

    const tracks = await adapter.listTracks({
      provider: 'apple-music',
      kind: 'playlist',
      id: 'p.playlist1',
    });

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      id: 'i.track1',
      provider: 'apple-music',
      name: 'Song One',
      artists: 'Artist A',
      album: 'Album X',
      durationMs: 240000,
      trackNumber: 1,
      image: 'https://example.com/300x300.jpg',
      externalUrl: 'https://music.apple.com/song/cat.123',
      playbackRef: { provider: 'apple-music', ref: 'cat.123' },
    });
  });

  it('listTracks returns empty for wrong provider', async () => {
    const tracks = await adapter.listTracks({
      provider: 'spotify',
      kind: 'playlist',
      id: 'xxx',
    });
    expect(tracks).toEqual([]);
  });

  it('getLikedCount fetches ratings count', async () => {
    mockMusic.mockResolvedValueOnce({
      data: { data: [], meta: { total: 42 } },
    });

    const count = await adapter.getLikedCount();
    expect(count).toBe(42);
  });

  it('isTrackSaved returns true when rating exists', async () => {
    mockMusic.mockResolvedValueOnce({
      data: { data: [{ id: 'track1', attributes: { value: 1 } }] },
    });

    const saved = await adapter.isTrackSaved('track1');
    expect(saved).toBe(true);
  });

  it('isTrackSaved returns false on 404/error', async () => {
    mockMusic.mockRejectedValueOnce(new Error('Not found'));

    const saved = await adapter.isTrackSaved('nonexistent');
    expect(saved).toBe(false);
  });

  it('setTrackSaved calls PUT for saving', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );

    await adapter.setTrackSaved('track1', true);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.music.apple.com/v1/me/ratings/library-songs/track1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ type: 'rating', attributes: { value: 1 } }),
      }),
    );

    fetchSpy.mockRestore();
  });

  it('setTrackSaved calls DELETE for unsaving', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );

    await adapter.setTrackSaved('track1', false);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.music.apple.com/v1/me/ratings/library-songs/track1',
      expect.objectContaining({ method: 'DELETE' }),
    );

    fetchSpy.mockRestore();
  });
});
