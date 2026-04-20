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
    getCurrentState: vi.fn().mockResolvedValue({ paused: true }),
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

const findPlayCall = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.find(([url]) => typeof url === 'string' && url.includes('/me/player/play'));

const countPlayCalls = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.filter(([url]) => typeof url === 'string' && url.includes('/me/player/play')).length;

describe('SpotifyPlaybackAdapter.prepareTrack', () => {
  let adapter: SpotifyPlaybackAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');
    vi.mocked(spotifyPlayer.getCurrentState).mockResolvedValue({ paused: true } as any);
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    adapter = new SpotifyPlaybackAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('transfers playback with the track uri and position_ms at the saved position', async () => {
    // #given
    const track = makeTrack();
    const positionMs = 42_000;

    // #when
    adapter.prepareTrack(track, { positionMs });

    // #then
    await vi.waitFor(() => expect(findPlayCall(fetchMock)).toBeDefined());
    const playCall = findPlayCall(fetchMock)!;
    const body = JSON.parse(playCall[1].body as string);
    expect(body).toEqual({ uris: ['spotify:track:abc'], position_ms: positionMs });
    await vi.waitFor(() => expect(spotifyPlayer.pause).toHaveBeenCalledTimes(1));
  });

  it('emits a PlaybackState with correct positionMs, durationMs, and isPlaying=false', async () => {
    // #given
    const track = makeTrack({ durationMs: 180_000 });
    const received: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => received.push(state));

    // #when
    adapter.prepareTrack(track, { positionMs: 15_000 });

    // #then
    await vi.waitFor(() => {
      expect(received.find((s) => s?.currentTrackId === 'track-1')).toBeDefined();
    });
    const staged = received.find((s) => s?.currentTrackId === 'track-1')!;
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

    // #then
    await vi.waitFor(() => expect(stageEmissions).toHaveLength(1));
    expect(countPlayCalls(fetchMock)).toBe(1);
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
    await vi.waitFor(() => expect(staged).toHaveLength(1));
    adapter.prepareTrack(trackB, { positionMs: 8_000 });

    // #then
    await vi.waitFor(() => expect(staged).toHaveLength(2));
    expect(staged.map((s) => s?.currentTrackId)).toEqual(['a', 'b']);
  });

  it('clears the idempotency guard on failure so a retry can re-stage', async () => {
    // #given — first prepareTrack call fails at the play step
    const track = makeTrack();
    const stageEmissions: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => {
      if (state?.currentTrackId === track.id && !state.isPlaying) {
        stageEmissions.push(state);
      }
    });
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    // #when
    adapter.prepareTrack(track, { positionMs: 12_000 });
    await vi.waitFor(() => expect(countPlayCalls(fetchMock)).toBe(1));

    // Second call after failure should retry (not be treated as idempotent).
    adapter.prepareTrack(track, { positionMs: 12_000 });

    // #then
    await vi.waitFor(() => expect(stageEmissions).toHaveLength(1));
    expect(countPlayCalls(fetchMock)).toBe(2);
  });

  describe('stage-paused race (#1179)', () => {
    it('re-issues pause when SDK still reports paused=false after the initial pause', async () => {
      // #given — simulate Spotify's server state lagging: the first
      // getCurrentState still reports playing, the next reports paused.
      vi.mocked(spotifyPlayer.getCurrentState)
        .mockResolvedValueOnce({ paused: false } as any)
        .mockResolvedValue({ paused: true } as any);
      const track = makeTrack();

      // #when
      adapter.prepareTrack(track, { positionMs: 10_000 });

      // #then — initial pause + one re-issue = 2 pauses total
      await vi.waitFor(() => expect(spotifyPlayer.pause).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(spotifyPlayer.getCurrentState).toHaveBeenCalled());
    });

    it('stops at MAX_ATTEMPTS so hydrate is not blocked indefinitely', async () => {
      // #given — SDK keeps reporting paused=false forever (stuck in playing).
      // Isolate this adapter in a fresh instance to avoid any in-flight stage
      // loop from a previous test sharing the mocked spotifyPlayer singleton.
      vi.mocked(spotifyPlayer.getCurrentState).mockResolvedValue({ paused: false } as any);
      const isolatedAdapter = new SpotifyPlaybackAdapter();
      const track = makeTrack();

      // #when
      isolatedAdapter.prepareTrack(track, { positionMs: 10_000 });

      // Track how many pauses THIS stage emits by counting growth relative to
      // the baseline when we started. We can't assert on absolute counts
      // because earlier tests may leak one tail pause into this one; we only
      // care that pause calls for THIS adapter are bounded.
      const baseline = vi.mocked(spotifyPlayer.pause).mock.calls.length;

      // #then — wait long enough for 5 * 100ms poll + margin, then assert
      // the call count has stabilized (no unbounded growth).
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const afterSettle = vi.mocked(spotifyPlayer.pause).mock.calls.length;
      await new Promise((resolve) => setTimeout(resolve, 500));
      const afterWait = vi.mocked(spotifyPlayer.pause).mock.calls.length;

      // Within the first 1200ms window, at most MAX_ATTEMPTS (5) re-pauses
      // plus the initial pause = 6 pauses attributable to this stage. Allow
      // slack for mid-flight cross-test pauses: bounded well under 20.
      expect(afterSettle - baseline).toBeLessThan(15);
      // And no more pauses land after the loop caps out.
      expect(afterWait).toBe(afterSettle);
    });

    it('stops re-issuing pause when another track supersedes the stage', async () => {
      // #given — SDK reports paused=false forever; first stage will loop
      // unless the supersede guard fires it. Use a fresh adapter to avoid
      // prior-test leakage confusing call counts.
      vi.mocked(spotifyPlayer.getCurrentState).mockResolvedValue({ paused: false } as any);
      const isolatedAdapter = new SpotifyPlaybackAdapter();
      const trackA = makeTrack({ id: 'a', playbackRef: { provider: 'spotify', ref: 'spotify:track:a' } });
      const trackB = makeTrack({ id: 'b', playbackRef: { provider: 'spotify', ref: 'spotify:track:b' } });

      // #when
      isolatedAdapter.prepareTrack(trackA, { positionMs: 1_000 });
      // Immediately supersede with trackB before A's loop can fully burn down.
      isolatedAdapter.prepareTrack(trackB, { positionMs: 2_000 });

      // #then — after settling, total pause calls are bounded. Without the
      // supersede guard, both A and B would each run MAX_ATTEMPTS iterations.
      // With the guard, A bails early once B supersedes its preparedTrackRef.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const pauseCount = vi.mocked(spotifyPlayer.pause).mock.calls.length;
      // Upper bound: A's initial + up to 2 A loop retries (pre-supersede) +
      // B's initial + B's 5 loop retries = 9. Leave slack for cross-test leak.
      expect(pauseCount).toBeLessThan(20);
    });
  });

  it('skips the stale stage emission when a different track is prepared mid-stage', async () => {
    // #given — prepareTrack(A) is in flight when prepareTrack(B) overrides it
    const trackA = makeTrack({ id: 'a', playbackRef: { provider: 'spotify', ref: 'spotify:track:a' } });
    const trackB = makeTrack({ id: 'b', playbackRef: { provider: 'spotify', ref: 'spotify:track:b' } });
    const stageEmissions: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => {
      if (state && !state.isPlaying) stageEmissions.push(state);
    });

    let resolveFirstPlay!: () => void;
    fetchMock.mockImplementationOnce(
      () => new Promise<Response>((resolve) => {
        resolveFirstPlay = () => resolve(new Response(null, { status: 204 }));
      }),
    );

    // #when
    adapter.prepareTrack(trackA, { positionMs: 1_000 });
    await vi.waitFor(() => expect(resolveFirstPlay).toBeTypeOf('function'));
    adapter.prepareTrack(trackB, { positionMs: 2_000 });
    resolveFirstPlay();

    // #then — only B's staged state should reach subscribers
    await vi.waitFor(() => {
      const bEmit = stageEmissions.find((s) => s?.currentTrackId === 'b');
      expect(bEmit).toBeDefined();
    });
    expect(stageEmissions.find((s) => s?.currentTrackId === 'a')).toBeUndefined();
  });
});
