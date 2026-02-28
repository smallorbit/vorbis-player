import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeTrack } from '@/test/fixtures';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    playTrack: vi.fn().mockResolvedValue(undefined),
    getCurrentState: vi.fn().mockResolvedValue(null),
    resume: vi.fn().mockResolvedValue(undefined),
    transferPlaybackToDevice: vi.fn().mockResolvedValue(undefined),
    ensureDeviceIsActive: vi.fn().mockResolvedValue(true),
    getDeviceId: vi.fn().mockReturnValue('device-1'),
  },
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    ensureValidToken: vi.fn().mockResolvedValue('token'),
  },
}));

import { useSpotifyPlayback } from '../useSpotifyPlayback';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { spotifyAuth } from '@/services/spotify';

describe('useSpotifyPlayback', () => {
  const tracks = [
    makeTrack({ id: 't1', uri: 'spotify:track:t1', name: 'Track 1' }),
    makeTrack({ id: 't2', uri: 'spotify:track:t2', name: 'Track 2' }),
    makeTrack({ id: 't3', uri: 'spotify:track:t3', name: 'Track 3' }),
  ];
  const setCurrentTrackIndex = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns early when track index out of bounds', async () => {
    const { result } = renderHook(() =>
      useSpotifyPlayback({ tracks, setCurrentTrackIndex })
    );

    await act(async () => {
      await result.current.playTrack(99);
    });

    expect(spotifyPlayer.playTrack).not.toHaveBeenCalled();
  });

  it('returns early when not authenticated', async () => {
    vi.mocked(spotifyAuth.isAuthenticated).mockReturnValueOnce(false);

    const { result } = renderHook(() =>
      useSpotifyPlayback({ tracks, setCurrentTrackIndex })
    );

    await act(async () => {
      await result.current.playTrack(0);
    });

    expect(spotifyPlayer.playTrack).not.toHaveBeenCalled();
  });

  it('marks track failed and skips to next on Restriction Violated', async () => {
    vi.mocked(spotifyPlayer.playTrack).mockRejectedValueOnce(
      new Error('Spotify API error: 403 - Restriction violated')
    );

    const { result } = renderHook(() =>
      useSpotifyPlayback({ tracks, setCurrentTrackIndex })
    );

    await act(async () => {
      await result.current.playTrack(0, true);
    });

    // Should schedule a skip to next track after 500ms
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // The recursive call to playTrack(1, true) should attempt to play track 2
    expect(spotifyPlayer.playTrack).toHaveBeenCalledWith('spotify:track:t2');
  });

  it('calls setCurrentTrackIndex on successful playback', async () => {
    const { result } = renderHook(() =>
      useSpotifyPlayback({ tracks, setCurrentTrackIndex })
    );

    await act(async () => {
      await result.current.playTrack(1);
    });

    expect(spotifyPlayer.playTrack).toHaveBeenCalledWith('spotify:track:t2');
    expect(setCurrentTrackIndex).toHaveBeenCalledWith(1);
  });

  it('retries on 403 non-restriction error with backoff', async () => {
    vi.useRealTimers();

    vi.mocked(spotifyPlayer.playTrack)
      .mockRejectedValueOnce(new Error('Spotify API error: 403 - Device not found'))
      .mockResolvedValueOnce(undefined);

    // Make backoff-related waits resolve immediately
    vi.mocked(spotifyPlayer.ensureDeviceIsActive).mockResolvedValue(true);

    const { result } = renderHook(() =>
      useSpotifyPlayback({ tracks, setCurrentTrackIndex })
    );

    await act(async () => {
      await result.current.playTrack(0);
    });

    // Should have been called twice: once failed, once succeeded after retry
    expect(spotifyPlayer.playTrack).toHaveBeenCalledTimes(2);
  }, 15000);
});
