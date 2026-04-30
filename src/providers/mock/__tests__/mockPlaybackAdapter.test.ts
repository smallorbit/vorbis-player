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
});
