import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyPlaybackAdapter } from '@/providers/spotify/spotifyPlaybackAdapter';
import type { MediaTrack } from '@/types/domain';
import type { CollectionRef } from '@/types/domain';
import { spotifyPlayer } from '@/services/spotifyPlayer';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getIsReady: vi.fn().mockReturnValue(true),
    getDeviceId: vi.fn().mockReturnValue('device-1'),
    transferPlaybackToDevice: vi.fn().mockResolvedValue(undefined),
    ensureDeviceIsActive: vi.fn().mockResolvedValue(true),
    playTrack: vi.fn().mockResolvedValue(undefined),
    playContext: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    getCurrentState: vi.fn().mockResolvedValue(null),
    nextTrack: vi.fn().mockResolvedValue(undefined),
    previousTrack: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn().mockReturnValue(() => {}),
  },
}));

const makeSpotifyTrack = (): MediaTrack => ({
  id: 'track-1',
  provider: 'spotify',
  playbackRef: { provider: 'spotify', ref: 'spotify:track:abc123' },
  name: 'Track',
  artists: 'Artist',
  album: 'Album',
  durationMs: 1000,
});

describe('SpotifyPlaybackAdapter', () => {
  let adapter: SpotifyPlaybackAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');
    vi.mocked(spotifyPlayer.initialize).mockResolvedValue(undefined);
    vi.mocked(spotifyPlayer.transferPlaybackToDevice).mockResolvedValue(undefined);
    vi.mocked(spotifyPlayer.ensureDeviceIsActive).mockResolvedValue(true);
    vi.mocked(spotifyPlayer.playTrack).mockResolvedValue(undefined);
    vi.mocked(spotifyPlayer.playContext).mockResolvedValue(undefined);
    adapter = new SpotifyPlaybackAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes and activates device before playing a track', async () => {
    const readyStates = [false, true];
    vi.mocked(spotifyPlayer.getIsReady).mockImplementation(() => readyStates.shift() ?? true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');

    await adapter.playTrack(makeSpotifyTrack());

    expect(spotifyPlayer.initialize).toHaveBeenCalledTimes(1);
    expect(spotifyPlayer.transferPlaybackToDevice).toHaveBeenCalledTimes(1);
    expect(spotifyPlayer.ensureDeviceIsActive).toHaveBeenCalledTimes(1);
    expect(spotifyPlayer.playTrack).toHaveBeenCalledWith('spotify:track:abc123');
  });

  it('times out if SDK never becomes ready', async () => {
    vi.useFakeTimers();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(false);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue(null);

    const playPromise = adapter.playTrack(makeSpotifyTrack());
    const rejection = expect(playPromise).rejects.toThrow('Spotify player not ready after waiting');
    await vi.advanceTimersByTimeAsync(10_500);

    await rejection;
    expect(spotifyPlayer.playTrack).not.toHaveBeenCalled();
  });

  it('ensures readiness before playing playlist context', async () => {
    const collection: CollectionRef = { provider: 'spotify', kind: 'playlist', id: 'playlist-1' };

    await adapter.playCollection(collection);

    expect(spotifyPlayer.initialize).toHaveBeenCalledTimes(1);
    expect(spotifyPlayer.transferPlaybackToDevice).toHaveBeenCalledTimes(1);
    expect(spotifyPlayer.ensureDeviceIsActive).toHaveBeenCalledTimes(1);
    expect(spotifyPlayer.playContext).toHaveBeenCalledWith('spotify:playlist:playlist-1', undefined);
  });
});
