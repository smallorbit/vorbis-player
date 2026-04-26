import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRecentlyPlayedSection } from '../useRecentlyPlayedSection';
import type { RecentlyPlayedEntry } from '@/hooks/useRecentlyPlayedCollections';
import type { ProviderId } from '@/types/domain';

vi.mock('@/hooks/useRecentlyPlayedCollections', () => ({
  useRecentlyPlayedCollections: vi.fn(),
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: vi.fn(),
  LIBRARY_REFRESH_EVENT: 'vorbis-library-refresh',
  ART_REFRESHED_EVENT: 'vorbis-art-refreshed',
}));

import { useRecentlyPlayedCollections } from '@/hooks/useRecentlyPlayedCollections';
import { useLibrarySync } from '@/hooks/useLibrarySync';

const mockUseRecentlyPlayed = vi.mocked(useRecentlyPlayedCollections);
const mockUseLibrarySync = vi.mocked(useLibrarySync);

const makeEntry = (overrides?: Partial<RecentlyPlayedEntry>): RecentlyPlayedEntry => ({
  ref: { provider: 'spotify' as ProviderId, kind: 'playlist', id: 'pl-1' },
  name: 'Test Playlist',
  ...overrides,
});

const defaultLibrarySyncReturn = {
  playlists: [],
  albums: [],
  likedSongsCount: 0,
  likedSongsPerProvider: [],
  isInitialLoadComplete: true,
  isLikedSongsSyncing: false,
} as ReturnType<typeof useLibrarySync>;

describe('useRecentlyPlayedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRecentlyPlayed.mockReturnValue({ history: [], record: vi.fn() });
    mockUseLibrarySync.mockReturnValue(defaultLibrarySyncReturn);
  });

  describe('empty state', () => {
    it('returns isEmpty true when history is empty', () => {
      // #given — empty history
      mockUseRecentlyPlayed.mockReturnValue({ history: [], record: vi.fn() });

      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.isEmpty).toBe(true);
    });

    it('returns empty items array when history is empty', () => {
      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.items).toHaveLength(0);
    });

    it('always returns isLoading false', () => {
      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('history pass-through', () => {
    it('returns items matching history entries', () => {
      // #given
      const entry = makeEntry({ imageUrl: 'https://example.com/img.jpg' });
      mockUseRecentlyPlayed.mockReturnValue({ history: [entry], record: vi.fn() });

      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.items).toHaveLength(1);
      expect(result.current.isEmpty).toBe(false);
    });

    it('preserves existing imageUrl from history entry', () => {
      // #given
      const entry = makeEntry({ imageUrl: 'https://cached.example/img.jpg' });
      mockUseRecentlyPlayed.mockReturnValue({ history: [entry], record: vi.fn() });

      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.items[0].imageUrl).toBe('https://cached.example/img.jpg');
    });
  });

  describe('imageUrl hydration', () => {
    it('hydrates missing imageUrl from matching playlist in library', () => {
      // #given — entry without imageUrl, library has matching playlist
      const entry = makeEntry({ imageUrl: undefined });
      mockUseRecentlyPlayed.mockReturnValue({ history: [entry], record: vi.fn() });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        playlists: [{
          id: 'pl-1',
          name: 'Test Playlist',
          provider: 'spotify' as ProviderId,
          images: [{ url: 'https://library.example/img.jpg', height: 300, width: 300 }],
        }] as ReturnType<typeof useLibrarySync>['playlists'],
      });

      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.items[0].imageUrl).toBe('https://library.example/img.jpg');
    });

    it('hydrates missing imageUrl from matching album in library', () => {
      // #given — entry references an album
      const entry = makeEntry({
        ref: { provider: 'spotify' as ProviderId, kind: 'album', id: 'alb-1' },
        imageUrl: undefined,
      });
      mockUseRecentlyPlayed.mockReturnValue({ history: [entry], record: vi.fn() });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        albums: [{
          id: 'alb-1',
          name: 'Test Album',
          provider: 'spotify' as ProviderId,
          artists: 'Test Artist',
          images: [{ url: 'https://album.example/img.jpg', height: 300, width: 300 }],
          release_date: '2024',
          total_tracks: 10,
          uri: 'spotify:album:alb-1',
        }] as ReturnType<typeof useLibrarySync>['albums'],
      });

      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.items[0].imageUrl).toBe('https://album.example/img.jpg');
    });

    it('leaves imageUrl undefined when no library match found', () => {
      // #given — entry with no match in library
      const entry = makeEntry({ imageUrl: undefined });
      mockUseRecentlyPlayed.mockReturnValue({ history: [entry], record: vi.fn() });

      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.items[0].imageUrl).toBeUndefined();
    });

    it('does not use a library match from a different provider', () => {
      // #given — entry is spotify, library has same id but dropbox provider
      const entry = makeEntry({ imageUrl: undefined });
      mockUseRecentlyPlayed.mockReturnValue({ history: [entry], record: vi.fn() });
      mockUseLibrarySync.mockReturnValue({
        ...defaultLibrarySyncReturn,
        playlists: [{
          id: 'pl-1',
          name: 'Test Playlist',
          provider: 'dropbox' as ProviderId,
          images: [{ url: 'https://wrong.example/img.jpg', height: 300, width: 300 }],
        }] as ReturnType<typeof useLibrarySync>['playlists'],
      });

      // #when
      const { result } = renderHook(() => useRecentlyPlayedSection());

      // #then
      expect(result.current.items[0].imageUrl).toBeUndefined();
    });
  });
});
