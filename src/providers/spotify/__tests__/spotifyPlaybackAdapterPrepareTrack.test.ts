import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyPlaybackAdapter } from '@/providers/spotify/spotifyPlaybackAdapter';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { AuthExpiredError } from '@/providers/errors';
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

describe('SpotifyPlaybackAdapter.prepareTrack', () => {
  let adapter: SpotifyPlaybackAdapter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(spotifyPlayer.getIsReady).mockReturnValue(true);
    vi.mocked(spotifyPlayer.getDeviceId).mockReturnValue('device-1');
    vi.mocked(spotifyPlayer.transferPlaybackToDevice).mockResolvedValue(undefined);
    vi.mocked(spotifyPlayer.ensureDeviceIsActive).mockResolvedValue(true);
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    adapter = new SpotifyPlaybackAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits a PlaybackState with the saved positionMs, track durationMs, and isPlaying=false', async () => {
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

  it('does NOT emit or transfer the device for the pre-warm intent (called without positionMs)', async () => {
    // #given — the next-track pre-warm caller in useProviderPlayback.playTrack
    // invokes prepareTrack(track) with no options. Emitting a PlaybackState
    // with currentTrackId = nextTrack.id during pre-warm races the SDK's
    // player_state_changed for the actually-playing track and flickers album
    // art (#1199 / `vorbis:art-race`). The /me/player transfer also adds
    // nothing in steady state — the next playTrack runs its own readiness
    // check. Token warming is the only meaningful side effect.
    const track = makeTrack();
    const received: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => received.push(state));

    // #when
    adapter.prepareTrack(track);

    // #then — flush microtasks for the synchronous early-return + auth-warm
    // .catch() chain, then assert no UI emission and no API calls.
    await Promise.resolve();
    await Promise.resolve();
    expect(received.find((s) => s?.currentTrackId === track.id)).toBeUndefined();
    expect(vi.mocked(spotifyPlayer.transferPlaybackToDevice)).not.toHaveBeenCalled();
    expect(vi.mocked(spotifyPlayer.ensureDeviceIsActive)).not.toHaveBeenCalled();
  });

  it('still emits when positionMs is explicitly 0 (hydrate intent at the very start)', async () => {
    // #given — saved sessions can have positionMs === 0 (track started but
    // not advanced). The hydrate caller passes `{ positionMs: 0 }` which is
    // semantically distinct from omitting options entirely: the seek bar
    // still needs the staged emission to reflect the staged track.
    const track = makeTrack();
    const received: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => received.push(state));

    // #when
    adapter.prepareTrack(track, { positionMs: 0 });

    // #then
    await vi.waitFor(() => {
      expect(received.find((s) => s?.currentTrackId === track.id)).toBeDefined();
    });
    const staged = received.find((s) => s?.currentTrackId === track.id)!;
    expect(staged.positionMs).toBe(0);
    expect(staged.isPlaying).toBe(false);
  });

  it('does not start actual playback — no /me/player/play call and no pause()', async () => {
    // #given — the regression root cause (#1179): previously prepareTrack
    // called /me/player/play then pause, which could land playing on a fresh
    // tab. The fix stages state locally without touching Spotify playback.
    const track = makeTrack();

    // #when
    adapter.prepareTrack(track, { positionMs: 10_000 });

    // #then — wait for the stage emission to ensure the whole flow ran, then
    // verify no audio-starting calls were made.
    const received: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => received.push(state));
    await vi.waitFor(() => {
      // Give the stage pipeline a beat to run.
      expect(vi.mocked(spotifyPlayer.transferPlaybackToDevice)).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const playCalls = fetchMock.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/me/player/play'),
    );
    expect(playCalls).toHaveLength(0);
    expect(spotifyPlayer.pause).not.toHaveBeenCalled();
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

    // #then — ensurePlaybackReady runs once because the second call hits the
    // preparedTrackRef idempotency guard; emission fires exactly once.
    await vi.waitFor(() => expect(stageEmissions).toHaveLength(1));
    expect(vi.mocked(spotifyPlayer.transferPlaybackToDevice)).toHaveBeenCalledTimes(1);
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
    // #given — ensurePlaybackReady fails on the first prepareTrack call
    const track = makeTrack();
    const stageEmissions: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => {
      if (state?.currentTrackId === track.id && !state.isPlaying) {
        stageEmissions.push(state);
      }
    });
    vi.mocked(spotifyPlayer.transferPlaybackToDevice)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(undefined);

    // #when
    adapter.prepareTrack(track, { positionMs: 12_000 });
    await vi.waitFor(() =>
      expect(vi.mocked(spotifyPlayer.transferPlaybackToDevice)).toHaveBeenCalledTimes(1),
    );
    // Second call after the failure — guard was reset, so this retries.
    adapter.prepareTrack(track, { positionMs: 12_000 });

    // #then
    await vi.waitFor(() => expect(stageEmissions).toHaveLength(1));
    expect(vi.mocked(spotifyPlayer.transferPlaybackToDevice)).toHaveBeenCalledTimes(2);
  });

  describe('probePlayable', () => {
    const findTrackProbeCall = (mock: ReturnType<typeof vi.fn>) =>
      mock.mock.calls.find(([url]) => typeof url === 'string' && url.includes('/v1/tracks/'));

    it('returns true when the track responds with is_playable=true', async () => {
      // #given
      const track = makeTrack();
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ is_playable: true }), { status: 200 }),
      );

      // #when
      const result = await adapter.probePlayable(track);

      // #then
      expect(result).toBe(true);
      const probe = findTrackProbeCall(fetchMock)!;
      expect(probe[0]).toContain('/v1/tracks/abc');
      expect(probe[0]).toContain('market=from_token');
    });

    it('returns false when is_playable is explicitly false (market-restricted)', async () => {
      // #given
      const track = makeTrack();
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ is_playable: false }), { status: 200 }),
      );

      // #when
      const result = await adapter.probePlayable(track);

      // #then
      expect(result).toBe(false);
    });

    it('returns false when the track endpoint responds with 404', async () => {
      // #given — Spotify removed the track from the catalog
      const track = makeTrack();
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

      // #when
      const result = await adapter.probePlayable(track);

      // #then
      expect(result).toBe(false);
    });

    it('returns false when the playback ref is not a spotify:track URI', async () => {
      // #given — malformed ref (e.g., stale Spotify URI coming from a legacy session)
      const track = makeTrack({ playbackRef: { provider: 'spotify', ref: 'spotify:episode:xyz' } });

      // #when
      const result = await adapter.probePlayable(track);

      // #then — we never even hit fetch
      expect(result).toBe(false);
      expect(findTrackProbeCall(fetchMock)).toBeUndefined();
    });

    it('throws AuthExpiredError on 401 so the caller can abort hydrate', async () => {
      // #given
      const track = makeTrack();
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

      // #when / #then
      await expect(adapter.probePlayable(track)).rejects.toBeInstanceOf(AuthExpiredError);
    });

    it('throws on unexpected non-ok responses (e.g. 500) to surface transient errors', async () => {
      // #given
      const track = makeTrack();
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

      // #when / #then
      await expect(adapter.probePlayable(track)).rejects.toThrow(/probePlayable failed: 500/);
    });
  });

  it('skips the stale stage emission when a different track is prepared mid-stage', async () => {
    // #given — prepareTrack(A) is in flight when prepareTrack(B) overrides it.
    // Slow-resolve the first transfer so the supersede wins the race.
    const trackA = makeTrack({ id: 'a', playbackRef: { provider: 'spotify', ref: 'spotify:track:a' } });
    const trackB = makeTrack({ id: 'b', playbackRef: { provider: 'spotify', ref: 'spotify:track:b' } });
    const stageEmissions: Array<PlaybackState | null> = [];
    adapter.subscribe((state) => {
      if (state && !state.isPlaying) stageEmissions.push(state);
    });

    let resolveFirstTransfer!: () => void;
    vi.mocked(spotifyPlayer.transferPlaybackToDevice)
      .mockImplementationOnce(
        () => new Promise<void>((resolve) => {
          resolveFirstTransfer = () => resolve();
        }),
      )
      .mockResolvedValue(undefined);

    // #when
    adapter.prepareTrack(trackA, { positionMs: 1_000 });
    await vi.waitFor(() => expect(resolveFirstTransfer).toBeTypeOf('function'));
    adapter.prepareTrack(trackB, { positionMs: 2_000 });
    resolveFirstTransfer();

    // #then — only B's staged state should reach subscribers
    await vi.waitFor(() => {
      const bEmit = stageEmissions.find((s) => s?.currentTrackId === 'b');
      expect(bEmit).toBeDefined();
    });
    expect(stageEmissions.find((s) => s?.currentTrackId === 'a')).toBeUndefined();
  });
});
