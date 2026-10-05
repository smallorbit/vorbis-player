import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PlaybackSnapshot } from '@/stores/playbackStore';
import { makeTrack } from '@/test/fixtures';
import { logCaughtError } from '@/utils/logCaughtError';
import { useMediaSession, type MediaSessionHandlers } from '../useMediaSession';

const store = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const snapshot: PlaybackSnapshot = {
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    currentTrackId: null,
    drivingProviderId: null,
  };
  return { listeners, snapshot, seek: vi.fn(async () => {}) };
});

vi.mock('@/utils/logCaughtError', () => ({ logCaughtError: vi.fn() }));

vi.mock('@/stores/playbackStore', () => ({
  playbackStore: {
    getSnapshot: () => store.snapshot,
    subscribe: (listener: () => void) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    seek: store.seek,
    __resetForTests: () => {},
  },
}));

function emit(next: Partial<PlaybackSnapshot>): void {
  store.snapshot = { ...store.snapshot, ...next };
  act(() => {
    for (const listener of store.listeners) listener();
  });
}

class FakeMediaMetadata {
  title: string;
  artist: string;
  album: string;
  artwork: MediaImage[];
  constructor(init: MediaMetadataInit) {
    this.title = init.title ?? '';
    this.artist = init.artist ?? '';
    this.album = init.album ?? '';
    this.artwork = [...(init.artwork ?? [])];
  }
}

function installFakeMediaSession() {
  const handlers = new Map<MediaSessionAction, MediaSessionActionHandler>();
  const session = {
    metadata: null as FakeMediaMetadata | null,
    playbackState: 'none' as MediaSessionPlaybackState,
    setActionHandler: vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      if (handler) handlers.set(action, handler);
      else handlers.delete(action);
    }),
    setPositionState: vi.fn(),
  };
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  vi.stubGlobal('MediaMetadata', FakeMediaMetadata);
  return { session, handlers };
}

function makeHandlers(): MediaSessionHandlers {
  return { onPlay: vi.fn(), onPause: vi.fn(), onNext: vi.fn(), onPrevious: vi.fn() };
}

describe('useMediaSession', () => {
  let fake: ReturnType<typeof installFakeMediaSession>;

  beforeEach(() => {
    store.snapshot = { isPlaying: false, positionMs: 0, durationMs: 0, currentTrackId: null, drivingProviderId: null };
    store.seek.mockClear();
    fake = installFakeMediaSession();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaSession');
    vi.unstubAllGlobals();
  });

  it('publishes the current track as metadata', () => {
    // #given
    const track = makeTrack({ name: 'Song', artists: 'Band', album: 'Record', image: 'https://i.scdn.co/image/x' });

    // #when
    renderHook(() => useMediaSession(track, makeHandlers()));

    // #then
    expect(fake.session.metadata).toMatchObject({
      title: 'Song',
      artist: 'Band',
      album: 'Record',
      artwork: [{ src: 'https://i.scdn.co/image/x' }],
    });
  });

  it('clears metadata when there is no track', () => {
    // #when
    renderHook(() => useMediaSession(null, makeHandlers()));

    // #then
    expect(fake.session.metadata).toBeNull();
  });

  it('routes OS transport actions to the playback handlers', () => {
    // #given
    const handlers = makeHandlers();
    renderHook(() => useMediaSession(makeTrack(), handlers));

    // #when
    for (const action of ['play', 'pause', 'nexttrack', 'previoustrack'] as const) {
      fake.handlers.get(action)?.({ action });
    }

    // #then
    expect(handlers.onPlay).toHaveBeenCalledOnce();
    expect(handlers.onPause).toHaveBeenCalledOnce();
    expect(handlers.onNext).toHaveBeenCalledOnce();
    expect(handlers.onPrevious).toHaveBeenCalledOnce();
  });

  it('seeks through the playback store in milliseconds, on the track provider', () => {
    // #given
    renderHook(() => useMediaSession(makeTrack({ provider: 'dropbox' }), makeHandlers()));

    // #when
    fake.handlers.get('seekto')?.({ action: 'seekto', seekTime: 42.5 });

    // #then
    expect(store.seek).toHaveBeenCalledWith(42500, 'dropbox');
  });

  it('mirrors play state and position from store emits', () => {
    // #given
    renderHook(() => useMediaSession(makeTrack(), makeHandlers()));

    // #when
    emit({ isPlaying: true, positionMs: 30_000, durationMs: 200_000 });

    // #then
    expect(fake.session.playbackState).toBe('playing');
    expect(fake.session.setPositionState).toHaveBeenLastCalledWith({
      duration: 200,
      position: 30,
      playbackRate: 1,
    });
  });

  it('clears position state until the duration is known and clamps overshoot', () => {
    // #given
    renderHook(() => useMediaSession(makeTrack(), makeHandlers()));

    // #when
    emit({ isPlaying: true, positionMs: 5_000, durationMs: 0 });
    const callWithoutDuration = fake.session.setPositionState.mock.lastCall;
    emit({ positionMs: 210_000, durationMs: 200_000 });

    // #then — an unknown duration clears position state instead of keeping the last track's
    expect(callWithoutDuration).toEqual([]);
    expect(fake.session.setPositionState).toHaveBeenLastCalledWith({
      duration: 200,
      position: 200,
      playbackRate: 1,
    });
  });

  it('removes its handlers and resets state on unmount', () => {
    // #given
    const { unmount } = renderHook(() => useMediaSession(makeTrack(), makeHandlers()));

    // #when
    unmount();

    // #then
    expect(fake.handlers.size).toBe(0);
    expect(fake.session.playbackState).toBe('none');
    expect(fake.session.metadata).toBeNull();
  });

  it('logs instead of rejecting when an OS seek fails', async () => {
    // #given
    const failure = new Error('network down');
    store.seek.mockRejectedValueOnce(failure);
    renderHook(() => useMediaSession(makeTrack(), makeHandlers()));

    // #when
    fake.handlers.get('seekto')?.({ action: 'seekto', seekTime: 10 });

    // #then
    await vi.waitFor(() => expect(logCaughtError).toHaveBeenCalledWith('useMediaSession.seekto', failure));
  });

  it('survives a browser that rejects an action', () => {
    // #given
    fake.session.setActionHandler.mockImplementation((action: MediaSessionAction) => {
      if (action === 'seekto') throw new TypeError('not supported');
    });

    // #when / #then
    expect(() => renderHook(() => useMediaSession(makeTrack(), makeHandlers()))).not.toThrow();
  });

  it('does nothing without the Media Session API', () => {
    // #given
    Reflect.deleteProperty(navigator, 'mediaSession');

    // #when / #then
    expect(() => renderHook(() => useMediaSession(makeTrack(), makeHandlers()))).not.toThrow();
  });
});
