import 'fake-indexeddb/auto';
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CachedPlaylistInfo, SyncState } from '../../services/cache/cacheTypes';
import type { AlbumInfo, SpotifyImage } from '../../services/spotify';
import type { MediaCollection, ProviderId } from '@/types/domain';

// vi.hoisted runs before vi.mock, so variables are available when the factory runs
const { mockSubscribe, mockStart, mockStop, mockSyncNow } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  mockSyncNow: vi.fn(),
}));

vi.mock('../../services/cache/librarySyncEngine', () => ({
  librarySyncEngine: {
    providerId: 'spotify',
    subscribe: mockSubscribe,
    start: mockStart,
    stop: mockStop,
    syncNow: mockSyncNow,
  },
}));

vi.mock('@/services/spotifyPlayer', () => ({
  spotifyPlayer: {
    setVolume: vi.fn().mockResolvedValue(undefined),
    onPlayerStateChanged: vi.fn(() => vi.fn()),
    getCurrentState: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
    playTrack: vi.fn().mockResolvedValue(undefined),
    getDeviceId: vi.fn().mockReturnValue(null),
    getIsReady: vi.fn().mockReturnValue(false),
  },
}));

const mockGetDescriptor = vi.fn();
const mockEnabledProviderIds: ProviderId[] = [];

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: () => ({
    enabledProviderIds: mockEnabledProviderIds,
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

// Import after mocking
import { useLibrarySync } from '../useLibrarySync';

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

function makePlaylist(id: string, name?: string): CachedPlaylistInfo {
  return {
    id,
    name: name ?? `Playlist ${id}`,
    description: null,
    images: [] as SpotifyImage[],
    tracks: { total: 10 },
    owner: { display_name: 'TestUser' },
  };
}

function makeAlbum(id: string, name?: string): AlbumInfo {
  return {
    id,
    name: name ?? `Album ${id}`,
    artists: 'Test Artist',
    images: [] as SpotifyImage[],
    release_date: '2024-01-01',
    total_tracks: 12,
    uri: `spotify:album:${id}`,
  };
}

describe('useLibrarySync', () => {
  let capturedListener: ((state: SyncState, pl?: CachedPlaylistInfo[], al?: AlbumInfo[], lc?: number) => void) | null = null;
  let unsubscribeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedListener = null;
    unsubscribeFn = vi.fn();

    // Default: spotify engine provider is enabled, no catalog providers
    mockEnabledProviderIds.length = 0;
    mockEnabledProviderIds.push('spotify');

    mockSubscribe.mockImplementation((listener: typeof capturedListener) => {
      capturedListener = listener;
      listener!({
        isInitialLoadComplete: false,
        isSyncing: false,
        lastSyncTimestamp: null,
        error: null,
      });
      return unsubscribeFn;
    });

    mockStart.mockResolvedValue(undefined);
    mockSyncNow.mockResolvedValue(undefined);
    mockRegistryGet.mockReturnValue(undefined);
  });

  afterEach(() => {
    capturedListener = null;
  });

  it('should start with empty state', () => {
    // #when
    const { result } = renderHook(() => useLibrarySync());

    // #then
    expect(result.current.playlists).toEqual([]);
    expect(result.current.albums).toEqual([]);
    expect(result.current.likedSongsCount).toBe(0);
    expect(result.current.isInitialLoadComplete).toBe(false);
    expect(result.current.isSyncing).toBe(false);
  });

  it('should subscribe to engine and start on mount', () => {
    // #when
    renderHook(() => useLibrarySync());

    // #then
    expect(mockSubscribe).toHaveBeenCalledOnce();
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it('should unsubscribe on unmount but keep engine running', () => {
    // #given
    const { unmount } = renderHook(() => useLibrarySync());

    // #when
    unmount();

    // #then
    expect(unsubscribeFn).toHaveBeenCalledOnce();
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('should update state when engine emits data', async () => {
    // #given
    const { result } = renderHook(() => useLibrarySync());
    const playlists = [makePlaylist('p1', 'My Playlist')];
    const albums = [makeAlbum('a1', 'My Album')];

    // #when
    capturedListener!(
      { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
      playlists,
      albums,
      42,
    );

    // #then
    await waitFor(() => {
      expect(result.current.playlists).toHaveLength(1);
      expect(result.current.playlists[0].name).toBe('My Playlist');
      expect(result.current.albums).toHaveLength(1);
      expect(result.current.albums[0].name).toBe('My Album');
      expect(result.current.likedSongsCount).toBe(42);
      expect(result.current.isInitialLoadComplete).toBe(true);
    });
  });

  it('should expose refreshNow that calls syncNow', async () => {
    // #given
    const { result } = renderHook(() => useLibrarySync());

    // #when
    await result.current.refreshNow();

    // #then
    expect(mockSyncNow).toHaveBeenCalledOnce();
  });

  it('should handle sync errors', async () => {
    // #given
    const { result } = renderHook(() => useLibrarySync());

    // #when
    capturedListener!(
      { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: null, error: 'Network error' },
    );

    // #then
    await waitFor(() => {
      expect(result.current.syncError).toBe('Network error');
      expect(result.current.isSyncing).toBe(false);
    });
  });

  describe('multi-provider merge', () => {
    it('merges engine playlists with catalog provider albums', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const dropboxAlbum = makeCollection('album-1', 'album');
      const dropboxPlaylist = makeCollection('folder-1', 'folder');
      const dropboxDescriptor = makeCatalogDescriptor('dropbox', [dropboxAlbum, dropboxPlaylist], 7);
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      // #when
      const { result } = renderHook(() => useLibrarySync());

      // Engine emits its data
      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [makePlaylist('sp1', 'Spotify Playlist')],
        [],
        15,
      );

      // #then
      await waitFor(() => {
        expect(result.current.playlists.some(p => p.name === 'Spotify Playlist')).toBe(true);
        expect(result.current.albums.some(a => a.name === 'Collection album-1')).toBe(true);
        expect(result.current.playlists.some(p => p.name === 'Collection folder-1')).toBe(true);
      });
    });

    it('accumulates likedSongsCount from engine and catalog providers', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const dropboxDescriptor = makeCatalogDescriptor('dropbox', [], 7);
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      // #when
      const { result } = renderHook(() => useLibrarySync());

      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [],
        [],
        15,
      );

      // #then — engine(15) + dropbox(7) = 22
      await waitFor(() => {
        expect(result.current.likedSongsCount).toBe(22);
      });
    });

    it('tracks likedSongsPerProvider for each enabled provider with liked songs', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const dropboxDescriptor = makeCatalogDescriptor('dropbox', [], 7);
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      // #when
      const { result } = renderHook(() => useLibrarySync());

      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [],
        [],
        15,
      );

      // #then
      await waitFor(() => {
        const perProvider = result.current.likedSongsPerProvider;
        expect(perProvider.find(p => p.provider === 'spotify')?.count).toBe(15);
        expect(perProvider.find(p => p.provider === 'dropbox')?.count).toBe(7);
      });
    });
  });

  describe('catalog provider failure handling', () => {
    it('still loads remaining providers when one catalog provider fails', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const failingDescriptor = {
        id: 'dropbox' as ProviderId,
        catalog: {
          providerId: 'dropbox',
          listCollections: vi.fn().mockRejectedValue(new Error('Network failure')),
          listTracks: vi.fn().mockResolvedValue([]),
          getLikedCount: vi.fn().mockResolvedValue(0),
        },
        auth: {
          providerId: 'dropbox',
          isAuthenticated: vi.fn().mockReturnValue(true),
          getAccessToken: vi.fn(),
          beginLogin: vi.fn(),
          handleCallback: vi.fn(),
          logout: vi.fn(),
        },
      };
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? failingDescriptor : undefined,
      );

      // #when
      const { result } = renderHook(() => useLibrarySync());

      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [makePlaylist('sp1', 'Spotify Playlist')],
        [],
        0,
      );

      // #then — spotify data is still present despite dropbox failure
      await waitFor(() => {
        expect(result.current.isInitialLoadComplete).toBe(true);
        expect(result.current.playlists.some(p => p.name === 'Spotify Playlist')).toBe(true);
      });
    });

    it('sets syncError when catalog provider throws', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const failingDescriptor = {
        id: 'dropbox' as ProviderId,
        catalog: {
          providerId: 'dropbox',
          listCollections: vi.fn().mockRejectedValue(new Error('Catalog unavailable')),
          listTracks: vi.fn().mockResolvedValue([]),
          getLikedCount: vi.fn().mockResolvedValue(0),
        },
        auth: {
          providerId: 'dropbox',
          isAuthenticated: vi.fn().mockReturnValue(true),
          getAccessToken: vi.fn(),
          beginLogin: vi.fn(),
          handleCallback: vi.fn(),
          logout: vi.fn(),
        },
      };
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? failingDescriptor : undefined,
      );

      // #when
      const { result } = renderHook(() => useLibrarySync());

      // #then
      await waitFor(() => {
        expect(result.current.syncError).toBe('Catalog unavailable');
      });
    });

    it('skips unauthenticated catalog providers without error', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const unauthDescriptor = {
        id: 'dropbox' as ProviderId,
        catalog: {
          providerId: 'dropbox',
          listCollections: vi.fn(),
          listTracks: vi.fn().mockResolvedValue([]),
          getLikedCount: vi.fn().mockResolvedValue(0),
        },
        auth: {
          providerId: 'dropbox',
          isAuthenticated: vi.fn().mockReturnValue(false),
          getAccessToken: vi.fn(),
          beginLogin: vi.fn(),
          handleCallback: vi.fn(),
          logout: vi.fn(),
        },
      };
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? unauthDescriptor : undefined,
      );

      // #when
      const { result } = renderHook(() => useLibrarySync());

      // Let engine emit to make isInitialLoadComplete true
      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [],
        [],
        0,
      );

      // #then — no error, listCollections never called for unauthed provider
      await waitFor(() => expect(result.current.isInitialLoadComplete).toBe(true));
      expect(unauthDescriptor.catalog.listCollections).not.toHaveBeenCalled();
      expect(result.current.syncError).toBeNull();
    });
  });

  describe('likes-changed event handling', () => {
    it('updates likedSongsCount when provider fires its likes-changed event', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const getLikedCount = vi.fn().mockResolvedValue(3);
      const dropboxDescriptor = makeCatalogDescriptor('dropbox', [], 3, getLikedCount);
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      mockRegistryGet.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? { likesChangedEvent: 'vorbis-dropbox-likes-changed' } : undefined,
      );

      const { result } = renderHook(() => useLibrarySync());

      await waitFor(() => {
        expect(dropboxDescriptor.catalog.listCollections).toHaveBeenCalled();
      });

      getLikedCount.mockResolvedValue(10);

      // #when
      act(() => {
        window.dispatchEvent(new Event('vorbis-dropbox-likes-changed'));
      });

      // #then
      await waitFor(() => {
        expect(result.current.likedSongsCount).toBeGreaterThanOrEqual(10);
      });
    });

    it('does not react to likes-changed events from providers without a registered event name', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const getLikedCount = vi.fn().mockResolvedValue(5);
      const dropboxDescriptor = makeCatalogDescriptor('dropbox', [], 5, getLikedCount);
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      mockRegistryGet.mockReturnValue(undefined);

      renderHook(() => useLibrarySync());

      await waitFor(() => {
        expect(dropboxDescriptor.catalog.listCollections).toHaveBeenCalled();
      });

      getLikedCount.mockResolvedValue(99);

      // #when
      act(() => {
        window.dispatchEvent(new Event('vorbis-dropbox-likes-changed'));
      });

      await new Promise(r => setTimeout(r, 20));

      // #then
      expect(getLikedCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshNow with provider scoping', () => {
    it('refreshes only the specified catalog provider when scopeProviderId is passed', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const dropboxDescriptor = makeCatalogDescriptor('dropbox', [], 4);
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      const { result } = renderHook(() => useLibrarySync());

      await waitFor(() => {
        expect(dropboxDescriptor.catalog.listCollections).toHaveBeenCalledTimes(1);
      });

      // #when
      await act(async () => {
        await result.current.refreshNow('dropbox' as ProviderId);
      });

      // #then
      expect(dropboxDescriptor.catalog.listCollections).toHaveBeenCalledTimes(2);
      expect(mockSyncNow).not.toHaveBeenCalled();
    });

    it('refreshes engine when refreshNow is called without scope', async () => {
      // #given
      const { result } = renderHook(() => useLibrarySync());

      // #when
      await act(async () => {
        await result.current.refreshNow();
      });

      // #then
      expect(mockSyncNow).toHaveBeenCalledOnce();
    });

    it('refreshes engine when refreshNow is called scoped to the engine provider id', async () => {
      // #given
      const { result } = renderHook(() => useLibrarySync());

      // #when
      await act(async () => {
        await result.current.refreshNow('spotify' as ProviderId);
      });

      // #then
      expect(mockSyncNow).toHaveBeenCalledOnce();
    });

    it('does not call syncNow when refreshNow is scoped to a catalog-only provider', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const dropboxDescriptor = makeCatalogDescriptor('dropbox', [], 0);
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      const { result } = renderHook(() => useLibrarySync());

      // #when
      await act(async () => {
        await result.current.refreshNow('dropbox' as ProviderId);
      });

      // #then
      expect(mockSyncNow).not.toHaveBeenCalled();
    });
  });

  describe('catalogProviderIds stabilization', () => {
    it('does not re-fire catalog load effect across re-renders when the enabled-provider set is unchanged', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const dropboxDescriptor = makeCatalogDescriptor('dropbox', [], 0);
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      const { rerender } = renderHook(() => useLibrarySync());

      await waitFor(() => {
        expect(dropboxDescriptor.catalog.listCollections).toHaveBeenCalledTimes(1);
      });

      const callsBeforeRerender = dropboxDescriptor.catalog.listCollections.mock.calls.length;

      // #when — force several re-renders without changing the provider set
      rerender();
      rerender();
      rerender();

      await new Promise(r => setTimeout(r, 20));

      // #then — the catalog load effect should NOT have re-fired
      expect(dropboxDescriptor.catalog.listCollections).toHaveBeenCalledTimes(callsBeforeRerender);
    });
  });

  describe('removeCollection', () => {
    it('removes a collection from engine playlist data and re-merges', async () => {
      // #given
      const { result } = renderHook(() => useLibrarySync());

      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [makePlaylist('p1', 'Keep Me'), makePlaylist('p2', 'Remove Me')],
        [],
        0,
      );

      await waitFor(() => expect(result.current.playlists).toHaveLength(2));

      // #when
      act(() => {
        result.current.removeCollection('p2');
      });

      // #then
      expect(result.current.playlists).toHaveLength(1);
      expect(result.current.playlists[0].id).toBe('p1');
    });

    it('removes a collection from engine album data and re-merges', async () => {
      // #given
      const { result } = renderHook(() => useLibrarySync());

      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [],
        [makeAlbum('a1', 'Stay'), makeAlbum('a2', 'Go Away')],
        0,
      );

      await waitFor(() => expect(result.current.albums).toHaveLength(2));

      // #when
      act(() => {
        result.current.removeCollection('a2');
      });

      // #then
      expect(result.current.albums).toHaveLength(1);
      expect(result.current.albums[0].id).toBe('a1');
    });

    it('removes a collection from catalog provider data and re-merges', async () => {
      // #given
      mockEnabledProviderIds.length = 0;
      mockEnabledProviderIds.push('spotify', 'dropbox');

      const dropboxDescriptor = makeCatalogDescriptor(
        'dropbox',
        [makeCollection('folder-keep', 'folder'), makeCollection('folder-remove', 'folder')],
        0,
      );
      mockGetDescriptor.mockImplementation((id: ProviderId) =>
        id === 'dropbox' ? dropboxDescriptor : undefined,
      );

      const { result } = renderHook(() => useLibrarySync());

      await waitFor(() => {
        expect(result.current.playlists.some(p => p.id === 'folder-remove')).toBe(true);
      });

      // #when
      act(() => {
        result.current.removeCollection('folder-remove');
      });

      // #then
      expect(result.current.playlists.some(p => p.id === 'folder-remove')).toBe(false);
      expect(result.current.playlists.some(p => p.id === 'folder-keep')).toBe(true);
    });

    it('is a no-op when the collection id does not exist', async () => {
      // #given
      const { result } = renderHook(() => useLibrarySync());

      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [makePlaylist('p1', 'Only One')],
        [],
        0,
      );

      await waitFor(() => expect(result.current.playlists).toHaveLength(1));

      // #when
      act(() => {
        result.current.removeCollection('non-existent-id');
      });

      // #then
      expect(result.current.playlists).toHaveLength(1);
    });
  });
});
