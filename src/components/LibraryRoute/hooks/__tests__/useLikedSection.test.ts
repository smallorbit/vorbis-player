import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLikedSection } from '../useLikedSection';
import type { ProviderId } from '@/types/domain';

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: vi.fn(),
  LIBRARY_REFRESH_EVENT: 'vorbis-library-refresh',
  ART_REFRESHED_EVENT: 'vorbis-art-refreshed',
}));

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: vi.fn(),
}));

import { useLibrarySync } from '@/hooks/useLibrarySync';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';

const mockUseLibrarySync = vi.mocked(useLibrarySync);
const mockUseUnifiedLikedTracks = vi.mocked(useUnifiedLikedTracks);

const defaultLibraryReturn = {
  playlists: [],
  albums: [],
  likedSongsCount: 0,
  likedSongsPerProvider: [],
  isInitialLoadComplete: true,
  isLikedSongsSyncing: false,
} as ReturnType<typeof useLibrarySync>;

const defaultUnifiedReturn = {
  tracks: [],
  totalCount: 0,
  isLoading: false,
  isUnifiedLikedActive: false,
} as ReturnType<typeof useUnifiedLikedTracks>;

describe('useLikedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLibrarySync.mockReturnValue(defaultLibraryReturn);
    mockUseUnifiedLikedTracks.mockReturnValue(defaultUnifiedReturn);
  });

  describe('non-unified mode (isUnifiedLikedActive = false)', () => {
    it('returns totalCount from likedSongsCount', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({ ...defaultLibraryReturn, likedSongsCount: 42 });
      mockUseUnifiedLikedTracks.mockReturnValue({ ...defaultUnifiedReturn, isUnifiedLikedActive: false });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.totalCount).toBe(42);
    });

    it('returns isLoading from isLikedSongsSyncing', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({ ...defaultLibraryReturn, isLikedSongsSyncing: true });
      mockUseUnifiedLikedTracks.mockReturnValue({ ...defaultUnifiedReturn, isUnifiedLikedActive: false });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.isLoading).toBe(true);
    });

    it('returns isUnified false', () => {
      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.isUnified).toBe(false);
    });

    it('does not use unified totalCount when inactive', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({ ...defaultLibraryReturn, likedSongsCount: 10 });
      mockUseUnifiedLikedTracks.mockReturnValue({ ...defaultUnifiedReturn, totalCount: 999, isUnifiedLikedActive: false });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.totalCount).toBe(10);
    });
  });

  describe('unified mode (isUnifiedLikedActive = true)', () => {
    it('returns totalCount from unified hook', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({ ...defaultLibraryReturn, likedSongsCount: 10 });
      mockUseUnifiedLikedTracks.mockReturnValue({
        ...defaultUnifiedReturn,
        totalCount: 75,
        isUnifiedLikedActive: true,
      });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.totalCount).toBe(75);
    });

    it('returns isLoading from unified hook', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({ ...defaultLibraryReturn, isLikedSongsSyncing: false });
      mockUseUnifiedLikedTracks.mockReturnValue({
        ...defaultUnifiedReturn,
        isLoading: true,
        isUnifiedLikedActive: true,
      });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.isLoading).toBe(true);
    });

    it('returns isUnified true', () => {
      // #given
      mockUseUnifiedLikedTracks.mockReturnValue({ ...defaultUnifiedReturn, isUnifiedLikedActive: true });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.isUnified).toBe(true);
    });

    it('does not use likedSongsCount when unified is active', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({ ...defaultLibraryReturn, likedSongsCount: 999 });
      mockUseUnifiedLikedTracks.mockReturnValue({
        ...defaultUnifiedReturn,
        totalCount: 42,
        isUnifiedLikedActive: true,
      });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.totalCount).toBe(42);
    });
  });

  describe('perProvider pass-through', () => {
    it('always passes perProvider from useLibrarySync', () => {
      // #given
      const perProvider = [
        { provider: 'spotify' as ProviderId, count: 30 },
        { provider: 'dropbox' as ProviderId, count: 12 },
      ];
      mockUseLibrarySync.mockReturnValue({ ...defaultLibraryReturn, likedSongsPerProvider: perProvider });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.perProvider).toEqual(perProvider);
    });

    it('passes perProvider through even when unified is active', () => {
      // #given
      const perProvider = [{ provider: 'spotify' as ProviderId, count: 50 }];
      mockUseLibrarySync.mockReturnValue({ ...defaultLibraryReturn, likedSongsPerProvider: perProvider });
      mockUseUnifiedLikedTracks.mockReturnValue({ ...defaultUnifiedReturn, isUnifiedLikedActive: true });

      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.perProvider).toEqual(perProvider);
    });

    it('returns empty perProvider array when library has none', () => {
      // #when
      const { result } = renderHook(() => useLikedSection());

      // #then
      expect(result.current.perProvider).toEqual([]);
    });
  });

  describe('unified mode toggling', () => {
    it('does not crash when isUnifiedLikedActive changes between renders', () => {
      // #given — start non-unified
      mockUseUnifiedLikedTracks.mockReturnValue({ ...defaultUnifiedReturn, isUnifiedLikedActive: false });
      const { result, rerender } = renderHook(() => useLikedSection());
      expect(result.current.isUnified).toBe(false);

      // #when — switch to unified
      mockUseUnifiedLikedTracks.mockReturnValue({
        ...defaultUnifiedReturn,
        isUnifiedLikedActive: true,
        totalCount: 100,
      });
      rerender();

      // #then — no crash, values update
      expect(result.current.isUnified).toBe(true);
      expect(result.current.totalCount).toBe(100);
    });
  });
});
