import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppleMusicPlaybackAdapter } from '../appleMusicPlaybackAdapter';
import { appleMusicService } from '../appleMusicService';
import { MKPlaybackStates } from '../appleMusicTypes';

vi.mock('../appleMusicService', () => ({
  appleMusicService: {
    ensureLoaded: vi.fn(),
    getInstance: vi.fn(),
  },
}));

describe('AppleMusicPlaybackAdapter', () => {
  let adapter: AppleMusicPlaybackAdapter;
  let mockInstance: Record<string, unknown>;
  const eventListeners = new Map<string, Set<(...args: unknown[]) => void>>();

  beforeEach(() => {
    eventListeners.clear();
    mockInstance = {
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      seekToTime: vi.fn().mockResolvedValue(undefined),
      skipToNextItem: vi.fn().mockResolvedValue(undefined),
      skipToPreviousItem: vi.fn().mockResolvedValue(undefined),
      volume: 0.5,
      nowPlayingItem: null,
      playbackState: MKPlaybackStates.none,
      currentPlaybackTime: 0,
      currentPlaybackDuration: 0,
      setQueue: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!eventListeners.has(event)) eventListeners.set(event, new Set());
        eventListeners.get(event)!.add(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        eventListeners.get(event)?.delete(handler);
      }),
    };

    vi.mocked(appleMusicService.ensureLoaded).mockResolvedValue(mockInstance as never);
    vi.mocked(appleMusicService.getInstance).mockReturnValue(mockInstance as never);
    adapter = new AppleMusicPlaybackAdapter();
  });

  it('has providerId "apple-music"', () => {
    expect(adapter.providerId).toBe('apple-music');
  });

  it('initialize attaches event listeners', async () => {
    await adapter.initialize();
    expect(mockInstance.addEventListener).toHaveBeenCalledWith('playbackStateDidChange', expect.any(Function));
    expect(mockInstance.addEventListener).toHaveBeenCalledWith('nowPlayingItemDidChange', expect.any(Function));
    expect(mockInstance.addEventListener).toHaveBeenCalledWith('playbackTimeDidChange', expect.any(Function));
  });

  it('playTrack sets queue and starts playback', async () => {
    mockInstance.playbackState = MKPlaybackStates.playing;
    await adapter.playTrack({
      id: 'track1',
      provider: 'apple-music',
      playbackRef: { provider: 'apple-music', ref: 'cat.123' },
      name: 'Test Song',
      artists: 'Test Artist',
      album: 'Test Album',
      durationMs: 200000,
    });

    expect(mockInstance.setQueue).toHaveBeenCalledWith({ song: 'cat.123', startPlaying: true });
  });

  it('pause calls instance.pause', async () => {
    await adapter.pause();
    expect(mockInstance.pause).toHaveBeenCalled();
  });

  it('resume calls instance.play', async () => {
    await adapter.resume();
    expect(mockInstance.play).toHaveBeenCalled();
  });

  it('seek converts ms to seconds', async () => {
    await adapter.seek(5000);
    expect(mockInstance.seekToTime).toHaveBeenCalledWith(5);
  });

  it('next calls skipToNextItem', async () => {
    await adapter.next();
    expect(mockInstance.skipToNextItem).toHaveBeenCalled();
  });

  it('previous calls skipToPreviousItem', async () => {
    await adapter.previous();
    expect(mockInstance.skipToPreviousItem).toHaveBeenCalled();
  });

  it('setVolume sets instance volume', async () => {
    await adapter.setVolume(0.7);
    expect(mockInstance.volume).toBe(0.7);
  });

  it('getState maps MusicKit state to PlaybackState', async () => {
    mockInstance.playbackState = MKPlaybackStates.playing;
    mockInstance.currentPlaybackTime = 30;
    mockInstance.currentPlaybackDuration = 240;
    mockInstance.nowPlayingItem = {
      id: 'track1',
      type: 'songs',
      attributes: {
        name: 'Test',
        artistName: 'Artist',
        albumName: 'Album',
        durationInMillis: 240000,
        playParams: { catalogId: 'cat.123' },
      },
    };

    const state = await adapter.getState();
    expect(state).toMatchObject({
      isPlaying: true,
      positionMs: 30000,
      durationMs: 240000,
      currentTrackId: 'track1',
      currentPlaybackRef: { provider: 'apple-music', ref: 'cat.123' },
    });
  });

  it('getState returns null when no instance', async () => {
    vi.mocked(appleMusicService.getInstance).mockReturnValue(null);
    const state = await adapter.getState();
    expect(state).toBeNull();
  });

  it('subscribe notifies listeners on state changes', async () => {
    await adapter.initialize();
    const listener = vi.fn();
    adapter.subscribe(listener);

    mockInstance.playbackState = MKPlaybackStates.playing;
    mockInstance.currentPlaybackTime = 10;
    mockInstance.currentPlaybackDuration = 200;

    // Simulate playbackStateDidChange event
    const handlers = eventListeners.get('playbackStateDidChange');
    expect(handlers).toBeDefined();
    for (const handler of handlers!) {
      handler();
    }

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        isPlaying: true,
        positionMs: 10000,
        durationMs: 200000,
      }),
    );
  });

  it('unsubscribe removes listener', async () => {
    await adapter.initialize();
    const listener = vi.fn();
    const unsubscribe = adapter.subscribe(listener);

    unsubscribe();

    // Trigger event
    const handlers = eventListeners.get('playbackStateDidChange');
    if (handlers) {
      for (const handler of handlers) handler();
    }

    expect(listener).not.toHaveBeenCalled();
  });
});
