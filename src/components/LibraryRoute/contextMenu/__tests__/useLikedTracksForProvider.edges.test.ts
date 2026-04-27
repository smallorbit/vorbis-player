/**
 * Edge-case tests for useLikedTracksForProvider beyond builder-2's baseline.
 *
 * Covers:
 *  - resetLikedTracksCache() forces a re-fetch on next call
 *  - cache survives consumer re-render via renderHook rerender (module-scoped)
 *  - different provider keys do not collide after reset
 */

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

describe('useLikedTracksForProvider edges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLikedTracksCache();
    mockFetchLiked.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resetLikedTracksCache forces a re-fetch on next call', async () => {
    // #given — first call populates cache
    mockFetchLiked.mockResolvedValue([{ id: 't1' } as MediaTrack]);
    const { result } = renderHook(() => useLikedTracksForProvider());

    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });
    expect(mockFetchLiked).toHaveBeenCalledTimes(1);

    // #when — cache cleared mid-TTL, then re-call
    resetLikedTracksCache();
    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });

    // #then — fetched again despite still being inside the 60s TTL
    expect(mockFetchLiked).toHaveBeenCalledTimes(2);
  });

  it('cache survives consumer re-render (module-scoped, not hook-scoped)', async () => {
    // #given
    mockFetchLiked.mockResolvedValue([{ id: 't1' } as MediaTrack]);
    const { result, rerender } = renderHook(() => useLikedTracksForProvider());

    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });
    expect(mockFetchLiked).toHaveBeenCalledTimes(1);

    // #when — consumer re-renders (which would invalidate hook-scoped state)
    rerender();
    await act(async () => {
      await result.current.loadLikedTracks('spotify');
    });

    // #then — cache survived: still 1 fetch
    expect(mockFetchLiked).toHaveBeenCalledTimes(1);
  });

  it('cache is shared across separate hook instances (module-scoped)', async () => {
    // #given — instance A fetches
    mockFetchLiked.mockResolvedValue([{ id: 's1' } as MediaTrack]);
    const a = renderHook(() => useLikedTracksForProvider());
    await act(async () => {
      await a.result.current.loadLikedTracks('spotify');
    });
    expect(mockFetchLiked).toHaveBeenCalledTimes(1);

    // #when — independent hook instance B requests the same provider
    const b = renderHook(() => useLikedTracksForProvider());
    await act(async () => {
      await b.result.current.loadLikedTracks('spotify');
    });

    // #then — B reads from shared cache, no second fetch
    expect(mockFetchLiked).toHaveBeenCalledTimes(1);
  });

  it('reset followed by per-provider calls fetches each provider independently', async () => {
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

    // #then
    expect(mockFetchLiked).toHaveBeenCalledTimes(2);
    expect(mockFetchLiked).toHaveBeenNthCalledWith(1, 'spotify', undefined);
    expect(mockFetchLiked).toHaveBeenNthCalledWith(2, 'dropbox', undefined);
  });

  it('passes through abort signal to underlying fetcher', async () => {
    // #given
    mockFetchLiked.mockResolvedValue([]);
    const { result } = renderHook(() => useLikedTracksForProvider());
    const controller = new AbortController();

    // #when
    await act(async () => {
      await result.current.loadLikedTracks('spotify', controller.signal);
    });

    // #then
    expect(mockFetchLiked).toHaveBeenCalledWith('spotify', controller.signal);
  });
});
