/**
 * Unit tests for DropboxPlaybackAdapter.
 * Tests core playback operations: initialize, playTrack, seek, pause/resume, subscribe.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DropboxPlaybackAdapter } from '../dropboxPlaybackAdapter';
import type { DropboxCatalogAdapter } from '../dropboxCatalogAdapter';
import { makeMediaTrack } from '@/test/fixtures';
import type { PlaybackState } from '@/types/domain';

// Mock DropboxCatalogAdapter
const mockCatalog: Partial<DropboxCatalogAdapter> = {
  getTemporaryLink: vi.fn().mockResolvedValue('https://example.com/stream.mp3'),
  prefetchTemporaryLink: vi.fn(),
  getAlbumArtForAlbum: vi.fn().mockResolvedValue(null),
  cacheAlbumArtForAlbum: vi.fn().mockResolvedValue(undefined),
  resolveAlbumArt: vi.fn().mockResolvedValue(null),
};

// Mock HTML5 Audio API
const mockAudio = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  paused: true,
  ended: false,
  currentTime: 0,
  duration: NaN,
  volume: 1,
  src: '',
  preload: '',
  readyState: 0,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.stubGlobal('Audio', vi.fn(() => mockAudio) as any);
vi.stubGlobal('HTMLMediaElement', { HAVE_METADATA: 1 } as any);

// Mock ID3 parser
vi.mock('@/utils/id3Parser', () => ({
  parseID3: vi.fn().mockReturnValue({}),
}));

// Mock art cache functions
vi.mock('@/providers/dropbox/dropboxArtCache', () => ({
  putDurationMs: vi.fn().mockResolvedValue(undefined),
  putTagMetadata: vi.fn().mockResolvedValue(undefined),
}));

describe('DropboxPlaybackAdapter', () => {
  let adapter: DropboxPlaybackAdapter;
  let listeners: Map<string, vi.Mock>;

  beforeEach(() => {
    vi.clearAllMocks();
    listeners = new Map();

    // Track event listeners for testing
    const eventListeners: { [key: string]: ((event: any) => void)[] } = {};
    mockAudio.addEventListener.mockImplementation((event: string, listener: (e: any) => void) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(listener);
      const mock = vi.fn();
      listeners.set(event, mock);
    });

    // Helper to trigger events
    (mockAudio as any).__triggerEvent = (event: string) => {
      if (eventListeners[event]) {
        eventListeners[event].forEach((listener) => listener({}));
      }
    };

    mockAudio.paused = true;
    mockAudio.ended = false;
    mockAudio.currentTime = 0;
    mockAudio.duration = NaN;
    mockAudio.volume = 1;
    mockAudio.src = '';
    mockAudio.readyState = 0;
    mockAudio.removeEventListener.mockImplementation((event: string, listener: (e: any) => void) => {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter((l) => l !== listener);
      }
    });

    adapter = new DropboxPlaybackAdapter(mockCatalog as DropboxCatalogAdapter);
  });

  afterEach(() => {
    adapter.destroy();
    vi.clearAllMocks();
  });

  it('initialize creates an HTMLAudioElement', async () => {
    await adapter.initialize();
    expect(vi.mocked(global.Audio)).toHaveBeenCalled();
  });

  it('playTrack calls catalog.getTemporaryLink and sets audio src', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });
    await adapter.initialize();

    // #when
    await adapter.playTrack(track);

    // #then
    expect(mockCatalog.getTemporaryLink).toHaveBeenCalledWith(track.playbackRef.ref);
    expect(mockAudio.src).toBe('https://example.com/stream.mp3');
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('seek sets audio.currentTime in seconds', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });
    await adapter.initialize();
    await adapter.playTrack(track);

    // #when
    await adapter.seek(5000);

    // #then
    expect(mockAudio.currentTime).toBe(5);
  });

  it('subscribe receives state updates and returns unsubscribe', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });
    const listener = vi.fn();

    await adapter.initialize();
    await adapter.playTrack(track);
    mockAudio.paused = false;
    mockAudio.duration = 200;

    // #when
    const unsubscribe = adapter.subscribe(listener);

    // Trigger a state change
    (mockAudio as any).__triggerEvent('play');

    // #then
    expect(listener).toHaveBeenCalled();
    const state = listener.mock.calls[0][0] as PlaybackState;
    expect(state.currentTrackId).toBe('track-1');
    expect(state.isPlaying).toBe(true);

    unsubscribe();
    listener.mockClear();
    (mockAudio as any).__triggerEvent('play');
    expect(listener).not.toHaveBeenCalled();
  });

  it('getState returns null before initialize', async () => {
    const state = await adapter.getState();
    expect(state).toBeNull();
  });

  it('pause calls audio.pause', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });
    await adapter.initialize();
    await adapter.playTrack(track);

    // #when
    await adapter.pause();

    // #then
    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('resume calls audio.play', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });
    await adapter.initialize();
    await adapter.playTrack(track);
    mockAudio.play.mockClear();

    // #when
    await adapter.resume();

    // #then
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('setVolume sets audio volume', async () => {
    await adapter.initialize();
    await adapter.setVolume(0.5);

    expect(mockAudio.volume).toBe(0.5);
  });

  it('setVolume clamps volume to 0-1 range', async () => {
    // #given
    await adapter.initialize();

    // #when / #then
    await adapter.setVolume(2.0);
    expect(mockAudio.volume).toBe(1);

    await adapter.setVolume(-0.5);
    expect(mockAudio.volume).toBe(0);
  });

  it('getLastPlayTime returns the timestamp of the last playTrack call', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });
    await adapter.initialize();

    // #when
    const beforePlay = Date.now();
    await adapter.playTrack(track);
    const afterPlay = Date.now();
    const lastTime = adapter.getLastPlayTime();

    // #then
    expect(lastTime).toBeGreaterThanOrEqual(beforePlay);
    expect(lastTime).toBeLessThanOrEqual(afterPlay);
  });

  it('returns valid PlaybackState after playTrack', async () => {
    // #given
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });
    await adapter.initialize();
    mockAudio.paused = false;
    mockAudio.ended = false;
    mockAudio.duration = 210;
    mockAudio.currentTime = 30;

    // #when
    await adapter.playTrack(track);
    const state = await adapter.getState();

    // #then
    expect(state).not.toBeNull();
    expect(state!.currentTrackId).toBe('track-1');
    expect(state!.isPlaying).toBe(true);
    expect(state!.positionMs).toBe(30000);
    expect(state!.durationMs).toBe(210000);
    expect(state!.currentPlaybackRef).toEqual(track.playbackRef);
  });

  describe('prepareTrack', () => {
    const flush = async (): Promise<void> => {
      for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
      }
    };

    it('emits paused state with positionMs and durationMs after metadata loads', async () => {
      // #given
      const track = makeMediaTrack({ id: 'track-hydrate', durationMs: 300000 });
      const listener = vi.fn();
      await adapter.initialize();
      adapter.subscribe(listener);

      // #when
      adapter.prepareTrack(track, { positionMs: 45_000 });
      await flush();

      mockAudio.duration = 200;
      mockAudio.readyState = 1;
      mockAudio.currentTime = 45;
      (mockAudio as any).__triggerEvent('loadedmetadata');
      await flush();

      // #then
      expect(mockAudio.src).toBe('https://example.com/stream.mp3');
      expect(mockAudio.currentTime).toBe(45);
      const hydrateCall = listener.mock.calls.find(([state]) => state?.currentTrackId === 'track-hydrate');
      expect(hydrateCall).toBeDefined();
      const state = hydrateCall![0] as PlaybackState;
      expect(state.isPlaying).toBe(false);
      expect(state.positionMs).toBe(45_000);
      expect(state.durationMs).toBe(200_000);
      expect(state.trackMetadata?.durationMs).toBe(200_000);
    });

    it('omits durationMs metadata when audio.duration is Infinity', async () => {
      // #given
      const track = makeMediaTrack({ id: 'track-live', durationMs: 180_000 });
      const listener = vi.fn();
      await adapter.initialize();
      adapter.subscribe(listener);

      // #when
      adapter.prepareTrack(track, { positionMs: 10_000 });
      await flush();

      mockAudio.duration = Infinity;
      mockAudio.readyState = 1;
      mockAudio.currentTime = 10;
      (mockAudio as any).__triggerEvent('loadedmetadata');
      await flush();

      // #then
      const hydrateCall = listener.mock.calls.find(([state]) => state?.currentTrackId === 'track-live');
      expect(hydrateCall).toBeDefined();
      const state = hydrateCall![0] as PlaybackState;
      expect(state.isPlaying).toBe(false);
      expect(state.positionMs).toBe(10_000);
      expect(state.durationMs).toBe(0);
      expect(state.trackMetadata?.durationMs).toBeUndefined();
    });

    it('does not clobber audio.src when a track is already loaded (next-track prewarm)', async () => {
      // #given
      const current = makeMediaTrack({
        id: 'current',
        playbackRef: { provider: 'dropbox', ref: '/Music/current.mp3' },
      });
      const upcoming = makeMediaTrack({
        id: 'upcoming',
        playbackRef: { provider: 'dropbox', ref: '/Music/upcoming.mp3' },
      });
      vi.mocked(mockCatalog.getTemporaryLink!).mockResolvedValueOnce('https://example.com/current.mp3');
      await adapter.initialize();
      await adapter.playTrack(current);

      // #when
      adapter.prepareTrack(upcoming);
      await flush();

      // #then
      expect(mockAudio.src).toBe('https://example.com/current.mp3');
      expect(mockCatalog.prefetchTemporaryLink).toHaveBeenCalledWith(upcoming.playbackRef.ref);
    });

    it('cancels a pending prepareTrack when a new src is set by playTrack', async () => {
      // #given
      const trackA = makeMediaTrack({
        id: 'track-a',
        playbackRef: { provider: 'dropbox', ref: '/Music/A/01.mp3' },
      });
      const trackB = makeMediaTrack({
        id: 'track-b',
        playbackRef: { provider: 'dropbox', ref: '/Music/B/01.mp3' },
      });
      const listener = vi.fn();
      vi.mocked(mockCatalog.getTemporaryLink!)
        .mockResolvedValueOnce('https://example.com/a.mp3')
        .mockResolvedValueOnce('https://example.com/b.mp3');
      await adapter.initialize();
      adapter.subscribe(listener);

      // #when
      adapter.prepareTrack(trackA, { positionMs: 30_000 });
      await flush();
      // trackA's getTemporaryLink has resolved; src is set. Now kick off playTrack for trackB
      // before the loadedmetadata event for trackA fires.
      await adapter.playTrack(trackB);

      listener.mockClear();

      // Now the stale loadedmetadata for the prior src fires.
      mockAudio.duration = 220;
      mockAudio.readyState = 1;
      (mockAudio as any).__triggerEvent('loadedmetadata');
      await flush();

      // #then
      const staleCall = listener.mock.calls.find(([state]) => state?.currentTrackId === 'track-a');
      expect(staleCall).toBeUndefined();
    });
  });
});
