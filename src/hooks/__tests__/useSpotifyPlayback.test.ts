import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthExpiredError, UnavailableTrackError } from '@/providers/errors';
import { queueStore } from '@/stores/queueStore';
import type { MediaTrack, ProviderId } from '@/types/domain';

const mockPlayTrack = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn().mockResolvedValue(undefined);
const mockResume = vi.fn().mockResolvedValue(undefined);
const mockPrepareTrack = vi.fn();
const mockInitialize = vi.fn().mockResolvedValue(undefined);

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn((id: string) => ({
      id,
      capabilities: {
        hasNativeQueueSync: id === 'spotify',
      },
      playback: {
        providerId: id,
        playTrack: mockPlayTrack,
        pause: mockPause,
        resume: mockResume,
        prepareTrack: mockPrepareTrack,
        initialize: mockInitialize,
        seek: vi.fn(),
        next: vi.fn(),
        previous: vi.fn(),
        setVolume: vi.fn(),
        getState: vi.fn(),
        subscribe: vi.fn(),
      },
    })),
  },
}));

import { useProviderPlayback } from '../useProviderPlayback';
import { playbackStore } from '@/stores/playbackStore';

function makeMediaTrack(overrides?: Partial<MediaTrack>): MediaTrack {
  return {
    id: 'track-1',
    provider: 'spotify' as ProviderId,
    playbackRef: { provider: 'spotify' as ProviderId, ref: 'spotify:track:track-1' },
    name: 'Test Track',
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 210000,
    image: 'https://example.com/image.jpg',
    ...overrides,
  };
}

describe('useProviderPlayback', () => {
  const mediaTracks: MediaTrack[] = [
    makeMediaTrack({ id: 't1', name: 'Track 1', playbackRef: { provider: 'spotify' as ProviderId, ref: 'spotify:track:t1' } }),
    makeMediaTrack({ id: 't2', name: 'Track 2', playbackRef: { provider: 'spotify' as ProviderId, ref: 'spotify:track:t2' } }),
    makeMediaTrack({ id: 't3', name: 'Track 3', playbackRef: { provider: 'spotify' as ProviderId, ref: 'spotify:track:t3' } }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns early when no media track at index', async () => {
    // #given — queue seeded, but index 99 is out of bounds; the active-provider
    // fallback resolves the provider so the no-track branch (not the
    // no-provider branch) is the one that returns early
    queueStore.replaceQueue(mediaTracks);
    playbackStore.setActiveProviderFallback('spotify');
    const { result } = renderHook(() => useProviderPlayback({}));

    // #when
    await act(async () => {
      await result.current.playTrack(99);
    });

    // #then
    expect(mockPlayTrack).not.toHaveBeenCalled();
  });

  it('commits the queue index on successful playback', async () => {
    // #given
    queueStore.replaceQueue(mediaTracks);
    const { result } = renderHook(() => useProviderPlayback({}));

    // #when
    await act(async () => {
      await result.current.playTrack(1);
    });

    // #then
    expect(mockPlayTrack).toHaveBeenCalledWith(mediaTracks[1], undefined);
    expect(queueStore.getCurrentIndex()).toBe(1);
  });

  it('calls onAuthExpired on AuthExpiredError', async () => {
    // #given — currentIndex seeded to 2 so a failed play of index 0 must
    // leave it untouched
    queueStore.replaceQueue(mediaTracks, { currentIndex: 2 });
    const onAuthExpired = vi.fn();
    mockPlayTrack.mockRejectedValueOnce(new AuthExpiredError('spotify'));

    const { result } = renderHook(() =>
      useProviderPlayback({ onAuthExpired })
    );

    // #when
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then
    expect(onAuthExpired).toHaveBeenCalledWith('spotify');
    expect(queueStore.getCurrentIndex()).toBe(2);
  });

  it('skips to next track on UnavailableTrackError when skipOnError is true', async () => {
    // #given
    queueStore.replaceQueue(mediaTracks);
    mockPlayTrack.mockRejectedValueOnce(new UnavailableTrackError('Track 1'));

    const { result } = renderHook(() => useProviderPlayback({}));

    // #when
    await act(async () => {
      await result.current.playTrack(0, true);
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // #then — recursive call plays track at index 1
    expect(mockPlayTrack).toHaveBeenCalledWith(mediaTracks[1], undefined);
  });

  it('skips to next track on generic error when skipOnError is true', async () => {
    // #given
    queueStore.replaceQueue(mediaTracks);
    mockPlayTrack.mockRejectedValueOnce(new Error('Unknown failure'));

    const { result } = renderHook(() => useProviderPlayback({}));

    // #when
    await act(async () => {
      await result.current.playTrack(0, true);
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // #then
    expect(mockPlayTrack).toHaveBeenCalledWith(mediaTracks[1], undefined);
  });

  it('prefetches the next track after successful playback', async () => {
    // #given
    queueStore.replaceQueue(mediaTracks);
    const { result } = renderHook(() => useProviderPlayback({}));

    // #when
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then
    expect(mockPrepareTrack).toHaveBeenCalledWith(mediaTracks[1]);
  });

  it('pauses previous provider when switching providers', async () => {
    // #given
    const mixedTracks: MediaTrack[] = [
      makeMediaTrack({ id: 'd1', provider: 'dropbox' as ProviderId, playbackRef: { provider: 'dropbox' as ProviderId, ref: '/path/to/file.mp3' } }),
      makeMediaTrack({ id: 's1', provider: 'spotify' as ProviderId, playbackRef: { provider: 'spotify' as ProviderId, ref: 'spotify:track:s1' } }),
    ];
    queueStore.replaceQueue(mixedTracks);

    const { result } = renderHook(() => useProviderPlayback({}));

    // #when
    await act(async () => {
      await result.current.playTrack(0);
    });

    await act(async () => {
      await result.current.playTrack(1);
    });

    // #then
    expect(mockPause).toHaveBeenCalled();
  });

  it('resumes playback via current driving provider', async () => {
    // #given
    queueStore.replaceQueue(mediaTracks);
    const { result } = renderHook(() => useProviderPlayback({}));

    await act(async () => {
      await result.current.playTrack(0);
    });

    mockResume.mockClear();

    // #when
    await act(async () => {
      await result.current.resumePlayback();
    });

    // #then
    expect(mockResume).toHaveBeenCalled();
  });

  it('does not return activateDevice', () => {
    // #given
    const { result } = renderHook(() => useProviderPlayback({}));

    // #when / #then — the hook's surface is exactly playTrack + resumePlayback;
    // provider tracking moved into playbackStore, so no ref leaks out either
    expect(result.current).toHaveProperty('playTrack');
    expect(result.current).toHaveProperty('resumePlayback');
    expect(result.current).not.toHaveProperty('currentPlaybackProviderRef');
    expect(result.current).not.toHaveProperty('activateDevice');
  });
});
