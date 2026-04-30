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
    const findHydrateCall = (listener: ReturnType<typeof vi.fn>, trackId: string) =>
      listener.mock.calls.find(([state]) => state?.currentTrackId === trackId);

    it('emits paused state synchronously with track durationMs, then updates to audio durationMs after metadata loads', async () => {
      // #given — track.durationMs = 300_000 (cached); real audio = 200s = 200_000ms
      const track = makeMediaTrack({ id: 'track-hydrate', durationMs: 300_000 });
      const listener = vi.fn();
      await adapter.initialize();
      adapter.subscribe(listener);

      // #when — synchronous emit fires immediately using track.durationMs
      adapter.prepareTrack(track, { positionMs: 45_000 });
      const immediateState = findHydrateCall(listener, 'track-hydrate')![0] as PlaybackState;
      expect(immediateState.durationMs).toBe(300_000);
      expect(immediateState.positionMs).toBe(45_000);
      expect(immediateState.isPlaying).toBe(false);

      // Audio finishes loading — emit fires again with the real duration
      await vi.waitFor(() => expect(mockAudio.src).toBe('https://example.com/stream.mp3'));
      mockAudio.duration = 200;
      mockAudio.readyState = 1;
      mockAudio.currentTime = 45;
      (mockAudio as any).__triggerEvent('loadedmetadata');

      // #then — final state uses the real audio duration; trackMetadata.durationMs updated
      const findLastHydrateCall = () => {
        const calls = listener.mock.calls.filter(([s]) => s?.currentTrackId === 'track-hydrate');
        return calls[calls.length - 1] ?? undefined;
      };
      await vi.waitFor(() => {
        const last = findLastHydrateCall();
        expect(last?.[0]?.durationMs).toBe(200_000);
      });
      const finalState = findLastHydrateCall()![0] as PlaybackState;
      expect(mockAudio.currentTime).toBe(45);
      expect(finalState.isPlaying).toBe(false);
      expect(finalState.positionMs).toBe(45_000);
      expect(finalState.trackMetadata?.durationMs).toBe(200_000);
    });

    it('omits durationMs metadata when audio.duration is Infinity', async () => {
      // #given — track.durationMs = 180_000; audio stream has Infinity duration (live)
      const track = makeMediaTrack({ id: 'track-live', durationMs: 180_000 });
      const listener = vi.fn();
      await adapter.initialize();
      adapter.subscribe(listener);

      // #when — synchronous emit fires immediately using track.durationMs
      adapter.prepareTrack(track, { positionMs: 10_000 });
      const immediateState = findHydrateCall(listener, 'track-live')![0] as PlaybackState;
      expect(immediateState.durationMs).toBe(180_000);

      // Audio loadedmetadata fires with Infinity duration
      await vi.waitFor(() => expect(mockAudio.src).toBe('https://example.com/stream.mp3'));
      mockAudio.duration = Infinity;
      mockAudio.readyState = 1;
      mockAudio.currentTime = 10;
      (mockAudio as any).__triggerEvent('loadedmetadata');

      // #then — final state reports 0 for infinite-duration stream; no trackMetadata.durationMs
      const findLastHydrateCall = () => {
        const calls = listener.mock.calls.filter(([s]) => s?.currentTrackId === 'track-live');
        return calls[calls.length - 1] ?? undefined;
      };
      await vi.waitFor(() => {
        const last = findLastHydrateCall();
        expect(last?.[0]?.durationMs).toBe(0);
      });
      const finalState = findLastHydrateCall()![0] as PlaybackState;
      expect(finalState.isPlaying).toBe(false);
      expect(finalState.positionMs).toBe(10_000);
      expect(finalState.trackMetadata?.durationMs).toBeUndefined();
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

      // #then
      await vi.waitFor(() =>
        expect(mockCatalog.prefetchTemporaryLink).toHaveBeenCalledWith(upcoming.playbackRef.ref),
      );
      expect(mockAudio.src).toBe('https://example.com/current.mp3');
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

      // #when — trackA's src is set and prepareTrack is awaiting loadedmetadata;
      // playTrack(B) supersedes before the event fires.
      adapter.prepareTrack(trackA, { positionMs: 30_000 });
      await vi.waitFor(() => expect(mockAudio.src).toBe('https://example.com/a.mp3'));
      await adapter.playTrack(trackB);
      listener.mockClear();

      // Now the stale loadedmetadata for the prior src fires.
      mockAudio.duration = 220;
      mockAudio.readyState = 1;
      (mockAudio as any).__triggerEvent('loadedmetadata');
      await Promise.resolve();

      // #then
      expect(findHydrateCall(listener, 'track-a')).toBeUndefined();
    });

    it('emits synchronous hydrate state even when getTemporaryLink later rejects', async () => {
      // #given — audio loading is best-effort; the synchronous UI emit still
      // fires so the seek bar shows the saved position, even if audio fails to load.
      const track = makeMediaTrack({
        id: 'track-fail',
        playbackRef: { provider: 'dropbox', ref: '/Music/fail.mp3' },
        durationMs: 210_000,
      });
      const listener = vi.fn();
      vi.mocked(mockCatalog.getTemporaryLink!).mockRejectedValueOnce(new Error('network down'));
      await adapter.initialize();
      adapter.subscribe(listener);

      // #when
      adapter.prepareTrack(track, { positionMs: 20_000 });

      // #then — synchronous emit fired immediately with the saved position + catalog duration
      const state = findHydrateCall(listener, 'track-fail')![0] as PlaybackState;
      expect(state.isPlaying).toBe(false);
      expect(state.positionMs).toBe(20_000);
      expect(state.durationMs).toBe(210_000);

      // Audio fetch fails; no src is ever set
      await vi.waitFor(() =>
        expect(mockCatalog.getTemporaryLink).toHaveBeenCalledWith(track.playbackRef.ref),
      );
      await Promise.resolve();
      expect(mockAudio.src).toBe('');
    });
  });

  describe('probePlayable', () => {
    it('returns true when getTemporaryLink resolves', async () => {
      // #given — live file: catalog hands back a fresh download link
      const track = makeMediaTrack({
        id: 'track-ok',
        playbackRef: { provider: 'dropbox', ref: '/Music/ok.mp3' },
      });
      vi.mocked(mockCatalog.getTemporaryLink!).mockResolvedValueOnce('https://example.com/ok.mp3');

      // #when
      const result = await adapter.probePlayable(track);

      // #then
      expect(result).toBe(true);
      expect(mockCatalog.getTemporaryLink).toHaveBeenCalledWith('/Music/ok.mp3');
    });

    it('returns false when getTemporaryLink rejects (file moved/gone)', async () => {
      // #given — catalog couldn't find the file (moved/renamed/deleted)
      const track = makeMediaTrack({
        id: 'track-gone',
        playbackRef: { provider: 'dropbox', ref: '/Music/gone.mp3' },
      });
      vi.mocked(mockCatalog.getTemporaryLink!).mockRejectedValueOnce(
        new Error('path_lookup/not_found'),
      );

      // #when
      const result = await adapter.probePlayable(track);

      // #then
      expect(result).toBe(false);
    });

    it('rethrows AuthExpiredError so the caller can abort hydrate', async () => {
      // #given — Dropbox refresh-token exchange failed mid-probe
      const { AuthExpiredError } = await import('@/providers/errors');
      const track = makeMediaTrack({
        id: 'track-auth',
        playbackRef: { provider: 'dropbox', ref: '/Music/auth.mp3' },
      });
      vi.mocked(mockCatalog.getTemporaryLink!).mockRejectedValueOnce(
        new AuthExpiredError('dropbox'),
      );

      // #when / #then
      await expect(adapter.probePlayable(track)).rejects.toBeInstanceOf(AuthExpiredError);
    });
  });
});
