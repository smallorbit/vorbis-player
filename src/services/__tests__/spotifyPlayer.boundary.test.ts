import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SPOTIFY_RESUME_TIMEOUT_MS } from '@/constants/spotify';

const apiTransferPlayback = vi.fn();
const apiPlayTrack = vi.fn();

vi.mock('@/services/spotifyPlayerPlayback', () => ({
  apiPlayTrack: (...args: unknown[]) => apiPlayTrack(...args),
  apiPlayContext: vi.fn(),
  apiPlayPlaylist: vi.fn(),
  apiSetVolume: vi.fn(),
  apiTransferPlayback: (...args: unknown[]) => apiTransferPlayback(...args),
  apiEnsureDeviceActive: vi.fn(),
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    isAuthenticated: vi.fn().mockReturnValue(true),
    ensureValidToken: vi.fn().mockResolvedValue('token'),
    redirectToAuth: vi.fn(),
    reportUnauthorized: vi.fn(),
  },
}));

const playerHarness = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const emit = (event: string, payload?: unknown) => {
    for (const cb of listeners.get(event) ?? []) {
      cb(payload);
    }
  };
  const player = {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    nextTrack: vi.fn(),
    previousTrack: vi.fn(),
    setVolume: vi.fn().mockResolvedValue(undefined),
    getCurrentState: vi.fn().mockResolvedValue(null),
    getVolume: vi.fn().mockResolvedValue(0.5),
    seek: vi.fn().mockResolvedValue(undefined),
    setName: vi.fn().mockResolvedValue(undefined),
    togglePlay: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(cb);
    }),
    removeListener: vi.fn((event: string, cb?: (...args: unknown[]) => void) => {
      if (!cb) {
        listeners.delete(event);
        return;
      }
      listeners.get(event)?.delete(cb);
    }),
  };
  return { player, listeners, emit };
});

vi.mock('@/services/spotifyPlayerSdk', () => ({
  getHMRState: () => ({ player: null, deviceId: null, isReady: false }),
  saveHMRState: vi.fn(),
  loadSpotifySDK: vi.fn().mockResolvedValue(undefined),
}));

async function freshPlayerService() {
  vi.resetModules();
  apiTransferPlayback.mockReset();
  apiPlayTrack.mockReset();
  playerHarness.listeners.clear();
  vi.mocked(playerHarness.player.connect).mockClear();
  vi.mocked(playerHarness.player.resume).mockClear();
  vi.mocked(playerHarness.player.getCurrentState).mockResolvedValue(null);

  window.Spotify = {
    Player: vi.fn(() => playerHarness.player) as unknown as typeof window.Spotify.Player,
  };

  const mod = await import('@/services/spotifyPlayer');
  await mod.spotifyPlayer.initialize();
  playerHarness.emit('ready', { device_id: 'device-1' });
  return mod.spotifyPlayer;
}

function minimalPlaybackState(
  overrides: Partial<Pick<SpotifyPlaybackState, 'paused' | 'position'>> = {},
): SpotifyPlaybackState {
  return {
    context: { uri: 'spotify:album:1', metadata: {} },
    disallows: {
      pausing: false,
      peeking_next: false,
      peeking_prev: false,
      resuming: false,
      seeking: false,
      skipping_next: false,
      skipping_prev: false,
    },
    paused: overrides.paused ?? false,
    position: overrides.position ?? 0,
    repeat_mode: 0,
    shuffle: false,
    track_window: {
      current_track: {
        id: 't1',
        uri: 'spotify:track:1',
        name: 'Track',
        duration_ms: 180_000,
        artists: [{ name: 'Artist', uri: 'spotify:artist:1' }],
        album: {
          uri: 'spotify:album:1',
          name: 'Album',
          images: [],
        },
      },
      next_tracks: [],
      previous_tracks: [],
    },
  };
}

describe('SpotifyPlayerService — SDK/API boundary', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('transferPlaybackToDevice skips repeat transfers within the TTL unless forced', async () => {
    // #given
    const spotifyPlayer = await freshPlayerService();
    apiTransferPlayback.mockResolvedValue(true);
    let nowMs = 1_000_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

    // #when
    await spotifyPlayer.transferPlaybackToDevice();
    nowMs = 1_000_100;
    await spotifyPlayer.transferPlaybackToDevice();
    await spotifyPlayer.transferPlaybackToDevice(true);
    nowSpy.mockRestore();

    // #then
    expect(apiTransferPlayback).toHaveBeenCalledTimes(2);
  });

  it('waitForPlaybackOrResume settles once on the first player_state_changed event', async () => {
    // #given
    const spotifyPlayer = await freshPlayerService();
    const activateDevice = vi.fn().mockResolvedValue(undefined);

    // #when
    spotifyPlayer.waitForPlaybackOrResume(activateDevice);
    playerHarness.emit('player_state_changed', null);
    playerHarness.emit('player_state_changed', null);

    await Promise.resolve();

    // #then
    expect(activateDevice).toHaveBeenCalledTimes(1);
  });

  it('waitForPlaybackOrResume resumes when the first state is paused at position zero', async () => {
    // #given
    const spotifyPlayer = await freshPlayerService();
    const activateDevice = vi.fn().mockResolvedValue(undefined);

    // #when
    spotifyPlayer.waitForPlaybackOrResume(activateDevice);
    playerHarness.emit(
      'player_state_changed',
      minimalPlaybackState({ paused: true, position: 0 }),
    );

    await Promise.resolve();

    // #then
    expect(playerHarness.player.resume).toHaveBeenCalledTimes(1);
    expect(activateDevice).not.toHaveBeenCalled();
  });

  it('waitForPlaybackOrResume falls back after timeout when no state event arrives', async () => {
    // #given
    vi.useFakeTimers();
    const spotifyPlayer = await freshPlayerService();
    const activateDevice = vi.fn().mockResolvedValue(undefined);
    vi.mocked(playerHarness.player.getCurrentState).mockResolvedValue(null);

    // #when
    spotifyPlayer.waitForPlaybackOrResume(activateDevice, SPOTIFY_RESUME_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(SPOTIFY_RESUME_TIMEOUT_MS + 50);
    await Promise.resolve();

    // #then
    expect(activateDevice).toHaveBeenCalledTimes(1);
  });
});
