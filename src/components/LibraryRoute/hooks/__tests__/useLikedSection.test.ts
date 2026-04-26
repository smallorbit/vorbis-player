import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { mockUnified, mockLibrarySync } = vi.hoisted(() => ({
  mockUnified: vi.fn(),
  mockLibrarySync: vi.fn(),
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: () => mockUnified(),
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: () => mockLibrarySync(),
}));

import { useLikedSection } from '../useLikedSection';

describe('useLikedSection', () => {
  beforeEach(() => {
    mockUnified.mockReset();
    mockLibrarySync.mockReset();
  });

  it('uses single-provider count when unified mode is inactive', () => {
    // #given
    mockUnified.mockReturnValue({ isUnifiedLikedActive: false, totalCount: 0, isLoading: false });
    mockLibrarySync.mockReturnValue({
      likedSongsCount: 42,
      likedSongsPerProvider: [{ provider: 'spotify', count: 42 }],
      isLikedSongsSyncing: false,
    });

    // #when
    const { result } = renderHook(() => useLikedSection());

    // #then
    expect(result.current.totalCount).toBe(42);
    expect(result.current.isUnified).toBe(false);
  });

  it('uses unified totalCount when unified mode is active', () => {
    // #given
    mockUnified.mockReturnValue({ isUnifiedLikedActive: true, totalCount: 100, isLoading: false });
    mockLibrarySync.mockReturnValue({
      likedSongsCount: 42,
      likedSongsPerProvider: [
        { provider: 'spotify', count: 42 },
        { provider: 'dropbox', count: 58 },
      ],
      isLikedSongsSyncing: false,
    });

    // #when
    const { result } = renderHook(() => useLikedSection());

    // #then
    expect(result.current.totalCount).toBe(100);
    expect(result.current.isUnified).toBe(true);
  });

  it('switches isLoading source between unified loading and library syncing', () => {
    // #given
    mockUnified.mockReturnValue({ isUnifiedLikedActive: true, totalCount: 0, isLoading: true });
    mockLibrarySync.mockReturnValue({
      likedSongsCount: 0,
      likedSongsPerProvider: [],
      isLikedSongsSyncing: false,
    });

    // #when
    const { result: unifiedResult } = renderHook(() => useLikedSection());

    // #then
    expect(unifiedResult.current.isLoading).toBe(true);

    // #given (single-provider mode)
    mockUnified.mockReturnValue({ isUnifiedLikedActive: false, totalCount: 0, isLoading: true });
    mockLibrarySync.mockReturnValue({
      likedSongsCount: 0,
      likedSongsPerProvider: [],
      isLikedSongsSyncing: true,
    });

    // #when
    const { result: singleResult } = renderHook(() => useLikedSection());

    // #then
    expect(singleResult.current.isLoading).toBe(true);
  });

  it('passes through perProvider counts unchanged', () => {
    // #given
    const perProvider = [
      { provider: 'spotify' as const, count: 10 },
      { provider: 'dropbox' as const, count: 20 },
    ];
    mockUnified.mockReturnValue({ isUnifiedLikedActive: false, totalCount: 0, isLoading: false });
    mockLibrarySync.mockReturnValue({
      likedSongsCount: 30,
      likedSongsPerProvider: perProvider,
      isLikedSongsSyncing: false,
    });

    // #when
    const { result } = renderHook(() => useLikedSection());

    // #then
    expect(result.current.perProvider).toBe(perProvider);
  });
});
