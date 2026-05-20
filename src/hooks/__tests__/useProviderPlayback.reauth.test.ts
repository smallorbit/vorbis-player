import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { PROVIDER_RECONNECTED_EVENT } from '@/constants/events';

const mockPrepareTrack = vi.fn();
const mockPlayTrack = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn().mockResolvedValue(undefined);
const mockResume = vi.fn().mockResolvedValue(undefined);
const mockInitialize = vi.fn().mockResolvedValue(undefined);

vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: vi.fn((id: string) => ({
      id,
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

const mockLoadSession = vi.fn();
vi.mock('@/services/sessionPersistence', () => ({
  loadSession: () => mockLoadSession(),
}));

import { useProviderPlayback } from '../useProviderPlayback';

function makeMediaTrack(overrides?: Partial<MediaTrack>): MediaTrack {
  return {
    id: 'track-1',
    provider: 'spotify' as ProviderId,
    playbackRef: { provider: 'spotify' as ProviderId, ref: 'spotify:track:track-1' },
    name: 'Test Track',
    artists: 'Test Artist',
    album: 'Test Album',
    durationMs: 210000,
    image: '',
    ...overrides,
  };
}

describe('useProviderPlayback — PROVIDER_RECONNECTED_EVENT re-prime', () => {
  const setCurrentTrackIndex = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockLoadSession.mockReset();
  });

  it('calls prepareTrack with the persisted playbackPosition when the snapshot trackId matches', () => {
    // #given — current track is a spotify track, snapshot points at the same id
    const currentTrack = makeMediaTrack({ id: 'sp-1', provider: 'spotify' });
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: [currentTrack] };
    const currentTrackIndexRef: React.MutableRefObject<number> = { current: 0 };

    mockLoadSession.mockReturnValue({
      collectionId: 'c1',
      collectionName: 'C',
      trackIndex: 0,
      trackId: 'sp-1',
      playbackPosition: 45_000,
    });

    renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex, mediaTracksRef, currentTrackIndexRef })
    );

    // #when — dispatch the reconnect event for spotify
    act(() => {
      window.dispatchEvent(
        new CustomEvent(PROVIDER_RECONNECTED_EVENT, { detail: { providerId: 'spotify' } }),
      );
    });

    // #then
    expect(mockPrepareTrack).toHaveBeenCalledTimes(1);
    expect(mockPrepareTrack).toHaveBeenCalledWith(currentTrack, { positionMs: 45_000 });
  });

  it('falls back to positionMs=0 when the snapshot trackId does not match', () => {
    // #given
    const currentTrack = makeMediaTrack({ id: 'sp-1', provider: 'spotify' });
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: [currentTrack] };
    const currentTrackIndexRef: React.MutableRefObject<number> = { current: 0 };

    mockLoadSession.mockReturnValue({
      collectionId: 'c1',
      collectionName: 'C',
      trackIndex: 0,
      trackId: 'different-track',
      playbackPosition: 45_000,
    });

    renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex, mediaTracksRef, currentTrackIndexRef })
    );

    // #when
    act(() => {
      window.dispatchEvent(
        new CustomEvent(PROVIDER_RECONNECTED_EVENT, { detail: { providerId: 'spotify' } }),
      );
    });

    // #then
    expect(mockPrepareTrack).toHaveBeenCalledWith(currentTrack, { positionMs: 0 });
  });

  it('falls back to positionMs=0 when no snapshot is persisted', () => {
    // #given
    const currentTrack = makeMediaTrack({ id: 'sp-1', provider: 'spotify' });
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: [currentTrack] };
    const currentTrackIndexRef: React.MutableRefObject<number> = { current: 0 };

    mockLoadSession.mockReturnValue(null);

    renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex, mediaTracksRef, currentTrackIndexRef })
    );

    // #when
    act(() => {
      window.dispatchEvent(
        new CustomEvent(PROVIDER_RECONNECTED_EVENT, { detail: { providerId: 'spotify' } }),
      );
    });

    // #then
    expect(mockPrepareTrack).toHaveBeenCalledWith(currentTrack, { positionMs: 0 });
  });

  it('does NOT call prepareTrack when the reconnected provider is not the current track provider', () => {
    // #given — current track is spotify, but dropbox just reconnected
    const currentTrack = makeMediaTrack({ id: 'sp-1', provider: 'spotify' });
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: [currentTrack] };
    const currentTrackIndexRef: React.MutableRefObject<number> = { current: 0 };

    mockLoadSession.mockReturnValue(null);

    renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex, mediaTracksRef, currentTrackIndexRef })
    );

    // #when
    act(() => {
      window.dispatchEvent(
        new CustomEvent(PROVIDER_RECONNECTED_EVENT, { detail: { providerId: 'dropbox' } }),
      );
    });

    // #then
    expect(mockPrepareTrack).not.toHaveBeenCalled();
  });

  it('does NOT call prepareTrack when there is no current track', () => {
    // #given — empty queue
    const mediaTracksRef: React.MutableRefObject<MediaTrack[]> = { current: [] };
    const currentTrackIndexRef: React.MutableRefObject<number> = { current: -1 };

    renderHook(() =>
      useProviderPlayback({ setCurrentTrackIndex, mediaTracksRef, currentTrackIndexRef })
    );

    // #when
    act(() => {
      window.dispatchEvent(
        new CustomEvent(PROVIDER_RECONNECTED_EVENT, { detail: { providerId: 'spotify' } }),
      );
    });

    // #then
    expect(mockPrepareTrack).not.toHaveBeenCalled();
  });
});
