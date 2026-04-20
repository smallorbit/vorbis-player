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
