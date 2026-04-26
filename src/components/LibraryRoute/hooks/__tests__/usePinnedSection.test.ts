import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { AlbumInfo, SpotifyImage } from '@/services/spotify';

const { mockPinned, mockLibrarySync } = vi.hoisted(() => ({
  mockPinned: vi.fn(),
  mockLibrarySync: vi.fn(),
}));

vi.mock('@/hooks/usePinnedItems', () => ({
  usePinnedItems: () => mockPinned(),
}));

vi.mock('@/hooks/useLibrarySync', () => ({
  useLibrarySync: () => mockLibrarySync(),
}));

import { usePinnedSection } from '../usePinnedSection';

function makePlaylist(id: string, imageUrl: string | null = null): CachedPlaylistInfo {
  const images: SpotifyImage[] = imageUrl ? [{ url: imageUrl, height: null, width: null }] : [];
  return {
    id,
    name: `Playlist ${id}`,
    description: null,
    images,
    tracks: { total: 0 },
    owner: null,
    provider: 'spotify',
  };
}

function makeAlbum(id: string, imageUrl: string | null = null): AlbumInfo {
  const images: SpotifyImage[] = imageUrl ? [{ url: imageUrl, height: null, width: null }] : [];
  return {
    id,
    name: `Album ${id}`,
    artists: 'Test',
    images,
    release_date: '2024-01-01',
    total_tracks: 1,
    uri: `spotify:album:${id}`,
    provider: 'spotify',
  };
}

describe('usePinnedSection', () => {
  beforeEach(() => {
    mockPinned.mockReset();
    mockLibrarySync.mockReset();
  });

  it('returns empty when nothing pinned', () => {
    // #given
    mockPinned.mockReturnValue({ pinnedPlaylistIds: [], pinnedAlbumIds: [] });
    mockLibrarySync.mockReturnValue({
      playlists: [makePlaylist('p1')],
      albums: [makeAlbum('a1')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() => usePinnedSection());

    // #then
    expect(result.current.combined).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('reports isLoading when library has not finished initial load', () => {
    // #given
    mockPinned.mockReturnValue({ pinnedPlaylistIds: [], pinnedAlbumIds: [] });
    mockLibrarySync.mockReturnValue({
      playlists: [],
      albums: [],
      isInitialLoadComplete: false,
    });

    // #when
    const { result } = renderHook(() => usePinnedSection());

    // #then
    expect(result.current.isLoading).toBe(true);
  });

  it('filters playlists and albums to only the pinned ids', () => {
    // #given
    mockPinned.mockReturnValue({ pinnedPlaylistIds: ['p1'], pinnedAlbumIds: ['a2'] });
    mockLibrarySync.mockReturnValue({
      playlists: [makePlaylist('p1', 'p1.png'), makePlaylist('p2', 'p2.png')],
      albums: [makeAlbum('a1', 'a1.png'), makeAlbum('a2', 'a2.png')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() => usePinnedSection());

    // #then
    expect(result.current.pinnedPlaylists.map((p) => p.id)).toEqual(['p1']);
    expect(result.current.pinnedAlbums.map((a) => a.id)).toEqual(['a2']);
  });

  it('orders combined list with playlists first then albums', () => {
    // #given
    mockPinned.mockReturnValue({ pinnedPlaylistIds: ['p1'], pinnedAlbumIds: ['a1'] });
    mockLibrarySync.mockReturnValue({
      playlists: [makePlaylist('p1', 'p1.png')],
      albums: [makeAlbum('a1', 'a1.png')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() => usePinnedSection());

    // #then
    expect(result.current.combined.map((c) => `${c.kind}:${c.id}`)).toEqual([
      'playlist:p1',
      'album:a1',
    ]);
    expect(result.current.combined[0].imageUrl).toBe('p1.png');
    expect(result.current.combined[1].imageUrl).toBe('a1.png');
  });
});
