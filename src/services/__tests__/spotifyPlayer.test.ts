import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/spotifyPlayerSdk', () => ({
  getHMRState: () => ({ player: null, deviceId: null, isReady: false }),
  saveHMRState: vi.fn(),
  loadSpotifySDK: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    ensureValidToken: vi.fn().mockResolvedValue('token'),
    redirectToAuth: vi.fn(),
  },
}));

const { spotifyPlayer, waitForSpotifyReady } = await import('@/services/spotifyPlayer');

describe('waitForSpotifyReady', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves immediately when the player is already ready and has a device id', async () => {
    // #given
    vi.spyOn(spotifyPlayer, 'getIsReady').mockReturnValue(true);
    vi.spyOn(spotifyPlayer, 'getDeviceId').mockReturnValue('device-1');

    // #when / #then
    await expect(waitForSpotifyReady()).resolves.toBeUndefined();
  });

  it('polls and resolves once the SDK becomes ready', async () => {
    // #given — first poll: not ready; subsequent polls: ready
    vi.useFakeTimers();
    let readyCallCount = 0;
    vi.spyOn(spotifyPlayer, 'getIsReady').mockImplementation(() => {
      readyCallCount += 1;
      return readyCallCount > 1;
    });
    vi.spyOn(spotifyPlayer, 'getDeviceId').mockImplementation(() =>
      readyCallCount > 1 ? 'device-1' : null,
    );

    // #when
    const promise = waitForSpotifyReady();
    await vi.advanceTimersByTimeAsync(500);

    // #then
    await expect(promise).resolves.toBeUndefined();
  });

  it('throws after the timeout elapses if the player never becomes ready', async () => {
    // #given
    vi.useFakeTimers();
    vi.spyOn(spotifyPlayer, 'getIsReady').mockReturnValue(false);
    vi.spyOn(spotifyPlayer, 'getDeviceId').mockReturnValue(null);

    // #when
    const promise = waitForSpotifyReady(1_000);
    const rejection = expect(promise).rejects.toThrow('Spotify player not ready after waiting');
    await vi.advanceTimersByTimeAsync(1_500);

    // #then
    await rejection;
  });
});
