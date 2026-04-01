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
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.stubGlobal('Audio', vi.fn(() => mockAudio) as any);

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
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });

    await adapter.initialize();
    await adapter.playTrack(track);

    expect(mockCatalog.getTemporaryLink).toHaveBeenCalledWith(track.playbackRef.ref);
    expect(mockAudio.src).toBe('https://example.com/stream.mp3');
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('seek sets audio.currentTime in seconds', async () => {
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });

    await adapter.initialize();
    await adapter.playTrack(track);
    await adapter.seek(5000);

    expect(mockAudio.currentTime).toBe(5);
  });

  it('subscribe receives state updates and returns unsubscribe', async () => {
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });
    const listener = vi.fn();

    await adapter.initialize();
    await adapter.playTrack(track);
    mockAudio.paused = false;
    mockAudio.duration = 200;

    const unsubscribe = adapter.subscribe(listener);

    // Trigger a state change
    (mockAudio as any).__triggerEvent('play');

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
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });

    await adapter.initialize();
    await adapter.playTrack(track);
    await adapter.pause();

    expect(mockAudio.pause).toHaveBeenCalled();
  });

  it('resume calls audio.play', async () => {
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });

    await adapter.initialize();
    await adapter.playTrack(track);
    mockAudio.play.mockClear();

    await adapter.resume();

    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('setVolume sets audio volume', async () => {
    await adapter.initialize();
    await adapter.setVolume(0.5);

    expect(mockAudio.volume).toBe(0.5);
  });

  it('setVolume clamps volume to 0-1 range', async () => {
    await adapter.initialize();

    await adapter.setVolume(2.0);
    expect(mockAudio.volume).toBe(1);

    await adapter.setVolume(-0.5);
    expect(mockAudio.volume).toBe(0);
  });

  it('getLastPlayTime returns the timestamp of the last playTrack call', async () => {
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });

    await adapter.initialize();
    const beforePlay = Date.now();
    await adapter.playTrack(track);
    const afterPlay = Date.now();
    const lastTime = adapter.getLastPlayTime();

    expect(lastTime).toBeGreaterThanOrEqual(beforePlay);
    expect(lastTime).toBeLessThanOrEqual(afterPlay);
  });

  it('returns valid PlaybackState after playTrack', async () => {
    const track = makeMediaTrack({ id: 'track-1', name: 'Test Track', artists: 'Test Artist' });

    await adapter.initialize();
    mockAudio.paused = false;
    mockAudio.ended = false;
    mockAudio.duration = 210;
    mockAudio.currentTime = 30;

    await adapter.playTrack(track);
    const state = await adapter.getState();

    expect(state).not.toBeNull();
    expect(state!.currentTrackId).toBe('track-1');
    expect(state!.isPlaying).toBe(true);
    expect(state!.positionMs).toBe(30000);
    expect(state!.durationMs).toBe(210000);
    expect(state!.currentPlaybackRef).toEqual(track.playbackRef);
  });
});
