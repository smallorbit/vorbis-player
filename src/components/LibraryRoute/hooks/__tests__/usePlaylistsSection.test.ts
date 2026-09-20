import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlaylistsSection } from '../usePlaylistsSection';
import type { MediaCollection, ProviderId } from '@/types/domain';
import { defined } from '@/test/defined';
import { makeLibrarySyncResult, makePinnedItemsResult } from '@/test/fixtures';

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: vi.fn(),
  LIBRARY_REFRESH_EVENT: 'vorbis-library-refresh',
  ART_REFRESHED_EVENT: 'vorbis-art-refreshed',
}));

vi.mock('@/hooks/usePinnedItems', () => ({
  usePinnedItems: vi.fn(),
}));

import { useLibrarySync } from '@/hooks/useLibrarySync';
import { usePinnedItems } from '@/hooks/usePinnedItems';

const mockUseLibrarySync = vi.mocked(useLibrarySync);
const mockUsePinnedItems = vi.mocked(usePinnedItems);

const makePlaylist = (id: string, provider: ProviderId = 'spotify'): MediaCollection => ({
  id,
  provider,
  kind: 'playlist',
  name: `Playlist ${id}`,
  imageUrl: `https://img.example/${id}.jpg`,
  trackCount: 10,
  ownerName: 'User',
  genres: [],
});

const defaultPinnedItems = makePinnedItemsResult();

describe('usePlaylistsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePinnedItems.mockReturnValue(defaultPinnedItems);
    mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult());
  });

  describe('loading state', () => {
    it('returns isLoading true when library not yet loaded', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({ isInitialLoadComplete: false }));

      // #when
      const { result } = renderHook(() => usePlaylistsSection({}));

      // #then
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('empty state', () => {
    it('returns isEmpty true when no playlists', () => {
      // #when
      const { result } = renderHook(() => usePlaylistsSection({}));

      // #then
      expect(result.current.isEmpty).toBe(true);
    });
  });

  describe('no filter', () => {
    it('returns all playlists when providerFilter is undefined', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2', 'dropbox')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      }));

      // #when
      const { result } = renderHook(() => usePlaylistsSection({}));

      // #then
      expect(result.current.items).toHaveLength(2);
    });

    it('returns all playlists when providerFilter is empty array', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2', 'dropbox')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      }));

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ providerFilter: [] }));

      // #then
      expect(result.current.items).toHaveLength(2);
    });
  });

  describe('provider filter', () => {
    it('filters playlists to specified provider', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({
        playlists: [
          makePlaylist('pl-1', 'spotify'),
          makePlaylist('pl-2', 'dropbox'),
          makePlaylist('pl-3', 'spotify'),
        ],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      }));

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ providerFilter: ['spotify'] }));

      // #then
      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.every(p => p.provider === 'spotify')).toBe(true);
    });

    it('matches on the required provider field stamped on each collection', () => {
      // #given — provider is required on MediaCollection; no fallback is applied
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({
        playlists: [makePlaylist('pl-1', 'dropbox')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      }));

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ providerFilter: ['dropbox'] }));

      // #then — the dropbox-stamped playlist matches the dropbox filter
      expect(result.current.items).toHaveLength(1);
      expect(defined(result.current.items[0]).provider).toBe('dropbox');
    });

    it('returns empty items when no playlists match the provider filter', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({
        playlists: [makePlaylist('pl-1', 'spotify')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      }));

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ providerFilter: ['dropbox'] }));

      // #then
      expect(result.current.items).toHaveLength(0);
      expect(result.current.isEmpty).toBe(true);
    });
  });

  describe('pinned exclusion', () => {
    it('excludes pinned playlists by default (excludePinned defaults to true)', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1'],
      });
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      }));

      // #when
      const { result } = renderHook(() => usePlaylistsSection({}));

      // #then
      expect(result.current.items).toHaveLength(1);
      expect(defined(result.current.items[0]).id).toBe('pl-2');
    });

    it('includes pinned playlists when excludePinned is false', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1'],
      });
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      }));

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ excludePinned: false }));

      // #then
      expect(result.current.items).toHaveLength(2);
    });

    it('applies both provider filter and pinned exclusion together', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1'],
      });
      mockUseLibrarySync.mockReturnValue(makeLibrarySyncResult({
        playlists: [
          makePlaylist('pl-1', 'spotify'),  // pinned
          makePlaylist('pl-2', 'spotify'),  // not pinned
          makePlaylist('pl-3', 'dropbox'),  // different provider
        ],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      }));

      // #when
      const { result } = renderHook(() =>
        usePlaylistsSection({ providerFilter: ['spotify'], excludePinned: true })
      );

      // #then — only pl-2 remains (pl-1 pinned, pl-3 wrong provider)
      expect(result.current.items).toHaveLength(1);
      expect(defined(result.current.items[0]).id).toBe('pl-2');
    });
  });
});
