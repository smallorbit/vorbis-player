import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { AlbumInfo } from '@/services/spotify';
import type { ProviderId } from '@/types/domain';

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

import { useAlbumsSection } from '../useAlbumsSection';

function makeAlbum(id: string, provider: ProviderId = 'spotify'): AlbumInfo {
  return {
    id,
    name: `Album ${id}`,
    artists: 'Test',
    images: [],
    release_date: '2024-01-01',
    total_tracks: 1,
    uri: `spotify:album:${id}`,
    provider,
  };
}

describe('useAlbumsSection', () => {
  beforeEach(() => {
    mockPinned.mockReset();
    mockLibrarySync.mockReset();
    mockPinned.mockReturnValue({ pinnedAlbumIds: [] });
  });

  it('returns full album list when no filter or pinning', () => {
    // #given
    mockLibrarySync.mockReturnValue({
      albums: [makeAlbum('a1'), makeAlbum('a2')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() => useAlbumsSection({ excludePinned: false }));

    // #then
    expect(result.current.items.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('excludes pinned albums when excludePinned is true (default)', () => {
    // #given
    mockPinned.mockReturnValue({ pinnedAlbumIds: ['a1'] });
    mockLibrarySync.mockReturnValue({
      albums: [makeAlbum('a1'), makeAlbum('a2')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() => useAlbumsSection());

    // #then
    expect(result.current.items.map((a) => a.id)).toEqual(['a2']);
  });

  it('filters by providerFilter', () => {
    // #given
    mockLibrarySync.mockReturnValue({
      albums: [makeAlbum('a1', 'spotify'), makeAlbum('a2', 'dropbox')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() =>
      useAlbumsSection({ providerFilter: ['dropbox'], excludePinned: false }),
    );

    // #then
    expect(result.current.items.map((a) => a.id)).toEqual(['a2']);
  });

  it('treats empty providerFilter array as no filter', () => {
    // #given
    mockLibrarySync.mockReturnValue({
      albums: [makeAlbum('a1', 'spotify'), makeAlbum('a2', 'dropbox')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() =>
      useAlbumsSection({ providerFilter: [], excludePinned: false }),
    );

    // #then
    expect(result.current.items.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('reports isLoading until initial load completes', () => {
    // #given
    mockLibrarySync.mockReturnValue({
      albums: [],
      isInitialLoadComplete: false,
    });

    // #when
    const { result } = renderHook(() => useAlbumsSection());

    // #then
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEmpty).toBe(true);
  });
});
