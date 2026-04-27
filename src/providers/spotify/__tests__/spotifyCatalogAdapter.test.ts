import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MediaTrack } from '@/types/domain';

const { mockGetPlaylistTracks, mockGetAlbumTracks, mockGetLikedSongs } = vi.hoisted(() => ({
  mockGetPlaylistTracks: vi.fn(),
  mockGetAlbumTracks: vi.fn(),
  mockGetLikedSongs: vi.fn(),
}));

vi.mock('@/services/spotify', () => ({
  getPlaylistTracks: (...args: unknown[]) => mockGetPlaylistTracks(...args),
  getAlbumTracks: (...args: unknown[]) => mockGetAlbumTracks(...args),
  getLikedSongs: (...args: unknown[]) => mockGetLikedSongs(...args),
  getLikedSongsCount: vi.fn().mockResolvedValue(0),
  checkTrackSaved: vi.fn().mockResolvedValue(false),
  saveTrack: vi.fn().mockResolvedValue(undefined),
  unsaveTrack: vi.fn().mockResolvedValue(undefined),
  checkAlbumSaved: vi.fn().mockResolvedValue(false),
  saveAlbum: vi.fn().mockResolvedValue(undefined),
  unsaveAlbum: vi.fn().mockResolvedValue(undefined),
  unfollowPlaylist: vi.fn().mockResolvedValue(undefined),
  getLargestImage: vi.fn().mockReturnValue(undefined),
  searchTrack: vi.fn().mockResolvedValue(null),
  getUserLibraryInterleaved: vi.fn().mockResolvedValue(undefined),
}));

import { SpotifyCatalogAdapter } from '@/providers/spotify/spotifyCatalogAdapter';

const TRACK: MediaTrack = {
  id: 't1',
  provider: 'spotify',
  playbackRef: { provider: 'spotify', ref: 'spotify:track:t1' },
  name: 'Track',
  artists: 'Artist',
  album: 'Album',
  durationMs: 180000,
};

describe('SpotifyCatalogAdapter.listTracks', () => {
  let adapter: SpotifyCatalogAdapter;

  beforeEach(() => {
    adapter = new SpotifyCatalogAdapter();
    vi.clearAllMocks();
    mockGetPlaylistTracks.mockResolvedValue([TRACK]);
    mockGetAlbumTracks.mockResolvedValue([TRACK]);
    mockGetLikedSongs.mockResolvedValue([TRACK]);
  });

  it('routes playlist kind to getPlaylistTracks', async () => {
    // #given
    const ref = { provider: 'spotify' as const, kind: 'playlist' as const, id: 'pl-abc' };

    // #when
    const result = await adapter.listTracks(ref);

    // #then
    expect(mockGetPlaylistTracks).toHaveBeenCalledWith('pl-abc');
    expect(mockGetAlbumTracks).not.toHaveBeenCalled();
    expect(result).toEqual([TRACK]);
  });

  it('routes album kind with raw id to getAlbumTracks', async () => {
    // #given — raw id as supplied by the engine path (no "album:" prefix)
    const ref = { provider: 'spotify' as const, kind: 'album' as const, id: '1KNUCVXgIxKUGiuEB8eG0i' };

    // #when
    const result = await adapter.listTracks(ref);

    // #then
    expect(mockGetAlbumTracks).toHaveBeenCalledWith('1KNUCVXgIxKUGiuEB8eG0i');
    expect(mockGetPlaylistTracks).not.toHaveBeenCalled();
    expect(result).toEqual([TRACK]);
  });

  it('routes album kind with prefixed id to getAlbumTracks (strips prefix)', async () => {
    // #given — prefixed id as supplied by the catalog-adapter path
    const ref = { provider: 'spotify' as const, kind: 'album' as const, id: 'album:1KNUCVXgIxKUGiuEB8eG0i' };

    // #when
    const result = await adapter.listTracks(ref);

    // #then
    expect(mockGetAlbumTracks).toHaveBeenCalledWith('1KNUCVXgIxKUGiuEB8eG0i');
    expect(mockGetPlaylistTracks).not.toHaveBeenCalled();
    expect(result).toEqual([TRACK]);
  });

  it('routes liked kind to getLikedSongs', async () => {
    // #given
    const ref = { provider: 'spotify' as const, kind: 'liked' as const, id: '' };

    // #when
    const result = await adapter.listTracks(ref);

    // #then
    expect(mockGetLikedSongs).toHaveBeenCalled();
    expect(mockGetPlaylistTracks).not.toHaveBeenCalled();
    expect(result).toEqual([TRACK]);
  });

  it('returns [] for non-spotify provider without calling any API', async () => {
    // #given
    const ref = { provider: 'dropbox' as const, kind: 'playlist' as const, id: 'pl-1' };

    // #when
    const result = await adapter.listTracks(ref);

    // #then
    expect(result).toEqual([]);
    expect(mockGetPlaylistTracks).not.toHaveBeenCalled();
    expect(mockGetAlbumTracks).not.toHaveBeenCalled();
  });

  it('returns [] for unknown kind without calling any API', async () => {
    // #given
    const ref = { provider: 'spotify' as const, kind: 'folder' as const, id: 'x' };

    // #when
    const result = await adapter.listTracks(ref);

    // #then
    expect(result).toEqual([]);
    expect(mockGetPlaylistTracks).not.toHaveBeenCalled();
    expect(mockGetAlbumTracks).not.toHaveBeenCalled();
  });
});
