import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PlaylistInfo, AlbumInfo } from '@/services/spotify';
import { makePlaylistInfo, makeAlbumInfo } from '@/test/fixtures';

const {
  mockIsMobile,
  mockUseLibrarySync,
  mockUseUnifiedLikedTracks,
  mockUseProviderContext,
  mockUsePinnedItems,
} = vi.hoisted(() => ({
  mockIsMobile: { current: false },
  mockUseLibrarySync: vi.fn(),
  mockUseUnifiedLikedTracks: vi.fn(),
  mockUseProviderContext: vi.fn(),
  mockUsePinnedItems: vi.fn(),
}));

vi.mock('@/contexts/PlayerSizingContext', () => ({
  PlayerSizingProvider: ({ children }: { children: React.ReactNode }) => children,
  usePlayerSizingContext: () => ({
    viewport: { width: mockIsMobile.current ? 400 : 1400, height: 800 },
    isMobile: mockIsMobile.current,
    isTablet: false,
    isDesktop: !mockIsMobile.current,
    hasPointerInput: !mockIsMobile.current,
    dimensions: { width: 600, height: 600 },
  }),
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: () => mockUseProviderContext(),
}));

vi.mock('@/hooks/useLibrarySync', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useLibrarySync')>(
    '@/hooks/useLibrarySync',
  );
  return {
    ...actual,
    useLibrarySync: () => mockUseLibrarySync(),
  };
});

vi.mock('@/hooks/useUnifiedLikedTracks', () => ({
  useUnifiedLikedTracks: () => mockUseUnifiedLikedTracks(),
}));

vi.mock('@/hooks/usePinnedItems', () => ({
  usePinnedItems: () => mockUsePinnedItems(),
}));

import { useLibraryRoot } from '../useLibraryRoot';

function setupDefaultMocks(): void {
  const descriptor = {
    id: 'spotify',
    name: 'Spotify',
    auth: { isAuthenticated: () => true },
  };
  mockUseProviderContext.mockReturnValue({
    activeDescriptor: descriptor,
    hasMultipleProviders: true,
    enabledProviderIds: ['spotify', 'dropbox'],
    getDescriptor: (id: string) => (id === 'spotify' ? descriptor : undefined),
  });
  mockUseUnifiedLikedTracks.mockReturnValue({
    isUnifiedLikedActive: false,
    totalCount: 0,
  });
  mockUsePinnedItems.mockReturnValue({
    pinnedPlaylistIds: [],
    pinnedAlbumIds: [],
    isPlaylistPinned: () => false,
    isAlbumPinned: () => false,
    togglePinPlaylist: vi.fn(),
    togglePinAlbum: vi.fn(),
    canPinMorePlaylists: true,
    canPinMoreAlbums: true,
  });
}

function setLibrarySync(playlists: PlaylistInfo[], albums: AlbumInfo[]): void {
  mockUseLibrarySync.mockReturnValue({
    playlists,
    albums,
    likedSongsCount: 0,
    likedSongsPerProvider: [],
    isInitialLoadComplete: true,
    isSyncing: false,
    isLikedSongsSyncing: false,
    lastSyncTimestamp: Date.now(),
    syncError: null,
    refreshNow: vi.fn(),
    removeCollection: vi.fn(),
  });
}

function renderLibraryRoot() {
  return renderHook(() =>
    useLibraryRoot({
      onPlaylistSelect: vi.fn(),
      inDrawer: false,
    }),
  );
}

function playlistNames(result: { current: ReturnType<typeof useLibraryRoot> }): string[] {
  return result.current.pinValue.unpinnedPlaylists.map((p) => p.name);
}

function albumNames(result: { current: ReturnType<typeof useLibraryRoot> }): string[] {
  return result.current.pinValue.unpinnedAlbums.map((a) => a.name);
}

describe('useLibraryRoot grid behavior', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockIsMobile.current = false;
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  describe('mobile viewport', () => {
    beforeEach(() => {
      mockIsMobile.current = true;
    });

    it('filters playlists by searchQuery (case-insensitive substring match)', () => {
      // #given
      setLibrarySync(
        [
          makePlaylistInfo({ id: 'p-1', name: 'Foo Fighters Mix' }),
          makePlaylistInfo({ id: 'p-2', name: 'Jazz Classics' }),
          makePlaylistInfo({ id: 'p-3', name: 'Foolish Love' }),
        ],
        [],
      );
      const { result } = renderLibraryRoot();

      // #when
      act(() => {
        result.current.browsingValue.setSearchQuery('foo');
      });

      // #then
      expect(playlistNames(result).sort()).toEqual(['Foo Fighters Mix', 'Foolish Love']);
    });

    it('reorders playlists when playlistSort changes from recently-added to name-asc', () => {
      // #given
      setLibrarySync(
        [
          makePlaylistInfo({ id: 'p-1', name: 'Charlie', added_at: '2024-01-03T00:00:00Z' }),
          makePlaylistInfo({ id: 'p-2', name: 'Alpha', added_at: '2024-01-01T00:00:00Z' }),
          makePlaylistInfo({ id: 'p-3', name: 'Bravo', added_at: '2024-01-02T00:00:00Z' }),
        ],
        [],
      );
      const { result } = renderLibraryRoot();

      // #when
      act(() => {
        result.current.browsingValue.setPlaylistSort('name-asc');
      });

      // #then
      expect(playlistNames(result)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('ignores providerFilters when listing playlists', () => {
      // #given
      setLibrarySync(
        [
          makePlaylistInfo({ id: 'p-1', name: 'Spotify Mix', provider: 'spotify' }),
          makePlaylistInfo({ id: 'p-2', name: 'Dropbox Mix', provider: 'dropbox' }),
        ],
        [],
      );
      const { result } = renderLibraryRoot();

      // #when
      act(() => {
        result.current.browsingValue.setProviderFilters(['spotify']);
      });

      // #then
      expect(playlistNames(result).sort()).toEqual(['Dropbox Mix', 'Spotify Mix']);
    });

    it('ignores providerFilters when listing albums', () => {
      // #given
      setLibrarySync(
        [],
        [
          makeAlbumInfo({ id: 'a-1', name: 'Spotify Album', provider: 'spotify' }),
          makeAlbumInfo({ id: 'a-2', name: 'Dropbox Album', provider: 'dropbox' }),
        ],
      );
      const { result } = renderLibraryRoot();

      // #when
      act(() => {
        result.current.browsingValue.setProviderFilters(['dropbox']);
      });

      // #then
      expect(albumNames(result).sort()).toEqual(['Dropbox Album', 'Spotify Album']);
    });

    it('filters albums by searchQuery', () => {
      // #given
      setLibrarySync(
        [],
        [
          makeAlbumInfo({ id: 'a-1', name: 'Kind of Blue', artists: 'Miles Davis' }),
          makeAlbumInfo({ id: 'a-2', name: 'Random Access Memories', artists: 'Daft Punk' }),
        ],
      );
      const { result } = renderLibraryRoot();

      // #when
      act(() => {
        result.current.browsingValue.setSearchQuery('blue');
      });

      // #then
      expect(albumNames(result)).toEqual(['Kind of Blue']);
    });
  });

  describe('desktop viewport', () => {
    beforeEach(() => {
      mockIsMobile.current = false;
    });

    it('applies providerFilters to playlists', () => {
      // #given
      setLibrarySync(
        [
          makePlaylistInfo({ id: 'p-1', name: 'Spotify Mix', provider: 'spotify' }),
          makePlaylistInfo({ id: 'p-2', name: 'Dropbox Mix', provider: 'dropbox' }),
        ],
        [],
      );
      const { result } = renderLibraryRoot();

      // #when
      act(() => {
        result.current.browsingValue.setProviderFilters(['spotify']);
      });

      // #then
      expect(playlistNames(result)).toEqual(['Spotify Mix']);
    });

    it('applies providerFilters to albums', () => {
      // #given
      setLibrarySync(
        [],
        [
          makeAlbumInfo({ id: 'a-1', name: 'Spotify Album', provider: 'spotify' }),
          makeAlbumInfo({ id: 'a-2', name: 'Dropbox Album', provider: 'dropbox' }),
        ],
      );
      const { result } = renderLibraryRoot();

      // #when
      act(() => {
        result.current.browsingValue.setProviderFilters(['dropbox']);
      });

      // #then
      expect(albumNames(result)).toEqual(['Dropbox Album']);
    });

    it('returns all items when providerFilters is empty', () => {
      // #given
      setLibrarySync(
        [
          makePlaylistInfo({ id: 'p-1', name: 'Spotify Mix', provider: 'spotify' }),
          makePlaylistInfo({ id: 'p-2', name: 'Dropbox Mix', provider: 'dropbox' }),
        ],
        [],
      );

      // #when
      const { result } = renderLibraryRoot();

      // #then
      expect(playlistNames(result).sort()).toEqual(['Dropbox Mix', 'Spotify Mix']);
    });
  });
});
