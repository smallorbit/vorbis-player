import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlaylistsSection } from '../usePlaylistsSection';
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

const makePlaylist = (id: string, provider: ProviderId = 'spotify') => ({
  id,
  name: `Playlist ${id}`,
  provider,
  images: [{ url: `https://img.example/${id}.jpg`, height: 300, width: 300 }],
  tracks: { total: 10 },
  description: null,
  owner: { display_name: 'User' },
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

describe('usePlaylistsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePinnedItems.mockReturnValue(defaultPinnedItems);
    mockUseLibrarySync.mockReturnValue({
      playlists: [],
      albums: [],
      likedSongsCount: 0,
      likedSongsPerProvider: [],
      isInitialLoadComplete: true,
      isLikedSongsSyncing: false,
    } as ReturnType<typeof useLibrarySync>);
  });

  describe('loading state', () => {
    it('returns isLoading true when library not yet loaded', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({
        playlists: [],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: false,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

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
      mockUseLibrarySync.mockReturnValue({
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2', 'dropbox' as ProviderId)],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

      // #when
      const { result } = renderHook(() => usePlaylistsSection({}));

      // #then
      expect(result.current.items).toHaveLength(2);
    });

    it('returns all playlists when providerFilter is empty array', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2', 'dropbox' as ProviderId)],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ providerFilter: [] }));

      // #then
      expect(result.current.items).toHaveLength(2);
    });
  });

  describe('provider filter', () => {
    it('filters playlists to specified provider', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({
        playlists: [
          makePlaylist('pl-1', 'spotify'),
          makePlaylist('pl-2', 'dropbox' as ProviderId),
          makePlaylist('pl-3', 'spotify'),
        ],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ providerFilter: ['spotify'] }));

      // #then
      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.every(p => p.provider === 'spotify')).toBe(true);
    });

    it('falls back to "spotify" for playlists without a provider field', () => {
      // #given — playlist has no provider field (uses fallback p.provider ?? 'spotify')
      const playlistWithoutProvider = { ...makePlaylist('pl-1') };
      delete (playlistWithoutProvider as Record<string, unknown>).provider;
      mockUseLibrarySync.mockReturnValue({
        playlists: [playlistWithoutProvider] as ReturnType<typeof useLibrarySync>['playlists'],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ providerFilter: ['spotify'] }));

      // #then — playlist without provider is treated as spotify and included
      expect(result.current.items).toHaveLength(1);
    });

    it('returns empty items when no playlists match the provider filter', () => {
      // #given
      mockUseLibrarySync.mockReturnValue({
        playlists: [makePlaylist('pl-1', 'spotify')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

      // #when
      const { result } = renderHook(() => usePlaylistsSection({ providerFilter: ['dropbox' as ProviderId] }));

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
      mockUseLibrarySync.mockReturnValue({
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

      // #when
      const { result } = renderHook(() => usePlaylistsSection({}));

      // #then
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('pl-2');
    });

    it('includes pinned playlists when excludePinned is false', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({
        ...defaultPinnedItems,
        pinnedPlaylistIds: ['pl-1'],
      });
      mockUseLibrarySync.mockReturnValue({
        playlists: [makePlaylist('pl-1'), makePlaylist('pl-2')],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

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
      mockUseLibrarySync.mockReturnValue({
        playlists: [
          makePlaylist('pl-1', 'spotify'),  // pinned
          makePlaylist('pl-2', 'spotify'),  // not pinned
          makePlaylist('pl-3', 'dropbox' as ProviderId),  // different provider
        ],
        albums: [],
        likedSongsCount: 0,
        likedSongsPerProvider: [],
        isInitialLoadComplete: true,
        isLikedSongsSyncing: false,
      } as ReturnType<typeof useLibrarySync>);

      // #when
      const { result } = renderHook(() =>
        usePlaylistsSection({ providerFilter: ['spotify'], excludePinned: true })
      );

      // #then — only pl-2 remains (pl-1 pinned, pl-3 wrong provider)
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('pl-2');
    });
  });
});
