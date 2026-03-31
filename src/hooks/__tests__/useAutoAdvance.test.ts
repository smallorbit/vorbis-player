import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PlaybackState } from '@/types/domain';

const mockSubscribe = vi.fn();

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn(),
  ProviderProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    getAll: vi.fn().mockReturnValue([]),
    get: vi.fn(),
  },
}));

import { useAutoAdvance } from '../useAutoAdvance';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import { makeTrack, makeProviderDescriptor } from '@/test/fixtures';
import { ProviderWrapper } from '@/test/providerTestUtils';

const opts = { wrapper: ProviderWrapper };

describe('useAutoAdvance', () => {
  let playTrack: ReturnType<typeof vi.fn>;
  const tracks = [makeTrack({ id: 't1' }), makeTrack({ id: 't2' }), makeTrack({ id: 't3' })];
  let providerStateCallback: ((state: PlaybackState | null) => void) | null = null;

  beforeEach(() => {
    playTrack = vi.fn();
    vi.clearAllMocks();
    vi.useFakeTimers();
    providerStateCallback = null;

    mockSubscribe.mockImplementation((callback: (state: PlaybackState | null) => void) => {
      providerStateCallback = callback;
      return vi.fn(); // unsubscribe function
    });

    const mockDescriptor = makeProviderDescriptor({
      playback: {
        providerId: 'spotify',
        initialize: vi.fn().mockResolvedValue(undefined),
        playTrack: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        seek: vi.fn().mockResolvedValue(undefined),
        next: vi.fn().mockResolvedValue(undefined),
        previous: vi.fn().mockResolvedValue(undefined),
        setVolume: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockResolvedValue(null),
        subscribe: mockSubscribe,
        getLastPlayTime: vi.fn().mockReturnValue(0),
      },
    });

    vi.mocked(useProviderContext).mockReturnValue({
      chosenProviderId: 'spotify',
      activeProviderId: 'spotify',
      activeDescriptor: mockDescriptor,
      setActiveProviderId: vi.fn(),
      setProviderSwitchInterceptor: vi.fn(),
      registry: { get: vi.fn(), getAll: vi.fn(), has: vi.fn() },
      needsProviderSelection: false,
      enabledProviderIds: ['spotify'],
      toggleProvider: vi.fn(),
      isProviderEnabled: vi.fn(),
      hasMultipleProviders: false,
      getDescriptor: vi.fn(),
      connectedProviderIds: ['spotify'],
      fallthroughNotification: null,
      dismissFallthroughNotification: vi.fn(),
    });

    vi.mocked(providerRegistry.getAll).mockReturnValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not subscribe when enabled=false', () => {
    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 0, playTrack, enabled: false }),
      opts
    );

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe when tracks is empty', () => {
    renderHook(() =>
      useAutoAdvance({ tracks: [], currentTrackIndex: 0, playTrack }),
      opts
    );

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('advances when timeRemaining <= endThreshold', () => {
    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 0, playTrack, endThreshold: 2000 }),
      opts
    );

    expect(mockSubscribe).toHaveBeenCalled();

    // Simulate near-end: position 208500, duration 210000, timeRemaining = 1500ms
    providerStateCallback?.({
      isPlaying: true,
      positionMs: 208500,
      durationMs: 210000,
      currentTrackId: 't1',
      currentPlaybackRef: {
        provider: 'spotify',
        ref: 'spotify:track:t1',
      },
    });

    vi.advanceTimersByTime(500);
    expect(playTrack).toHaveBeenCalledWith(1, true);
  });

  it('advances on pause-at-position-0 (natural track end)', () => {
    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 0, playTrack }),
      opts
    );

    expect(mockSubscribe).toHaveBeenCalled();

    // Simulate "was playing" state first
    providerStateCallback?.({
      isPlaying: true,
      positionMs: 100000,
      durationMs: 210000,
      currentTrackId: 't1',
      currentPlaybackRef: {
        provider: 'spotify',
        ref: 'spotify:track:t1',
      },
    });

    // Then simulate natural end: paused at position 0
    providerStateCallback?.({
      isPlaying: false,
      positionMs: 0,
      durationMs: 210000,
      currentTrackId: 't1',
      currentPlaybackRef: {
        provider: 'spotify',
        ref: 'spotify:track:t1',
      },
    });

    vi.advanceTimersByTime(500);
    expect(playTrack).toHaveBeenCalledWith(1, true);
  });

  it('does NOT advance if msSinceLastPlay < PLAY_COOLDOWN_MS', () => {
    // Record current time before hook setup
    const recentPlayTime = Date.now();

    const mockDescriptor = makeProviderDescriptor({
      playback: {
        providerId: 'spotify',
        initialize: vi.fn().mockResolvedValue(undefined),
        playTrack: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        seek: vi.fn().mockResolvedValue(undefined),
        next: vi.fn().mockResolvedValue(undefined),
        previous: vi.fn().mockResolvedValue(undefined),
        setVolume: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockResolvedValue(null),
        subscribe: mockSubscribe,
        getLastPlayTime: vi.fn().mockReturnValue(recentPlayTime), // Very recent (within cooldown)
      },
    });

    // Also mock providerRegistry.get to return the descriptor for 'spotify'
    vi.mocked(providerRegistry.get).mockReturnValue(mockDescriptor);

    vi.mocked(useProviderContext).mockReturnValue({
      chosenProviderId: 'spotify',
      activeProviderId: 'spotify',
      activeDescriptor: mockDescriptor,
      setActiveProviderId: vi.fn(),
      setProviderSwitchInterceptor: vi.fn(),
      registry: { get: vi.fn(), getAll: vi.fn(), has: vi.fn() },
      needsProviderSelection: false,
      enabledProviderIds: ['spotify'],
      toggleProvider: vi.fn(),
      isProviderEnabled: vi.fn(),
      hasMultipleProviders: false,
      getDescriptor: vi.fn(),
      connectedProviderIds: ['spotify'],
      fallthroughNotification: null,
      dismissFallthroughNotification: vi.fn(),
    });

    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 0, playTrack }),
      opts
    );

    // Simulate "was playing"
    providerStateCallback?.({
      isPlaying: true,
      positionMs: 100000,
      durationMs: 210000,
      currentTrackId: 't1',
      currentPlaybackRef: {
        provider: 'spotify',
        ref: 'spotify:track:t1',
      },
    });

    // Then simulate pause at 0 (but within cooldown)
    providerStateCallback?.({
      isPlaying: false,
      positionMs: 0,
      durationMs: 210000,
      currentTrackId: 't1',
      currentPlaybackRef: {
        provider: 'spotify',
        ref: 'spotify:track:t1',
      },
    });

    vi.advanceTimersByTime(500);
    expect(playTrack).not.toHaveBeenCalled();
  });

  it('stops at the end of the queue instead of wrapping', () => {
    renderHook(() =>
      useAutoAdvance({ tracks, currentTrackIndex: 2, playTrack, endThreshold: 2000 }),
      opts
    );

    expect(mockSubscribe).toHaveBeenCalled();

    providerStateCallback?.({
      isPlaying: true,
      positionMs: 209000,
      durationMs: 210000,
      currentTrackId: 't3',
      currentPlaybackRef: {
        provider: 'spotify',
        ref: 'spotify:track:t3',
      },
    });

    vi.advanceTimersByTime(500);
    expect(playTrack).not.toHaveBeenCalled();
  });
});
