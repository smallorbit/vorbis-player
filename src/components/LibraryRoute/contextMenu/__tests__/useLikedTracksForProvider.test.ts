import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MediaTrack } from '@/types/domain';

const { mockFetchLiked } = vi.hoisted(() => ({
  mockFetchLiked: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  fetchLikedForProvider: (...args: unknown[]) => mockFetchLiked(...args),
}));

import {
  resetLikedTracksCache,
  useLikedTracksForProvider,
} from '../useLikedTracksForProvider';

describe('useLikedTracksForProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLikedTracksCache();
    mockFetchLiked.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches via fetchLikedForProvider on first call', async () => {
    // #given
    const tracks: MediaTrack[] = [{ id: 't1' } as MediaTrack];
    mockFetchLiked.mockResolvedValue(tracks);
    const { result } = renderHook(() => useLikedTracksForProvider());

    // #when
    let returned: MediaTrack[] = [];
    await act(async () => {
      returned = await result.current.loadLikedTracks('spotify');
    });

    // #then
    expect(mockFetchLiked).toHaveBeenCalledTimes(1);
    expect(returned).toEqual(tracks);
  });

  it('returns cached value on second call within TTL without re-fetching', async () => {
    // #given
    mockFetchLiked.mockResolvedValue([{ id: 't1' } as MediaTrack]);
    const { result } = renderHook(() => useLikedTracksForProvider());

    // #when
    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });
    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });

    // #then
    expect(mockFetchLiked).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL elapses', async () => {
    // #given
    mockFetchLiked.mockResolvedValue([{ id: 't1' } as MediaTrack]);
    const { result } = renderHook(() => useLikedTracksForProvider());

    // #when
    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });
    vi.setSystemTime(Date.now() + 60_001);
    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });

    // #then
    expect(mockFetchLiked).toHaveBeenCalledTimes(2);
  });

  it('caches per-provider independently', async () => {
    // #given
    mockFetchLiked
      .mockResolvedValueOnce([{ id: 's1' } as MediaTrack])
      .mockResolvedValueOnce([{ id: 'd1' } as MediaTrack]);
    const { result } = renderHook(() => useLikedTracksForProvider());

    // #when
    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });
    await act(async () => {
      await result.current.loadLikedTracks('dropbox');
    });
    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });

    // #then
    expect(mockFetchLiked).toHaveBeenCalledTimes(2);
  });
});
