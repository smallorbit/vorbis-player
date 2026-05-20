import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockPlaybackAdapter } from '../mockPlaybackAdapter';
import type { MediaTrack } from '@/types/domain';

function makeTrack(id = 'track-1'): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name: 'Test Track',
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 300000,
  };
}

const mockAudio = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  paused: true,
  ended: false,
  currentTime: 0,
  duration: NaN,
  volume: 1,
  src: '',
  preload: '',
  loop: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.stubGlobal('Audio', vi.fn(() => mockAudio));

describe('MockPlaybackAdapter', () => {
  let adapter: MockPlaybackAdapter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockAudio.paused = true;
    mockAudio.play = vi.fn().mockImplementation(async () => {
      mockAudio.paused = false;
    });
    mockAudio.pause = vi.fn().mockImplementation(() => {
      mockAudio.paused = true;
    });
    adapter = new MockPlaybackAdapter('spotify');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('getState returns null before any track is played', async () => {
    // #given a freshly created adapter
    // #when getState is called with no track
    // #then returns null
    const state = await adapter.getState();
    expect(state).toBeNull();
  });

  it('subscribe returns an unsubscribe function', () => {
    // #given an adapter
    // #when subscribe is called
    // #then returns a callable unsubscribe
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('subscribe listener is called on playTrack', async () => {
    // #given a subscribed listener
    const listener = vi.fn();
    adapter.subscribe(listener);
    // #when playTrack is called
    await adapter.playTrack(makeTrack());
    // #then listener was notified
    expect(listener).toHaveBeenCalled();
  });

  it('state includes currentTrackId after playTrack', async () => {
    // #given
    // #when playTrack sets the current track
    await adapter.playTrack(makeTrack('my-track'));
    // #then state reflects the track id
    const state = await adapter.getState();
    expect(state?.currentTrackId).toBe('my-track');
  });

  it('state reflects snapshot durationMs, not audio element duration', async () => {
    // #given a track with 5-minute duration
    const track = makeTrack();
    track.durationMs = 300000;
    // #when played
    await adapter.playTrack(track);
    // #then reported durationMs matches the track, not the clip
    const state = await adapter.getState();
    expect(state?.durationMs).toBe(300000);
  });

  it('pause sets isPlaying to false', async () => {
    // #given a playing track
    await adapter.playTrack(makeTrack());
    // #when paused
    await adapter.pause();
    // #then isPlaying is false
    const state = await adapter.getState();
    expect(state?.isPlaying).toBe(false);
  });

  it('idempotent pause — second pause does not throw', async () => {
    // #given a paused adapter
    await adapter.playTrack(makeTrack());
    await adapter.pause();
    // #when pause is called again
    // #then no error is thrown
    await expect(adapter.pause()).resolves.toBeUndefined();
  });

  it('idempotent resume — resume when already playing does not throw', async () => {
    // #given a playing adapter
    await adapter.playTrack(makeTrack());
    // #when resume is called while playing
    // #then no error
    await expect(adapter.resume()).resolves.toBeUndefined();
  });

  it('seek updates position', async () => {
    // #given a paused adapter at position 0
    await adapter.playTrack(makeTrack());
    await adapter.pause();
    // #when seek is called
    await adapter.seek(60000);
    // #then position reflects the new offset
    const state = await adapter.getState();
    expect(state?.positionMs).toBe(60000);
  });

  it('next() throws', async () => {
    await expect(adapter.next()).rejects.toThrow();
  });

  it('previous() throws', async () => {
    await expect(adapter.previous()).rejects.toThrow();
  });

  it('unsubscribed listener is not called', async () => {
    // #given a listener that immediately unsubscribes
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);
    unsubscribe();
    // #when a track is played
    await adapter.playTrack(makeTrack());
    // #then listener is not notified
    expect(listener).not.toHaveBeenCalled();
  });

  it('probePlayable always resolves true', async () => {
    const result = await adapter.probePlayable(makeTrack());
    expect(result).toBe(true);
  });

  describe('prepareTrack', () => {
    it('emits staged state when positionMs is provided', () => {
      // #given a subscribed listener and no prior track
      const listener = vi.fn();
      adapter.subscribe(listener);
      // #when prepareTrack is called with positionMs > 0
      adapter.prepareTrack(makeTrack('seed-track'), { positionMs: 45000 });
      // #then listener is notified with the staged state
      expect(listener).toHaveBeenCalledOnce();
      const state = listener.mock.calls[0][0];
      expect(state?.currentTrackId).toBe('seed-track');
      expect(state?.positionMs).toBe(45000);
    });

    it('emits staged state when positionMs is 0', () => {
      // #given a subscribed listener
      const listener = vi.fn();
      adapter.subscribe(listener);
      // #when prepareTrack is called with positionMs: 0 (valid start-of-track seed)
      adapter.prepareTrack(makeTrack('seed-track'), { positionMs: 0 });
      // #then listener is notified — positionMs=0 is semantically distinct from
      // omitting options, matching the Spotify and Dropbox adapter contracts
      expect(listener).toHaveBeenCalledOnce();
      const state = listener.mock.calls[0][0];
      expect(state?.currentTrackId).toBe('seed-track');
      expect(state?.positionMs).toBe(0);
    });

    it('does not emit state when options is omitted', () => {
      // #given a subscribed listener
      const listener = vi.fn();
      adapter.subscribe(listener);
      // #when prepareTrack is called with no options (pre-warm intent)
      adapter.prepareTrack(makeTrack('seed-track'));
      // #then listener is not notified
      expect(listener).not.toHaveBeenCalled();
    });

    it('preserves audio.src when pre-warming against an already-playing track', () => {
      // #given an audio element already loaded with a clip (mid-playback)
      const originalSrc = 'blob:mock/currently-playing-clip';
      mockAudio.src = originalSrc;
      // #when prepareTrack is called without positionMs (pre-warm intent) —
      // this happens in single-provider queues where nextDescriptor ===
      // currentDescriptor at the pre-warm call site
      adapter.prepareTrack(makeTrack('seed-track'));
      // #then audio.src is unchanged and load() is not invoked, so the
      // currently-playing audio is not interrupted
      expect(mockAudio.src).toBe(originalSrc);
      expect(mockAudio.load).not.toHaveBeenCalled();
    });

    it('does not emit state when positionMs is undefined', () => {
      // #given a subscribed listener
      const listener = vi.fn();
      adapter.subscribe(listener);
      // #when prepareTrack is called with positionMs explicitly undefined
      adapter.prepareTrack(makeTrack('seed-track'), { positionMs: undefined });
      // #then listener is not notified
      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('getLastPlayTime returns 0 before first play', () => {
    expect(adapter.getLastPlayTime()).toBe(0);
  });

  it('getLastPlayTime is set after playTrack', async () => {
    await adapter.playTrack(makeTrack());
    expect(adapter.getLastPlayTime()).toBeGreaterThan(0);
  });

  it('position advances over time when playing', async () => {
    // #given a playing track
    await adapter.playTrack(makeTrack());
    // #when 5 seconds elapse
    vi.advanceTimersByTime(5000);
    // #then reported position has advanced
    const state = await adapter.getState();
    expect(state?.positionMs).toBeGreaterThanOrEqual(5000);
  });

  it('position freezes while paused', async () => {
    // #given a track that has played for 2 seconds then paused
    await adapter.playTrack(makeTrack());
    vi.advanceTimersByTime(2000);
    await adapter.pause();
    const posAfterPause = (await adapter.getState())?.positionMs ?? 0;
    // #when more time elapses while paused
    vi.advanceTimersByTime(3000);
    // #then position has not changed
    const posAfterWait = (await adapter.getState())?.positionMs ?? 0;
    expect(posAfterWait).toBe(posAfterPause);
  });

  describe('simulateNaturalEnd', () => {
    it('is a no-op when no track is loaded', () => {
      // #given no track loaded
      const listener = vi.fn();
      adapter.subscribe(listener);

      // #when
      adapter.simulateNaturalEnd();

      // #then: no notification emitted
      expect(listener).not.toHaveBeenCalled();
    });

    it('emits a mid-track playing state then a paused-at-zero state', async () => {
      // #given a track loaded
      const track = makeTrack();
      track.durationMs = 300000;
      await adapter.playTrack(track);

      const states: Array<{ isPlaying: boolean; positionMs: number } | null> = [];
      adapter.subscribe(state => states.push(state ? { isPlaying: state.isPlaying, positionMs: state.positionMs } : null));

      // #when
      adapter.simulateNaturalEnd();

      // #then: exactly two synthetic states emitted (no extra from audio.pause event)
      expect(states).toHaveLength(2);

      // first: mid-track playing
      expect(states[0]?.isPlaying).toBe(true);
      expect(states[0]?.positionMs).toBeGreaterThan(0);
      expect(states[0]?.positionMs).toBeLessThan(300000);

      // second: paused at zero (natural-end signal)
      expect(states[1]?.isPlaying).toBe(false);
      expect(states[1]?.positionMs).toBe(0);
    });

    it('backdates lastPlayTimeMs past the 5 000 ms cooldown', async () => {
      // #given a track just started
      await adapter.playTrack(makeTrack());

      // #when
      adapter.simulateNaturalEnd();

      // #then: msSinceLastPlay > 5 000 ms
      expect(Date.now() - adapter.getLastPlayTime()).toBeGreaterThan(5000);
    });

    it('getState returns positionMs 0 after simulateNaturalEnd', async () => {
      // #given a track that has played for 5 seconds
      await adapter.playTrack(makeTrack());
      vi.advanceTimersByTime(5000);

      // #when
      adapter.simulateNaturalEnd();

      // #then
      const state = await adapter.getState();
      expect(state?.positionMs).toBe(0);
    });
  });
});
