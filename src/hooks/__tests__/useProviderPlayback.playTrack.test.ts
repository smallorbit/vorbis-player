import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { ProviderCapabilities } from '@/types/providers';

const mockOnQueueChanged = vi.fn();
const mockPlayTrack = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn().mockResolvedValue(undefined);
const mockResume = vi.fn().mockResolvedValue(undefined);

function makeDescriptor(capabilities: Partial<ProviderCapabilities> = {}) {
  return {
    id: 'spotify' as ProviderId,
    capabilities: {
      hasNativeQueueSync: false,
      hasExternalLink: false,
      ...capabilities,
    },
    playback: {
      providerId: 'spotify' as ProviderId,
      playTrack: mockPlayTrack,
      onQueueChanged: mockOnQueueChanged,
      pause: mockPause,
      resume: mockResume,
      seek: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      setVolume: vi.fn(),
      getState: vi.fn(),
      subscribe: vi.fn(),
    },
  };
}

const mockRegistryGet = vi.fn();

vi.mock('@/providers/registry', () => ({
  providerRegistry: { get: (...args: unknown[]) => mockRegistryGet(...args) },
}));

vi.mock('@/services/sessionPersistence', () => ({
  loadSession: () => null,
}));

import { useProviderPlayback } from '../useProviderPlayback';

function makeTrack(id = 'track-1', provider: ProviderId = 'spotify' as ProviderId): MediaTrack {
  return {
    id,
    provider,
    playbackRef: { provider, ref: `spotify:track:${id}` },
    name: 'Test Track',
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 180000,
    image: '',
  };
}

describe('useProviderPlayback — onQueueChanged capability gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onQueueChanged when hasNativeQueueSync is true', async () => {
    // #given — provider declares hasNativeQueueSync
    const track = makeTrack();
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: [track] };
    mockRegistryGet.mockReturnValue(makeDescriptor({ hasNativeQueueSync: true }));

    const { result } = renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex: vi.fn(), mediaTracksRef }),
    );

    // #when
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then
    expect(mockOnQueueChanged).toHaveBeenCalledTimes(1);
    expect(mockOnQueueChanged).toHaveBeenCalledWith([track], 0);
  });

  it('does NOT call onQueueChanged when hasNativeQueueSync is false', async () => {
    // #given — provider does not declare hasNativeQueueSync
    const track = makeTrack();
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: [track] };
    mockRegistryGet.mockReturnValue(makeDescriptor({ hasNativeQueueSync: false }));

    const { result } = renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex: vi.fn(), mediaTracksRef }),
    );

    // #when
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then
    expect(mockOnQueueChanged).not.toHaveBeenCalled();
  });

  it('does NOT call onQueueChanged when hasNativeQueueSync is absent', async () => {
    // #given — provider omits hasNativeQueueSync entirely
    const track = makeTrack();
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: [track] };
    mockRegistryGet.mockReturnValue(makeDescriptor({}));

    const { result } = renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex: vi.fn(), mediaTracksRef }),
    );

    // #when
    await act(async () => {
      await result.current.playTrack(0);
    });

    // #then
    expect(mockOnQueueChanged).not.toHaveBeenCalled();
  });
});
