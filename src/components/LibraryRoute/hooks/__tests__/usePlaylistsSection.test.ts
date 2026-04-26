import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
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

import { usePlaylistsSection } from '../usePlaylistsSection';

function makePlaylist(id: string, provider: ProviderId = 'spotify'): CachedPlaylistInfo {
  return {
    id,
    name: `Playlist ${id}`,
    description: null,
    images: [],
    tracks: { total: 0 },
    owner: null,
    provider,
  };
}

describe('usePlaylistsSection', () => {
  beforeEach(() => {
    mockPinned.mockReset();
    mockLibrarySync.mockReset();
    mockPinned.mockReturnValue({ pinnedPlaylistIds: [] });
  });

  it('returns full playlist list when no filter or pinning', () => {
    // #given
    mockLibrarySync.mockReturnValue({
      playlists: [makePlaylist('p1'), makePlaylist('p2')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() => usePlaylistsSection({ excludePinned: false }));

    // #then
    expect(result.current.items.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('excludes pinned playlists when excludePinned is true (default)', () => {
    // #given
    mockPinned.mockReturnValue({ pinnedPlaylistIds: ['p1'] });
    mockLibrarySync.mockReturnValue({
      playlists: [makePlaylist('p1'), makePlaylist('p2')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() => usePlaylistsSection());

    // #then
    expect(result.current.items.map((p) => p.id)).toEqual(['p2']);
  });

  it('filters by providerFilter', () => {
    // #given
    mockLibrarySync.mockReturnValue({
      playlists: [
        makePlaylist('p1', 'spotify'),
        makePlaylist('p2', 'dropbox'),
        makePlaylist('p3', 'spotify'),
      ],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() =>
      usePlaylistsSection({ providerFilter: ['dropbox'], excludePinned: false }),
    );

    // #then
    expect(result.current.items.map((p) => p.id)).toEqual(['p2']);
  });

  it('treats empty providerFilter array as no filter', () => {
    // #given
    mockLibrarySync.mockReturnValue({
      playlists: [makePlaylist('p1', 'spotify'), makePlaylist('p2', 'dropbox')],
      isInitialLoadComplete: true,
    });

    // #when
    const { result } = renderHook(() =>
      usePlaylistsSection({ providerFilter: [], excludePinned: false }),
    );

    // #then
    expect(result.current.items.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('reports isLoading until initial load completes', () => {
    // #given
    mockLibrarySync.mockReturnValue({
      playlists: [],
      isInitialLoadComplete: false,
    });

    // #when
    const { result } = renderHook(() => usePlaylistsSection());

    // #then
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isEmpty).toBe(true);
  });
});
