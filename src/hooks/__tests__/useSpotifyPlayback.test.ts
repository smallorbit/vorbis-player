import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeTrack } from '@/test/fixtures';

const mockSpotifyPlaybackInitialize = vi.fn().mockResolvedValue(undefined);

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn((id: string) => {
      if (id === 'spotify') {
        return {
          id: 'spotify',
          playback: {
            initialize: mockSpotifyPlaybackInitialize,
            pause: vi.fn().mockResolvedValue(undefined),
          },
        };
      }
      return null;
    }),
  },
}));

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
import type { MediaTrack } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';

function makeMediaTrack(overrides?: Partial<MediaTrack>): MediaTrack {
  return {
    id: 'mt1',
    provider: 'spotify',
    name: 'Spotify Track',
    artists: 'Artist',
    album: 'Album',
    albumId: 'album-1',
    trackNumber: 1,
    durationMs: 200000,
    image: '',
    playbackRef: { provider: 'spotify', ref: 'spotify:track:mt1' },
    ...overrides,
  };
}

function makeDropboxMediaTrack(overrides?: Partial<MediaTrack>): MediaTrack {
  return {
    id: 'dbmt1',
    provider: 'dropbox',
    name: 'Dropbox Track',
    artists: 'Artist',
    album: 'Album',
    albumId: 'album-1',
    trackNumber: 1,
    durationMs: 200000,
    image: '',
    playbackRef: { provider: 'dropbox', ref: 'https://dropbox.example.com/file.mp3' },
    ...overrides,
  };
}

function makeDropboxDescriptor(): ProviderDescriptor {
  return {
    id: 'dropbox',
    displayName: 'Dropbox',
    capabilities: {} as never,
    auth: {} as never,
    catalog: {} as never,
    playback: {
      initialize: vi.fn().mockResolvedValue(undefined),
      playTrack: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn().mockReturnValue(() => {}),
    },
  } as unknown as ProviderDescriptor;
}

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
    mockSpotifyPlaybackInitialize.mockResolvedValue(undefined);
    vi.mocked(spotifyAuth.isAuthenticated).mockReturnValue(true);
    vi.mocked(spotifyPlayer.playTrack).mockResolvedValue(undefined);
    vi.mocked(spotifyPlayer.ensureDeviceIsActive).mockResolvedValue(true);
    vi.mocked(spotifyPlayer.getCurrentState).mockResolvedValue(null);
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

  describe('cross-provider playback (Dropbox active, Spotify track)', () => {
    it('calls initialize and ensureDeviceIsActive before playing a Spotify track', async () => {
      vi.useRealTimers();

      const mediaTracksRef = {
        current: [makeMediaTrack({ id: 'sp1', provider: 'spotify', playbackRef: { provider: 'spotify' as const, ref: 'spotify:track:sp1' } })],
      };
      const dropboxDescriptor = makeDropboxDescriptor();

      const { result } = renderHook(() =>
        useSpotifyPlayback({
          tracks: [],
          setCurrentTrackIndex,
          activeDescriptor: dropboxDescriptor,
          mediaTracksRef,
        })
      );

      await act(async () => {
        await result.current.playTrack(0);
      });

      expect(mockSpotifyPlaybackInitialize).toHaveBeenCalled();
      expect(spotifyPlayer.ensureDeviceIsActive).toHaveBeenCalledWith(3, 1000);
      expect(spotifyPlayer.playTrack).toHaveBeenCalledWith('spotify:track:sp1');
      expect(setCurrentTrackIndex).toHaveBeenCalledWith(0);
    });

    it('calls setCurrentTrackIndex after successful cross-provider Spotify playback', async () => {
      vi.useRealTimers();

      const mediaTracksRef = {
        current: [makeMediaTrack({ id: 'sp2', provider: 'spotify', playbackRef: { provider: 'spotify' as const, ref: 'spotify:track:sp2' } })],
      };
      const dropboxDescriptor = makeDropboxDescriptor();

      const { result } = renderHook(() =>
        useSpotifyPlayback({
          tracks: [],
          setCurrentTrackIndex,
          activeDescriptor: dropboxDescriptor,
          mediaTracksRef,
        })
      );

      await act(async () => {
        await result.current.playTrack(0);
      });

      expect(setCurrentTrackIndex).toHaveBeenCalledWith(0);
    });

    it('returns early without playing when not authenticated in cross-provider path', async () => {
      vi.mocked(spotifyAuth.isAuthenticated).mockReturnValue(false);

      const mediaTracksRef = {
        current: [makeMediaTrack({ provider: 'spotify' })],
      };
      const dropboxDescriptor = makeDropboxDescriptor();

      const { result } = renderHook(() =>
        useSpotifyPlayback({
          tracks: [],
          setCurrentTrackIndex,
          activeDescriptor: dropboxDescriptor,
          mediaTracksRef,
        })
      );

      await act(async () => {
        await result.current.playTrack(0);
      });

      expect(spotifyPlayer.playTrack).not.toHaveBeenCalled();
      expect(setCurrentTrackIndex).not.toHaveBeenCalled();
    });

    it('calls onSpotifyAuthExpired and does not skip to next track on 401 error', async () => {
      vi.useRealTimers();

      const onSpotifyAuthExpired = vi.fn();
      vi.mocked(spotifyPlayer.playTrack).mockRejectedValueOnce(
        new Error('Spotify API error: 401 - Unauthorized')
      );

      const mediaTracksRef = {
        current: [
          makeMediaTrack({ id: 'sp1', provider: 'spotify', playbackRef: { provider: 'spotify' as const, ref: 'spotify:track:sp1' } }),
          makeMediaTrack({ id: 'sp2', provider: 'spotify', playbackRef: { provider: 'spotify' as const, ref: 'spotify:track:sp2' } }),
        ],
      };
      const dropboxDescriptor = makeDropboxDescriptor();

      const { result } = renderHook(() =>
        useSpotifyPlayback({
          tracks: [],
          setCurrentTrackIndex,
          activeDescriptor: dropboxDescriptor,
          mediaTracksRef,
          onSpotifyAuthExpired,
        })
      );

      await act(async () => {
        await result.current.playTrack(0, true);
      });

      expect(onSpotifyAuthExpired).toHaveBeenCalledTimes(1);
      // Should NOT have attempted to play the next track
      expect(spotifyPlayer.playTrack).toHaveBeenCalledTimes(1);
      expect(setCurrentTrackIndex).not.toHaveBeenCalled();
    });

    it('plays a Dropbox track normally when active provider is Dropbox and track is Dropbox', async () => {
      vi.useRealTimers();

      const dropboxMediaTrack = makeDropboxMediaTrack();
      const mediaTracksRef = { current: [dropboxMediaTrack] };
      const dropboxDescriptor = makeDropboxDescriptor();

      const { result } = renderHook(() =>
        useSpotifyPlayback({
          tracks: [],
          setCurrentTrackIndex,
          activeDescriptor: dropboxDescriptor,
          mediaTracksRef,
        })
      );

      await act(async () => {
        await result.current.playTrack(0);
      });

      expect(dropboxDescriptor.playback.playTrack).toHaveBeenCalledWith(dropboxMediaTrack);
      expect(setCurrentTrackIndex).toHaveBeenCalledWith(0);
      expect(spotifyPlayer.playTrack).not.toHaveBeenCalled();
    });
  });
});
