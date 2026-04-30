import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeTrack } from '@/test/fixtures';
import type { MediaTrack } from '@/types/domain';

vi.mock('@/providers/mock/shouldUseMockProvider', () => ({
  shouldUseMockProvider: vi.fn().mockReturnValue(false),
}));

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getIsReady: vi.fn().mockReturnValue(true),
    getDeviceId: vi.fn().mockReturnValue('device-1'),
    transferPlaybackToDevice: vi.fn().mockResolvedValue(undefined),
    ensureDeviceIsActive: vi.fn().mockResolvedValue(true),
    playTrack: vi.fn().mockResolvedValue(undefined),
    playContext: vi.fn().mockResolvedValue(undefined),
    getCurrentState: vi.fn().mockResolvedValue(null),
    resume: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/spotify', () => ({
  getPlaylistTracks: vi.fn(),
  getAlbumTracks: vi.fn(),
  getLikedSongs: vi.fn(),
  spotifyAuth: {
    redirectToAuth: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(true),
    ensureValidToken: vi.fn().mockResolvedValue('token'),
  },
}));

import { useSpotifyPlaylistManager as usePlaylistManager } from '@/providers/spotify/useSpotifyPlaylistManager';
import { getPlaylistTracks, getAlbumTracks, getLikedSongs, spotifyAuth } from '@/services/spotify';
import { shouldUseMockProvider } from '@/providers/mock/shouldUseMockProvider';

describe('usePlaylistManager', () => {
  const setError = vi.fn();
  const setIsLoading = vi.fn();
  const setSelectedPlaylistId = vi.fn();
  const setTracks = vi.fn();
  const setOriginalTracks = vi.fn();
  const setCurrentTrackIndex = vi.fn();

  const defaultProps = {
    trackOps: { setError, setIsLoading, setSelectedPlaylistId, setTracks, setOriginalTracks, setCurrentTrackIndex },
    shuffleEnabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlaylistTracks).mockResolvedValue([
      makeTrack({ id: 't1', name: 'Track 1' }),
      makeTrack({ id: 't2', name: 'Track 2' }),
    ]);
    vi.mocked(getAlbumTracks).mockResolvedValue([
      makeTrack({ id: 'at1', name: 'Album Track 1' }),
    ]);
    vi.mocked(getLikedSongs).mockResolvedValue([
      makeTrack({ id: 'lt1', name: 'Liked Track 1' }),
    ]);
  });

  it('calls getPlaylistTracks for regular playlist IDs', async () => {
    // #given
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when - select a regular playlist
    await act(async () => {
      await result.current.handlePlaylistSelect('playlist-123');
    });

    // #then
    expect(getPlaylistTracks).toHaveBeenCalledWith('playlist-123');
    expect(setTracks).toHaveBeenCalled();
  });

  it('calls getLikedSongs for LIKED_SONGS_ID', async () => {
    // #given
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when - select liked songs
    await act(async () => {
      await result.current.handlePlaylistSelect('liked-songs');
    });

    // #then
    expect(getLikedSongs).toHaveBeenCalled();
  });

  it('calls getAlbumTracks for album IDs (album: prefix)', async () => {
    // #given
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when - select an album using album: prefix
    await act(async () => {
      await result.current.handlePlaylistSelect('album:album-456');
    });

    // #then
    expect(getAlbumTracks).toHaveBeenCalledWith('album-456');
  });

  it('sets error when playlist returns empty tracks', async () => {
    // #given - mock empty liked songs
    vi.mocked(getLikedSongs).mockResolvedValue([]);

    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when - select empty playlist
    await act(async () => {
      await result.current.handlePlaylistSelect('liked-songs');
    });

    // #then
    expect(setError).toHaveBeenCalledWith(
      expect.stringContaining('No liked songs')
    );
  });

  it('applies shuffle when shuffleEnabled=true', async () => {
    // #given - create 20 tracks and mock shuffle enabled
    const tracks = Array.from({ length: 20 }, (_, i) =>
      makeTrack({ id: `t${i}`, name: `Track ${i}` })
    );
    vi.mocked(getPlaylistTracks).mockResolvedValue(tracks);

    const { result } = renderHook(() =>
      usePlaylistManager({ ...defaultProps, shuffleEnabled: true })
    );

    // #when - select playlist with shuffle enabled
    await act(async () => {
      await result.current.handlePlaylistSelect('playlist-shuffle');
    });

    // #then - original order preserved, shuffled order applied
    expect(setOriginalTracks).toHaveBeenCalledWith(tracks);

    const shuffledTracks = setTracks.mock.calls[0][0] as typeof tracks;
    expect(shuffledTracks).toHaveLength(20);
  });

  it('calls redirectToAuth on auth error', async () => {
    // #given - mock auth failure
    const { spotifyPlayer } = await import('@/services/spotifyPlayer');
    const { AuthExpiredError } = await import('@/providers/errors');
    vi.mocked(spotifyPlayer.initialize).mockRejectedValueOnce(
      new AuthExpiredError('spotify')
    );

    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when - select playlist while auth fails
    await act(async () => {
      await result.current.handlePlaylistSelect('playlist-auth-fail');
    });

    // #then
    expect(spotifyAuth.redirectToAuth).toHaveBeenCalled();
  });

  it('sets isLoading false in finally block on error', async () => {
    // #given - mock generic error
    const { spotifyPlayer } = await import('@/services/spotifyPlayer');
    vi.mocked(spotifyPlayer.initialize).mockRejectedValueOnce(new Error('Some error'));

    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    // #when - select playlist while error occurs
    await act(async () => {
      await result.current.handlePlaylistSelect('playlist-error');
    });

    // #then
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
  });

  describe('mock provider short-circuit', () => {
    it('returns [] without calling spotifyPlayer.initialize when mock provider is active', async () => {
      // #given — mock provider is active
      vi.mocked(shouldUseMockProvider).mockReturnValue(true);
      const { spotifyPlayer } = await import('@/services/spotifyPlayer');
      const { result } = renderHook(() => usePlaylistManager(defaultProps));

      // #when
      let tracks: MediaTrack[] = [];
      await act(async () => {
        tracks = await result.current.handlePlaylistSelect('playlist-123');
      });

      // #then
      expect(tracks).toEqual([]);
      expect(spotifyPlayer.initialize).not.toHaveBeenCalled();
    });
  });
});
