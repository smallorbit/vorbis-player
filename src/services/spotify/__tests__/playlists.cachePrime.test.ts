import { describe, it, expect, vi, beforeEach } from 'vitest';
import { albumSavedCache } from '../cache';

vi.mock('../auth', () => ({
  spotifyAuth: {
    ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
  },
}));

const mockSpotifyApiRequest = vi.fn();
vi.mock('../api', () => ({
  spotifyApiRequest: (...args: unknown[]) => mockSpotifyApiRequest(...args),
  fetchAllPaginated: vi.fn(),
}));

vi.mock('@/services/cache/libraryCache', () => ({
  getTrackList: vi.fn().mockResolvedValue(null),
  putTrackList: vi.fn().mockResolvedValue(undefined),
}));

import { getUserLibraryInterleaved } from '../playlists';
import { checkAlbumSaved } from '../albums';

describe('getUserLibraryInterleaved — albumSavedCache priming', () => {
  beforeEach(() => {
    albumSavedCache.clear();
    mockSpotifyApiRequest.mockReset();
  });

  it('checkAlbumSaved returns true from cache without a network call after getUserLibraryInterleaved', async () => {
    // #given
    const albumId = 'album-abc';

    mockSpotifyApiRequest.mockImplementation((url: string) => {
      if (url.includes('me/playlists')) {
        return Promise.resolve({ items: [], next: null, total: 0 });
      }
      if (url.includes('me/albums')) {
        return Promise.resolve({
          items: [
            {
              added_at: '2024-01-01T00:00:00Z',
              album: {
                id: albumId,
                name: 'Test Album',
                artists: [{ name: 'Test Artist' }],
                images: [],
                release_date: '2024-01-01',
                total_tracks: 10,
                uri: `spotify:album:${albumId}`,
              },
            },
          ],
          next: null,
          total: 1,
        });
      }
      return Promise.resolve({});
    });

    // #when
    await getUserLibraryInterleaved(
      () => {},
      () => {},
    );

    const callCountAfterInterleaved = mockSpotifyApiRequest.mock.calls.length;

    const isSaved = await checkAlbumSaved(albumId);

    // #then
    expect(isSaved).toBe(true);
    expect(mockSpotifyApiRequest.mock.calls.length).toBe(callCountAfterInterleaved);
  });
});
