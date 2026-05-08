import 'fake-indexeddb/auto';
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MediaCollection, ProviderId } from '@/types/domain';

const mockGetDescriptor = vi.fn();

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: () => ({
    enabledProviderIds: [] as ProviderId[],
    getDescriptor: mockGetDescriptor,
  }),
}));

const mockRegistryGet = vi.fn();
vi.mock('@/providers/registry', () => ({
  providerRegistry: {
    get: (...args: unknown[]) => mockRegistryGet(...args),
    getAll: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('@/utils/libraryFirstSeen', () => ({
  getOrSetFirstSeenAddedAtIso: vi.fn().mockReturnValue('2024-01-01T00:00:00.000Z'),
}));

vi.mock('@/services/cache/likedCountSnapshot', () => ({
  readLikedCountSnapshots: vi.fn().mockReturnValue({}),
  writeLikedCountSnapshot: vi.fn(),
}));

import { useCatalogLibrarySync } from '../useCatalogLibrarySync';

function makeCatalogDescriptor(
  id: ProviderId,
  collections: MediaCollection[],
  likedCount = 0,
  getLikedCount?: () => Promise<number>,
) {
  return {
    id,
    catalog: {
      providerId: id,
      listCollections: vi.fn().mockResolvedValue(collections),
      listTracks: vi.fn().mockResolvedValue([]),
      getLikedCount: getLikedCount ?? vi.fn().mockResolvedValue(likedCount),
    },
    auth: {
      providerId: id,
      isAuthenticated: vi.fn().mockReturnValue(true),
      getAccessToken: vi.fn(),
      beginLogin: vi.fn(),
      handleCallback: vi.fn(),
      logout: vi.fn(),
    },
  };
}

function makeCollection(id: string, kind: 'playlist' | 'album' | 'folder' = 'playlist'): MediaCollection {
  return {
    id,
    provider: 'dropbox' as ProviderId,
    kind,
    name: `Collection ${id}`,
    description: null,
    imageUrl: null,
    trackCount: 5,
    ownerName: null,
    releaseDate: null,
    revision: null,
  };
}

describe('useCatalogLibrarySync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistryGet.mockReturnValue(undefined);
  });

  it('returns empty state when no provider ids are passed', () => {
    // #when
    const { result } = renderHook(() => useCatalogLibrarySync([] as readonly ProviderId[]));

    // #then
    expect(result.current.playlists).toEqual([]);
    expect(result.current.albums).toEqual([]);
    expect(result.current.totalLikedCount).toBe(0);
    expect(result.current.allMusicCount).toBe(0);
    expect(result.current.likedCounts).toEqual([]);
  });

  it('invokes listCollections for each provided id and exposes the merged result', async () => {
    // #given
    const dropboxAlbum = makeCollection('a-1', 'album');
    const dropboxFolder = makeCollection('f-1', 'folder');
    const dropboxDescriptor = makeCatalogDescriptor('dropbox', [dropboxAlbum, dropboxFolder], 9);
    mockGetDescriptor.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? dropboxDescriptor : undefined,
    );

    // #when
    const { result } = renderHook(() => useCatalogLibrarySync(['dropbox'] as readonly ProviderId[]));

    // #then
    await waitFor(() => {
      expect(dropboxDescriptor.catalog.listCollections).toHaveBeenCalled();
      expect(result.current.albums.some(a => a.name === 'Collection a-1')).toBe(true);
      expect(result.current.playlists.some(p => p.name === 'Collection f-1')).toBe(true);
      expect(result.current.totalLikedCount).toBe(9);
      expect(result.current.likedCounts).toEqual([{ provider: 'dropbox', count: 9 }]);
    });
  });

  it('skips an unauthenticated provider without calling listCollections', async () => {
    // #given
    const descriptor = makeCatalogDescriptor('dropbox', [], 0);
    descriptor.auth.isAuthenticated.mockReturnValue(false);
    mockGetDescriptor.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? descriptor : undefined,
    );

    // #when
    const { result } = renderHook(() => useCatalogLibrarySync(['dropbox'] as readonly ProviderId[]));

    // #then
    await waitFor(() => expect(result.current.playlists).toEqual([]));
    expect(descriptor.catalog.listCollections).not.toHaveBeenCalled();
    expect(result.current.syncState.error).toBeNull();
  });

  it('records syncError when listCollections throws', async () => {
    // #given
    const descriptor = makeCatalogDescriptor('dropbox', []);
    descriptor.catalog.listCollections.mockRejectedValue(new Error('Catalog unavailable'));
    mockGetDescriptor.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? descriptor : undefined,
    );

    // #when
    const { result } = renderHook(() => useCatalogLibrarySync(['dropbox'] as readonly ProviderId[]));

    // #then
    await waitFor(() => {
      expect(result.current.syncState.error).toBe('Catalog unavailable');
    });
  });

  it('extracts the Dropbox All-Music aggregate row into allMusicCount', async () => {
    // #given
    const allMusicRow: MediaCollection = {
      ...makeCollection('a-1', 'album'),
      id: '',
      trackCount: 1234,
    };
    const realPlaylist = makeCollection('f-1', 'folder');
    const descriptor = makeCatalogDescriptor('dropbox', [allMusicRow, realPlaylist]);
    mockGetDescriptor.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? descriptor : undefined,
    );

    // #when
    const { result } = renderHook(() => useCatalogLibrarySync(['dropbox'] as readonly ProviderId[]));

    // #then
    await waitFor(() => {
      expect(result.current.allMusicCount).toBe(1234);
      expect(result.current.playlists.some(p => p.id === '')).toBe(false);
    });
  });

  it('reacts to the registered likes-changed event by re-fetching the liked count', async () => {
    // #given
    const getLikedCount = vi.fn().mockResolvedValue(3);
    const descriptor = makeCatalogDescriptor('dropbox', [], 3, getLikedCount);
    mockGetDescriptor.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? descriptor : undefined,
    );
    mockRegistryGet.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? { likesChangedEvent: 'vorbis-test-likes-changed' } : undefined,
    );

    const { result } = renderHook(() => useCatalogLibrarySync(['dropbox'] as readonly ProviderId[]));
    await waitFor(() => expect(descriptor.catalog.listCollections).toHaveBeenCalled());

    getLikedCount.mockResolvedValue(11);

    // #when
    act(() => {
      window.dispatchEvent(new Event('vorbis-test-likes-changed'));
    });

    // #then
    await waitFor(() => {
      expect(result.current.totalLikedCount).toBeGreaterThanOrEqual(11);
    });
  });

  it('refresh forces listCollections to re-run with forceRefresh', async () => {
    // #given
    const descriptor = makeCatalogDescriptor('dropbox', [], 4);
    mockGetDescriptor.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? descriptor : undefined,
    );

    const { result } = renderHook(() => useCatalogLibrarySync(['dropbox'] as readonly ProviderId[]));
    await waitFor(() => expect(descriptor.catalog.listCollections).toHaveBeenCalledTimes(1));

    // #when
    await act(async () => {
      await result.current.refresh();
    });

    // #then
    expect(descriptor.catalog.listCollections).toHaveBeenCalledTimes(2);
    expect(descriptor.catalog.listCollections.mock.calls[1][1]).toEqual({ forceRefresh: true });
  });

  it('refresh scoped to one provider does not refetch other providers', async () => {
    // #given
    const dropbox = makeCatalogDescriptor('dropbox', [], 4);
    const apple = makeCatalogDescriptor('apple' as ProviderId, [], 5);
    mockGetDescriptor.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? dropbox : id === ('apple' as ProviderId) ? apple : undefined,
    );

    const { result } = renderHook(() =>
      useCatalogLibrarySync(['dropbox', 'apple' as ProviderId] as readonly ProviderId[]),
    );
    await waitFor(() => {
      expect(dropbox.catalog.listCollections).toHaveBeenCalledTimes(1);
      expect(apple.catalog.listCollections).toHaveBeenCalledTimes(1);
    });

    // #when
    await act(async () => {
      await result.current.refresh('dropbox' as ProviderId);
    });

    // #then
    expect(dropbox.catalog.listCollections).toHaveBeenCalledTimes(2);
    expect(apple.catalog.listCollections).toHaveBeenCalledTimes(1);
  });

  it('removeCollection drops a collection from the merged output', async () => {
    // #given
    const descriptor = makeCatalogDescriptor(
      'dropbox',
      [makeCollection('keep', 'folder'), makeCollection('drop', 'folder')],
    );
    mockGetDescriptor.mockImplementation((id: ProviderId) =>
      id === 'dropbox' ? descriptor : undefined,
    );

    const { result } = renderHook(() => useCatalogLibrarySync(['dropbox'] as readonly ProviderId[]));
    await waitFor(() => {
      expect(result.current.playlists.some(p => p.id === 'drop')).toBe(true);
    });

    // #when
    act(() => {
      result.current.removeCollection('drop');
    });

    // #then
    expect(result.current.playlists.some(p => p.id === 'drop')).toBe(false);
    expect(result.current.playlists.some(p => p.id === 'keep')).toBe(true);
  });
});
