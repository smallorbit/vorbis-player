import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { makeTrack } from '@/test/fixtures';
import type { ProviderDescriptor } from '@/types/providers';
import type { MediaTrack } from '@/types/domain';

import { usePlayback } from '../usePlayback';

function makeMediaTrack(overrides: Partial<MediaTrack> = {}): MediaTrack {
  return {
    id: 't1',
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: 'spotify:track:t1' },
    name: 'Track 1',
    artists: 'Artist',
    album: 'Album',
    durationMs: 200000,
    ...overrides,
  };
}

function makeDescriptor(playTrackImpl?: (t: MediaTrack) => Promise<void>): ProviderDescriptor {
  return {
    id: 'spotify',
    displayName: 'Spotify',
    capabilities: { hasSaveTrack: true, hasExternalLink: true, hasLikedCollection: true },
    auth: {} as ProviderDescriptor['auth'],
    catalog: {} as ProviderDescriptor['catalog'],
    playback: {
      providerId: 'spotify',
      playTrack: playTrackImpl ?? vi.fn().mockResolvedValue(undefined),
      playCollection: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn().mockResolvedValue(undefined),
      seek: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      setVolume: vi.fn(),
      getState: vi.fn().mockResolvedValue(null),
      subscribe: vi.fn(() => () => {}),
      destroy: vi.fn(),
      initialize: vi.fn(),
    },
  };
}

describe('usePlayback', () => {
  const tracks = [
    makeTrack({ id: 't1', uri: 'spotify:track:t1', name: 'Track 1' }),
    makeTrack({ id: 't2', uri: 'spotify:track:t2', name: 'Track 2' }),
    makeTrack({ id: 't3', uri: 'spotify:track:t3', name: 'Track 3' }),
  ];
  const setCurrentTrackIndex = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('returns early when track index out of bounds', async () => {
    const descriptor = makeDescriptor();
    const mediaTracksRef = { current: [] as MediaTrack[] };

    const { result } = renderHook(() =>
      usePlayback({ tracks, setCurrentTrackIndex, activeDescriptor: descriptor, mediaTracksRef })
    );

    await act(async () => {
      await result.current.playTrack(99);
    });

    expect(descriptor.playback.playTrack).not.toHaveBeenCalled();
  });

  it('calls playTrack on descriptor and sets track index on success', async () => {
    const descriptor = makeDescriptor();
    const mediaTracks = tracks.map((t) => makeMediaTrack({ id: t.id, playbackRef: { provider: 'spotify', ref: t.uri } }));
    const mediaTracksRef = { current: mediaTracks };

    const { result } = renderHook(() =>
      usePlayback({ tracks, setCurrentTrackIndex, activeDescriptor: descriptor, mediaTracksRef })
    );

    await act(async () => {
      await result.current.playTrack(1);
    });

    expect(descriptor.playback.playTrack).toHaveBeenCalledWith(mediaTracks[1]);
    expect(setCurrentTrackIndex).toHaveBeenCalledWith(1);
  });

  it('skips to next track on error when skipOnError is enabled', async () => {
    const descriptor = makeDescriptor(
      vi.fn()
        .mockRejectedValueOnce(new Error('playback failed'))
        .mockResolvedValueOnce(undefined)
    );
    const mediaTracks = tracks.map((t) => makeMediaTrack({ id: t.id, playbackRef: { provider: 'spotify', ref: t.uri } }));
    const mediaTracksRef = { current: mediaTracks };

    const { result } = renderHook(() =>
      usePlayback({ tracks, setCurrentTrackIndex, activeDescriptor: descriptor, mediaTracksRef })
    );

    await act(async () => {
      await result.current.playTrack(0, true);
    });

    // Should schedule skip after 500ms
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(descriptor.playback.playTrack).toHaveBeenCalledTimes(2);
    expect(descriptor.playback.playTrack).toHaveBeenLastCalledWith(mediaTracks[1]);
  });

  it('does not skip when skipOnError is false', async () => {
    const descriptor = makeDescriptor(vi.fn().mockRejectedValue(new Error('fail')));
    const mediaTracks = [makeMediaTrack()];
    const mediaTracksRef = { current: mediaTracks };

    const { result } = renderHook(() =>
      usePlayback({ tracks: [tracks[0]], setCurrentTrackIndex, activeDescriptor: descriptor, mediaTracksRef })
    );

    await act(async () => {
      await result.current.playTrack(0, false);
    });

    expect(descriptor.playback.playTrack).toHaveBeenCalledTimes(1);
    // No skip scheduled
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(descriptor.playback.playTrack).toHaveBeenCalledTimes(1);
  });

  it('builds MediaTrack from Track when mediaTracksRef is empty', async () => {
    const descriptor = makeDescriptor();
    const mediaTracksRef = { current: [] as MediaTrack[] };

    const { result } = renderHook(() =>
      usePlayback({ tracks, setCurrentTrackIndex, activeDescriptor: descriptor, mediaTracksRef })
    );

    await act(async () => {
      await result.current.playTrack(0);
    });

    expect(descriptor.playback.playTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', name: 'Track 1' })
    );
    expect(setCurrentTrackIndex).toHaveBeenCalledWith(0);
  });
});
