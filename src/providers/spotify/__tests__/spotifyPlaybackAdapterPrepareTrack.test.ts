/**
 * Tests for SpotifyPlaybackAdapter.prepareTrack: transfers playback to this device
 * staged paused at the saved position, and emits a PlaybackState so subscribers
 * (seek bar, duration readout) reflect the restored state before user presses play.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyPlaybackAdapter } from '@/providers/spotify/spotifyPlaybackAdapter';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import type { MediaTrack, PlaybackState } from '@/types/domain';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getIsReady: vi.fn().mockReturnValue(true),
    getDeviceId: vi.fn().mockReturnValue('device-1'),
    transferPlaybackToDevice: vi.fn().mockResolvedValue(undefined),
    ensureDeviceIsActive: vi.fn().mockResolvedValue(true),
    pause: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@/services/spotify', () => ({
  spotifyAuth: {
    ensureValidToken: vi.fn().mockResolvedValue('token-xyz'),
  },
}));

const makeTrack = (overrides: Partial<MediaTrack> = {}): MediaTrack => ({
  id: 'track-1',
  provider: 'spotify',
  playbackRef: { provider: 'spotify', ref: 'spotify:track:abc' },
  name: 'Track',
  artists: 'Artist',
  album: 'Album',
  durationMs: 210_000,
  ...overrides,
});

/** Wait for prepareTrack's fire-and-forget stage chain to settle. */
const flushStageTrack = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
};

describe('SpotifyPlaybackAdapter.prepareTrack', () => {
  let adapter: SpotifyPlaybackAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    adapter = new SpotifyPlaybackAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('transfers playback with play=false and position_ms at the saved position', async () => {
    // #given
    const track = makeTrack();
    const positionMs = 42_000;

    // #when
    adapter.prepareTrack(track, { positionMs });
    await flushStageTrack();

    // #then
    const playCall = fetchMock.mock.calls.find(([url]) =>
      typeof url === 'string' && url.includes('/me/player/play')
    );
    expect(playCall).toBeDefined();
    const body = JSON.parse(playCall![1].body as string);
    expect(body).toEqual({ uris: ['spotify:track:abc'], position_ms: positionMs });
    expect(spotifyPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('emits a PlaybackState with correct positionMs, durationMs, and isPlaying=false', async () => {
    // #given
    const track = makeTrack({ durationMs: 180_000 });
    const received: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => received.push(state));

    // #when
    adapter.prepareTrack(track, { positionMs: 15_000 });
    await flushStageTrack();

    // #then
    const staged = received.find((s) => s?.currentTrackId === 'track-1');
    expect(staged).toBeDefined();
    expect(staged).toMatchObject({
      isPlaying: false,
      positionMs: 15_000,
      durationMs: 180_000,
      currentTrackId: 'track-1',
      currentPlaybackRef: { provider: 'spotify', ref: 'spotify:track:abc' },
    });
  });

  it('does not double-emit when prepareTrack is called twice for the same track', async () => {
    // #given
    const track = makeTrack();
    const stageEmissions: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => {
      if (state?.currentTrackId === track.id && !state.isPlaying) {
        stageEmissions.push(state);
      }
    });

    // #when
    adapter.prepareTrack(track, { positionMs: 10_000 });
    adapter.prepareTrack(track, { positionMs: 10_000 });
    await flushStageTrack();

    // #then
    expect(stageEmissions).toHaveLength(1);
    const playCallCount = fetchMock.mock.calls.filter(([url]) =>
      typeof url === 'string' && url.includes('/me/player/play')
    ).length;
    expect(playCallCount).toBe(1);
    expect(spotifyPlayer.pause).toHaveBeenCalledTimes(1);
  });

  it('re-stages when prepareTrack is called for a different track', async () => {
    // #given
    const trackA = makeTrack({ id: 'a', playbackRef: { provider: 'spotify', ref: 'spotify:track:a' } });
    const trackB = makeTrack({ id: 'b', playbackRef: { provider: 'spotify', ref: 'spotify:track:b' } });
    const staged: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => {
      if (state && !state.isPlaying) staged.push(state);
    });

    // #when
    adapter.prepareTrack(trackA, { positionMs: 5_000 });
    await flushStageTrack();
    adapter.prepareTrack(trackB, { positionMs: 8_000 });
    await flushStageTrack();

    // #then
    expect(staged.map((s) => s?.currentTrackId)).toEqual(['a', 'b']);
  });
});
