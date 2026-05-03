import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyPlaybackAdapter } from '@/providers/spotify/spotifyPlaybackAdapter';
import { spotifyPlayer, waitForSpotifyReady } from '@/services/spotifyPlayer';
import type { MediaTrack } from '@/types/domain';

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getIsReady: vi.fn().mockReturnValue(true),
    getDeviceId: vi.fn().mockReturnValue('device-1'),
    transferPlaybackToDevice: vi.fn().mockResolvedValue(undefined),
    ensureDeviceIsActive: vi.fn().mockResolvedValue(true),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getCurrentState: vi.fn().mockResolvedValue(null),
    waitForPlaybackOrResume: vi.fn(),
    onPlayerStateChanged: vi.fn().mockReturnValue(() => {}),
  },
  waitForSpotifyReady: vi.fn().mockResolvedValue(undefined),
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

describe('SpotifyPlaybackAdapter.playTrack', () => {
  let adapter: SpotifyPlaybackAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');
    vi.mocked(spotifyPlayer.transferPlaybackToDevice).mockResolvedValue(undefined);
    vi.mocked(spotifyPlayer.ensureDeviceIsActive).mockResolvedValue(true);
    vi.mocked(spotifyPlayer.playTrack).mockResolvedValue(undefined);
    vi.mocked(spotifyPlayer.getCurrentState).mockResolvedValue(null);
    vi.mocked(waitForSpotifyReady).mockResolvedValue(undefined);
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    adapter = new SpotifyPlaybackAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call getCurrentState on a warm-session track switch', async () => {
    // #given — warm session: first play establishes playbackSessionActive
    const track = makeTrack();
    await adapter.playTrack(track);

    // #when — second play (warm switch)
    vi.clearAllMocks();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');
    vi.mocked(spotifyPlayer.playTrack).mockResolvedValue(undefined);
    await adapter.playTrack(track);

    // #then — getCurrentState must never be consulted
    expect(vi.mocked(spotifyPlayer.getCurrentState)).not.toHaveBeenCalled();
  });

  it('always issues apiPlayTrack even when SDK is already on the requested URI', async () => {
    // #given — SDK reports it is already playing the target track
    const track = makeTrack();
    vi.mocked(spotifyPlayer.getCurrentState).mockResolvedValue({
      track_window: { current_track: { uri: track.playbackRef.ref } },
      paused: false,
    } as SpotifyPlaybackState);

    // warm up session
    await adapter.playTrack(track);
    vi.clearAllMocks();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');
    vi.mocked(spotifyPlayer.playTrack).mockResolvedValue(undefined);

    // #when — play the same track again on a warm session
    await adapter.playTrack(track);

    // #then — API call is always issued; no early return
    expect(vi.mocked(spotifyPlayer.playTrack)).toHaveBeenCalledTimes(1);
  });

  it('takes the fast-path on a warm session (skips transfer + ensureDeviceIsActive)', async () => {
    // #given — warm session established
    const track = makeTrack();
    await adapter.playTrack(track);
    vi.clearAllMocks();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');
    vi.mocked(spotifyPlayer.playTrack).mockResolvedValue(undefined);

    // #when — second play
    await adapter.playTrack(track);

    // #then — fast-path skips the heavy readiness calls
    expect(vi.mocked(spotifyPlayer.transferPlaybackToDevice)).not.toHaveBeenCalled();
    expect(vi.mocked(spotifyPlayer.ensureDeviceIsActive)).not.toHaveBeenCalled();
  });

  it('uses the full readiness path on the first cold play', async () => {
    // #given — fresh adapter, no session yet
    const track = makeTrack();

    // #when — first play
    await adapter.playTrack(track);

    // #then — full path: both transfer and ensureDeviceIsActive are called
    expect(vi.mocked(spotifyPlayer.transferPlaybackToDevice)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(spotifyPlayer.ensureDeviceIsActive)).toHaveBeenCalledTimes(1);
  });

  it('passes positionMs through to spotifyPlayer.playTrack', async () => {
    // #given
    const track = makeTrack();

    // #when
    await adapter.playTrack(track, { positionMs: 42_000 });

    // #then — positionMs forwarded as the last argument to playWithRetry → playTrack
    expect(vi.mocked(spotifyPlayer.playTrack)).toHaveBeenCalledWith(
      track.playbackRef.ref,
      undefined,
      42_000,
    );
  });
});
