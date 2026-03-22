import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeTrack } from '@/test/fixtures';

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

describe('usePlaylistManager', () => {
  const setError = vi.fn();
  const setIsLoading = vi.fn();
  const setSelectedPlaylistId = vi.fn();
  const setTracks = vi.fn();
  const setOriginalTracks = vi.fn();
  const setCurrentTrackIndex = vi.fn();

  const defaultProps = {
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
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
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    await act(async () => {
      await result.current.handlePlaylistSelect('playlist-123');
    });

    expect(getPlaylistTracks).toHaveBeenCalledWith('playlist-123');
    expect(setTracks).toHaveBeenCalled();
  });

  it('calls getLikedSongs for LIKED_SONGS_ID', async () => {
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    await act(async () => {
      await result.current.handlePlaylistSelect('liked-songs');
    });

    expect(getLikedSongs).toHaveBeenCalled();
  });

  it('calls getAlbumTracks for album IDs (album: prefix)', async () => {
    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    await act(async () => {
      await result.current.handlePlaylistSelect('album:album-456');
    });

    expect(getAlbumTracks).toHaveBeenCalledWith('album-456');
  });

  it('sets error when playlist returns empty tracks', async () => {
    vi.mocked(getLikedSongs).mockResolvedValue([]);

    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    await act(async () => {
      await result.current.handlePlaylistSelect('liked-songs');
    });

    expect(setError).toHaveBeenCalledWith(
      expect.stringContaining('No liked songs')
    );
  });

  it('applies shuffle when shuffleEnabled=true', async () => {
    const tracks = Array.from({ length: 20 }, (_, i) =>
      makeTrack({ id: `t${i}`, name: `Track ${i}` })
    );
    vi.mocked(getPlaylistTracks).mockResolvedValue(tracks);

    const { result } = renderHook(() =>
      usePlaylistManager({ ...defaultProps, shuffleEnabled: true })
    );

    await act(async () => {
      await result.current.handlePlaylistSelect('playlist-shuffle');
    });

    // setOriginalTracks should have the original order
    expect(setOriginalTracks).toHaveBeenCalledWith(tracks);

    // setTracks should have been called (order may differ)
    const shuffledTracks = setTracks.mock.calls[0][0] as typeof tracks;
    expect(shuffledTracks).toHaveLength(20);
  });

  it('calls redirectToAuth on auth error', async () => {
    const { spotifyPlayer } = await import('@/services/spotifyPlayer');
    vi.mocked(spotifyPlayer.initialize).mockRejectedValueOnce(
      new Error('User must be authenticated before initializing player')
    );

    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    await act(async () => {
      await result.current.handlePlaylistSelect('playlist-auth-fail');
    });

    expect(spotifyAuth.redirectToAuth).toHaveBeenCalled();
  });

  it('sets isLoading false in finally block on error', async () => {
    const { spotifyPlayer } = await import('@/services/spotifyPlayer');
    vi.mocked(spotifyPlayer.initialize).mockRejectedValueOnce(new Error('Some error'));

    const { result } = renderHook(() => usePlaylistManager(defaultProps));

    await act(async () => {
      await result.current.handlePlaylistSelect('playlist-error');
    });

    expect(setIsLoading).toHaveBeenLastCalledWith(false);
  });
});
