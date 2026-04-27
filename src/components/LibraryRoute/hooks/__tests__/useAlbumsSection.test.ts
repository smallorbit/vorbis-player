import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAlbumsSection } from '../useAlbumsSection';
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

const makeAlbum = (id: string, provider: ProviderId = 'spotify') => ({
  id,
  name: `Album ${id}`,
  provider,
  artists: 'Test Artist',
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

const makeLibraryReturn = (albums: ReturnType<typeof useLibrarySync>['albums'], overrides = {}) => ({
  playlists: [],
  albums,
  likedSongsCount: 0,
  likedSongsPerProvider: [],
  isInitialLoadComplete: true,
  isLikedSongsSyncing: false,
  ...overrides,
} as ReturnType<typeof useLibrarySync>);

describe('useAlbumsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePinnedItems.mockReturnValue(defaultPinnedItems);
    mockUseLibrarySync.mockReturnValue(makeLibraryReturn([]));
  });

  describe('loading state', () => {
    it('returns isLoading true when library not yet loaded', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibraryReturn([], { isInitialLoadComplete: false }));

      // #when
      const { result } = renderHook(() => useAlbumsSection({}));

      // #then
      expect(result.current.isLoading).toBe(true);
    });

    it('returns isLoading false when library is loaded', () => {
      // #when
      const { result } = renderHook(() => useAlbumsSection({}));

      // #then
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('empty state', () => {
    it('returns isEmpty true when no albums', () => {
      // #when
      const { result } = renderHook(() => useAlbumsSection({}));

      // #then
      expect(result.current.isEmpty).toBe(true);
    });
  });

  describe('no filter', () => {
    it('returns all albums when providerFilter is undefined', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibraryReturn([
        makeAlbum('alb-1'),
        makeAlbum('alb-2', 'dropbox' as ProviderId),
      ]));

      // #when
      const { result } = renderHook(() => useAlbumsSection({}));

      // #then
      expect(result.current.items).toHaveLength(2);
    });

    it('returns all albums when providerFilter is empty array', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibraryReturn([makeAlbum('alb-1'), makeAlbum('alb-2')]));

      // #when
      const { result } = renderHook(() => useAlbumsSection({ providerFilter: [] }));

      // #then
      expect(result.current.items).toHaveLength(2);
    });
  });

  describe('provider filter', () => {
    it('filters albums to specified provider', () => {
      // #given
      mockUseLibrarySync.mockReturnValue(makeLibraryReturn([
        makeAlbum('alb-1', 'spotify'),
        makeAlbum('alb-2', 'dropbox' as ProviderId),
        makeAlbum('alb-3', 'spotify'),
      ]));

      // #when
      const { result } = renderHook(() => useAlbumsSection({ providerFilter: ['spotify'] }));

      // #then
      expect(result.current.items).toHaveLength(2);
      expect(result.current.items.every(a => a.provider === 'spotify')).toBe(true);
    });

    it('falls back to "spotify" for albums without a provider field', () => {
      // #given
      const albumWithoutProvider = { ...makeAlbum('alb-1') };
      delete (albumWithoutProvider as Record<string, unknown>).provider;
      mockUseLibrarySync.mockReturnValue(makeLibraryReturn(
        [albumWithoutProvider] as ReturnType<typeof useLibrarySync>['albums']
      ));

      // #when
      const { result } = renderHook(() => useAlbumsSection({ providerFilter: ['spotify'] }));

      // #then
      expect(result.current.items).toHaveLength(1);
    });
  });

  describe('pinned exclusion', () => {
    it('excludes pinned albums by default', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({ ...defaultPinnedItems, pinnedAlbumIds: ['alb-1'] });
      mockUseLibrarySync.mockReturnValue(makeLibraryReturn([makeAlbum('alb-1'), makeAlbum('alb-2')]));

      // #when
      const { result } = renderHook(() => useAlbumsSection({}));

      // #then
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('alb-2');
    });

    it('includes pinned albums when excludePinned is false', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({ ...defaultPinnedItems, pinnedAlbumIds: ['alb-1'] });
      mockUseLibrarySync.mockReturnValue(makeLibraryReturn([makeAlbum('alb-1'), makeAlbum('alb-2')]));

      // #when
      const { result } = renderHook(() => useAlbumsSection({ excludePinned: false }));

      // #then
      expect(result.current.items).toHaveLength(2);
    });

    it('applies both provider filter and pinned exclusion together', () => {
      // #given
      mockUsePinnedItems.mockReturnValue({ ...defaultPinnedItems, pinnedAlbumIds: ['alb-1'] });
      mockUseLibrarySync.mockReturnValue(makeLibraryReturn([
        makeAlbum('alb-1', 'spotify'),
        makeAlbum('alb-2', 'spotify'),
        makeAlbum('alb-3', 'dropbox' as ProviderId),
      ]));

      // #when
      const { result } = renderHook(() =>
        useAlbumsSection({ providerFilter: ['spotify'], excludePinned: true })
      );

      // #then — only alb-2 remains
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('alb-2');
    });
  });
});
