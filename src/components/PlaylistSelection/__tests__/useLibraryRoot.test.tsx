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
  mockUseRecentlyPlayedCollections,
} = vi.hoisted(() => ({
  mockIsMobile: { current: false },
  mockUseLibrarySync: vi.fn(),
  mockUseUnifiedLikedTracks: vi.fn(),
  mockUseProviderContext: vi.fn(),
  mockUsePinnedItems: vi.fn(),
  mockUseRecentlyPlayedCollections: vi.fn(),
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

vi.mock('@/hooks/useRecentlyPlayedCollections', () => ({
  useRecentlyPlayedCollections: () => mockUseRecentlyPlayedCollections(),
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
  mockUseRecentlyPlayedCollections.mockReturnValue({
    history: [],
    record: vi.fn(),
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

describe('useLibraryRoot behavioral coverage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockIsMobile.current = false;
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  describe('combined filter interactions', () => {
    it('applies provider and genre filters together on albums', () => {
      // #given
      setLibrarySync(
        [],
        [
          makeAlbumInfo({ id: 'a-1', name: 'Spotify Rock',   provider: 'spotify',  genres: ['Rock'] }),
          makeAlbumInfo({ id: 'a-2', name: 'Spotify Jazz',   provider: 'spotify',  genres: ['Jazz'] }),
          makeAlbumInfo({ id: 'a-3', name: 'Dropbox Rock',   provider: 'dropbox',  genres: ['Rock'] }),
        ],
      );
      const { result } = renderLibraryRoot();

      // #when — provider=spotify AND genre=Rock
      act(() => {
        result.current.browsingValue.setProviderFilters(['spotify']);
        result.current.browsingValue.setSelectedGenres(['Rock']);
      });

      // #then — only the item matching both filters survives
      expect(albumNames(result)).toEqual(['Spotify Rock']);
    });
  });

  describe('mobile provider filter bypass', () => {
    beforeEach(() => {
      mockIsMobile.current = true;
    });

    it('shows items from all providers when isMobile is true, even when providerFilters is set', () => {
      // #given
      setLibrarySync(
        [
          makePlaylistInfo({ id: 'p-1', name: 'Spotify Playlist', provider: 'spotify' }),
          makePlaylistInfo({ id: 'p-2', name: 'Dropbox Playlist', provider: 'dropbox' }),
        ],
        [
          makeAlbumInfo({ id: 'a-1', name: 'Spotify Album', provider: 'spotify' }),
          makeAlbumInfo({ id: 'a-2', name: 'Dropbox Album', provider: 'dropbox' }),
        ],
      );
      const { result } = renderLibraryRoot();

      // #when — set a provider filter that would exclude dropbox on desktop
      act(() => {
        result.current.browsingValue.setProviderFilters(['spotify']);
      });

      // #then — both providers' items appear in playlists and albums
      expect(playlistNames(result).sort()).toEqual(['Dropbox Playlist', 'Spotify Playlist']);
      expect(albumNames(result).sort()).toEqual(['Dropbox Album', 'Spotify Album']);
    });
  });

  describe('error messaging', () => {
    it('surfaces libraryError mentioning the active provider name when all collections are empty and load is complete', () => {
      // #given — all counts are 0 and initial load is done
      mockUseLibrarySync.mockReturnValue({
        playlists: [],
        albums: [],
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

      // #when
      const { result } = renderLibraryRoot();

      // #then — error string names the active provider
      expect(typeof result.current.statusContentProps.error).toBe('string');
      expect(result.current.statusContentProps.error).toContain('Spotify');
    });

    it('does not surface libraryError before initial load completes', () => {
      // #given — load still in progress
      mockUseLibrarySync.mockReturnValue({
        playlists: [],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: false,
        isSyncing: true,
        isLikedSongsSyncing: false,
        lastSyncTimestamp: null,
        syncError: null,
        refreshNow: vi.fn(),
        removeCollection: vi.fn(),
      });

      // #when
      const { result } = renderLibraryRoot();

      // #then — no error yet
      expect(result.current.statusContentProps.error).toBeNull();
    });
  });

  describe('pin composition', () => {
    it('pinned playlist appears in pinnedPlaylists and not in unpinnedPlaylists', () => {
      // #given
      setLibrarySync(
        [
          makePlaylistInfo({ id: 'p-pinned', name: 'Pinned Playlist', provider: 'spotify' }),
          makePlaylistInfo({ id: 'p-free',   name: 'Free Playlist',   provider: 'spotify' }),
        ],
        [],
      );
      mockUsePinnedItems.mockReturnValue({
        pinnedPlaylistIds: ['p-pinned'],
        pinnedAlbumIds: [],
        isPlaylistPinned: (id: string) => id === 'p-pinned',
        isAlbumPinned: () => false,
        togglePinPlaylist: vi.fn(),
        togglePinAlbum: vi.fn(),
        canPinMorePlaylists: true,
        canPinMoreAlbums: true,
      });

      // #when
      const { result } = renderLibraryRoot();

      // #then
      const pinnedNames = result.current.pinValue.pinnedPlaylists.map((p) => p.name);
      const unpinnedNames = result.current.pinValue.unpinnedPlaylists.map((p) => p.name);
      expect(pinnedNames).toContain('Pinned Playlist');
      expect(unpinnedNames).not.toContain('Pinned Playlist');
      expect(unpinnedNames).toContain('Free Playlist');
    });

    it('pinned album appears in pinnedAlbums and not in unpinnedAlbums', () => {
      // #given
      setLibrarySync(
        [],
        [
          makeAlbumInfo({ id: 'a-pinned', name: 'Pinned Album',  provider: 'spotify' }),
          makeAlbumInfo({ id: 'a-free',   name: 'Free Album',    provider: 'spotify' }),
        ],
      );
      mockUsePinnedItems.mockReturnValue({
        pinnedPlaylistIds: [],
        pinnedAlbumIds: ['a-pinned'],
        isPlaylistPinned: () => false,
        isAlbumPinned: (id: string) => id === 'a-pinned',
        togglePinPlaylist: vi.fn(),
        togglePinAlbum: vi.fn(),
        canPinMorePlaylists: true,
        canPinMoreAlbums: true,
      });

      // #when
      const { result } = renderLibraryRoot();

      // #then
      const pinnedNames = result.current.pinValue.pinnedAlbums.map((a) => a.name);
      const unpinnedNames = result.current.pinValue.unpinnedAlbums.map((a) => a.name);
      expect(pinnedNames).toContain('Pinned Album');
      expect(unpinnedNames).not.toContain('Pinned Album');
      expect(unpinnedNames).toContain('Free Album');
    });
  });

  describe('liked songs provider resolution', () => {
    it('resolves to the single provider when only one provider has liked songs', () => {
      // #given
      const onPlaylistSelect = vi.fn();
      mockUseLibrarySync.mockReturnValue({
        playlists: [],
        albums: [],
        likedSongsCount: 5,
        likedSongsPerProvider: [{ provider: 'spotify' as const, count: 5 }],
        isInitialLoadComplete: true,
        isSyncing: false,
        isLikedSongsSyncing: false,
        lastSyncTimestamp: Date.now(),
        syncError: null,
        refreshNow: vi.fn(),
        removeCollection: vi.fn(),
      });
      const { result } = renderHook(() =>
        useLibraryRoot({ onPlaylistSelect, inDrawer: false }),
      );

      // #when — click liked songs without specifying a provider
      act(() => {
        result.current.actionsValue.onLikedSongsClick(undefined);
      });

      // #then — routed to liked-songs with the single provider resolved
      expect(onPlaylistSelect).toHaveBeenCalledWith('liked-songs', 'Liked Songs', 'spotify');
    });

    it('routes through unified path when unified liked is active', () => {
      // #given
      const onPlaylistSelect = vi.fn();
      mockUseLibrarySync.mockReturnValue({
        playlists: [],
        albums: [],
        likedSongsCount: 10,
        likedSongsPerProvider: [
          { provider: 'spotify' as const, count: 5 },
          { provider: 'dropbox' as const, count: 5 },
        ],
        isInitialLoadComplete: true,
        isSyncing: false,
        isLikedSongsSyncing: false,
        lastSyncTimestamp: Date.now(),
        syncError: null,
        refreshNow: vi.fn(),
        removeCollection: vi.fn(),
      });
      mockUseUnifiedLikedTracks.mockReturnValue({
        isUnifiedLikedActive: true,
        totalCount: 10,
      });
      const { result } = renderHook(() =>
        useLibraryRoot({ onPlaylistSelect, inDrawer: false }),
      );

      // #when — click liked songs without specifying a provider
      act(() => {
        result.current.actionsValue.onLikedSongsClick(undefined);
      });

      // #then — provider is undefined (unified route)
      expect(onPlaylistSelect).toHaveBeenCalledWith('liked-songs', 'Liked Songs', undefined);
    });

    it('falls back to active provider when multiple providers and unified inactive', () => {
      // #given
      const onPlaylistSelect = vi.fn();
      mockUseLibrarySync.mockReturnValue({
        playlists: [],
        albums: [],
        likedSongsCount: 10,
        likedSongsPerProvider: [
          { provider: 'spotify' as const, count: 5 },
          { provider: 'dropbox' as const, count: 5 },
        ],
        isInitialLoadComplete: true,
        isSyncing: false,
        isLikedSongsSyncing: false,
        lastSyncTimestamp: Date.now(),
        syncError: null,
        refreshNow: vi.fn(),
        removeCollection: vi.fn(),
      });
      const { result } = renderHook(() =>
        useLibraryRoot({ onPlaylistSelect, inDrawer: false }),
      );

      // #when — click liked songs without specifying a provider
      act(() => {
        result.current.actionsValue.onLikedSongsClick(undefined);
      });

      // #then — ambiguous branch falls back to active descriptor id (logged via debug)
      expect(onPlaylistSelect).toHaveBeenCalledWith('liked-songs', 'Liked Songs', 'spotify');
    });
  });
});

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

  describe('recently played image enrichment', () => {
    it('resolves imageUrl from cached playlists when history entry lacks one', () => {
      // #given
      mockUseRecentlyPlayedCollections.mockReturnValue({
        record: vi.fn(),
        history: ([
          { ref: { provider: 'spotify', kind: 'playlist', id: 'p-1' }, name: 'My Mix' },
        ]),
      });
      setLibrarySync(
        [makePlaylistInfo({ id: 'p-1', name: 'My Mix', provider: 'spotify', images: [{ url: 'https://example.com/p1.jpg', height: 300, width: 300 }] })],
        [],
      );

      // #when
      const { result } = renderLibraryRoot();

      // #then
      expect(result.current.browsingValue.recentlyPlayed[0].imageUrl).toBe('https://example.com/p1.jpg');
    });

    it('resolves imageUrl from cached albums for album history entries', () => {
      // #given
      mockUseRecentlyPlayedCollections.mockReturnValue({
        record: vi.fn(),
        history: ([
          { ref: { provider: 'spotify', kind: 'album', id: 'a-1' }, name: 'OK Computer' },
        ]),
      });
      setLibrarySync(
        [],
        [makeAlbumInfo({ id: 'a-1', name: 'OK Computer', provider: 'spotify', images: [{ url: 'https://example.com/a1.jpg', height: 300, width: 300 }] })],
      );

      // #when
      const { result } = renderLibraryRoot();

      // #then
      expect(result.current.browsingValue.recentlyPlayed[0].imageUrl).toBe('https://example.com/a1.jpg');
    });

    it('preserves existing imageUrl without overwriting from cache', () => {
      // #given
      mockUseRecentlyPlayedCollections.mockReturnValue({
        record: vi.fn(),
        history: ([
          {
            ref: { provider: 'spotify', kind: 'playlist', id: 'p-1' },
            name: 'My Mix',
            imageUrl: 'https://example.com/stored.jpg',
          },
        ]),
      });
      setLibrarySync(
        [makePlaylistInfo({ id: 'p-1', name: 'My Mix', provider: 'spotify', images: [{ url: 'https://example.com/fresh.jpg', height: 300, width: 300 }] })],
        [],
      );

      // #when
      const { result } = renderLibraryRoot();

      // #then
      expect(result.current.browsingValue.recentlyPlayed[0].imageUrl).toBe('https://example.com/stored.jpg');
    });

    it('leaves imageUrl undefined when no matching collection is cached', () => {
      // #given
      mockUseRecentlyPlayedCollections.mockReturnValue({
        record: vi.fn(),
        history: ([
          { ref: { provider: 'spotify', kind: 'playlist', id: 'missing' }, name: 'Gone' },
        ]),
      });
      setLibrarySync([], []);

      // #when
      const { result } = renderLibraryRoot();

      // #then
      expect(result.current.browsingValue.recentlyPlayed[0].imageUrl).toBeUndefined();
    });
  });
});
