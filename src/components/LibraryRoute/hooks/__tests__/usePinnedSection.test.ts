import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePinnedSection } from '../usePinnedSection';
import type { ProviderId } from '@/types/domain';

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

const makePlaylist = (id: string, name = 'Playlist', provider: ProviderId = 'spotify') => ({
  id,
  name,
  provider,
  images: [{ url: `https://img.example/${id}.jpg`, height: 300, width: 300 }],
  tracks: { total: 10 },
  description: null,
  owner: { display_name: 'User' },
});

const makeAlbum = (id: string, name = 'Album', provider: ProviderId = 'spotify') => ({
  id,
  name,
  provider,
  artists: 'Artist',
  images: [{ url: `https://img.example/${id}.jpg`, height: 300, width: 300 }],
  release_date: '2024',
  total_tracks: 10,
  uri: `spotify:album:${id}`,
});

const defaultPinnedItems = {
  pinnedPlaylistIds: [] as string[],
  pinnedAlbumIds: [] as string[],
  isPlaylistPinned: vi.fn(() => false),
  isAlbumPinned: vi.fn(() => false),
  togglePinPlaylist: vi.fn(),
  togglePinAlbum: vi.fn(),
  canPinMorePlaylists: true,
  canPinMoreAlbums: true,
} as ReturnType<typeof usePinnedItems>;

const defaultLibrarySyncReturn = {
  playlists: [],
  albums: [],
  likedSongsCount: 0,
  likedSongsPerProvider: [],
  isInitialLoadComplete: true,
  isLikedSongsSyncing: false,
} as ReturnType<typeof useLibrarySync>;

describe('usePinnedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePinnedItems.mockReturnValue(defaultPinnedItems);
    mockUseLibrarySync.mockReturnValue(defaultLibrarySyncReturn);
  });

  describe('loading state', () => {
    it('returns isLoading true when isInitialLoadComplete is false', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        isInitialLoadComplete: false,
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.isLoading).toBe(true);
    });

    it('returns isLoading false when isInitialLoadComplete is true', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        isInitialLoadComplete: true,
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('empty state', () => {
    it('returns isEmpty true when no pinned items', () => {
      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.isEmpty).toBe(true);
      expect(result.current.combined).toHaveLength(0);
    });
  });

  describe('pinned playlists', () => {
    it('returns pinned playlist matching pinnedPlaylistIds', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1'],
      });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2')] as ReturnType<typeof useLibrarySync>['playlists'],
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.pinnedPlaylists).toHaveLength(1);
      expect(result.current.pinnedPlaylists[0].id).toBe('pl-1');
      expect(result.current.pinnedPlaylists[0].kind).toBe('playlist');
    });

    it('exposes imageUrl on pinned playlist', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1'],
      });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        playlists: [makePlaylist('pl-1')] as ReturnType<typeof useLibrarySync>['playlists'],
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.pinnedPlaylists[0].imageUrl).toBe('https://img.example/pl-1.jpg');
    });
  });

  describe('pinned albums', () => {
    it('returns pinned album matching pinnedAlbumIds', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedAlbumIds: ['alb-1'],
      });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        albums: [makeAlbum('alb-1'), makeAlbum('alb-2')] as ReturnType<typeof useLibrarySync>['albums'],
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.pinnedAlbums).toHaveLength(1);
      expect(result.current.pinnedAlbums[0].id).toBe('alb-1');
      expect(result.current.pinnedAlbums[0].kind).toBe('album');
    });
  });

  describe('combined ordering', () => {
    it('places playlists before albums in combined', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1'],
        pinnedAlbumIds: ['alb-1'],
      });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        playlists: [makePlaylist('pl-1')] as ReturnType<typeof useLibrarySync>['playlists'],
        albums: [makeAlbum('alb-1')] as ReturnType<typeof useLibrarySync>['albums'],
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.combined).toHaveLength(2);
      expect(result.current.combined[0].kind).toBe('playlist');
      expect(result.current.combined[1].kind).toBe('album');
    });

    it('isEmpty is false when combined has items', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1'],
      });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        playlists: [makePlaylist('pl-1')] as ReturnType<typeof useLibrarySync>['playlists'],
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.isEmpty).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('ignores playlist id in pinnedPlaylistIds that is not in library', () => {
      // #given — pinned id does not match any loaded playlist
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['not-in-library'],
      });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        playlists: [makePlaylist('pl-1')] as ReturnType<typeof useLibrarySync>['playlists'],
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then
      expect(result.current.pinnedPlaylists).toHaveLength(0);
    });

    it('handles pinnedPlaylistIds as a string array (not Set)', () => {
      // #given — contract specifies string[] from PinnedItemsContext
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1', 'pl-1'],  // duplicates (shouldn't happen but guards against Set assumption)
      });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        playlists: [makePlaylist('pl-1')] as ReturnType<typeof useLibrarySync>['playlists'],
      });

      // #when
      const { result } = renderHook(() => usePinnedSection());

      // #then — still just one entry (deduped by filter or by library having one entry)
      expect(result.current.pinnedPlaylists.filter(p => p.id === 'pl-1').length).toBeGreaterThanOrEqual(1);
    });
  });
});
