import 'fake-indexeddb/auto';
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CachedPlaylistInfo, SyncState } from '../../services/cache/cacheTypes';
import type { AlbumInfo, SpotifyImage } from '../../services/spotify';
import type { ProviderId } from '@/types/domain';

const { mockSubscribe, mockStart, mockStop, mockSyncNow } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  mockSyncNow: vi.fn(),
}));

vi.mock('../../services/cache/librarySyncEngine', () => ({
  spotifyLibrarySyncEngine: {
    providerId: 'spotify',
    subscribe: mockSubscribe,
    start: mockStart,
    stop: mockStop,
    syncNow: mockSyncNow,
  },
}));

import { useEngineLibrarySync } from '../useEngineLibrarySync';

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

describe('useEngineLibrarySync', () => {
  let capturedListener: ((state: SyncState, pl?: CachedPlaylistInfo[], al?: AlbumInfo[], lc?: number) => void) | null = null;
  let unsubscribeFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedListener = null;
    unsubscribeFn = vi.fn();

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
  });

  it('does not subscribe when engineProviderId is undefined', () => {
    // #when
    renderHook(() => useEngineLibrarySync(undefined));

    // #then
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('returns empty data when engineProviderId is undefined', () => {
    // #when
    const { result } = renderHook(() => useEngineLibrarySync(undefined));

    // #then
    expect(result.current.playlists).toEqual([]);
    expect(result.current.albums).toEqual([]);
    expect(result.current.likedCount).toBe(0);
  });

  it('subscribes to the engine and starts on mount when a provider id is given', () => {
    // #when
    renderHook(() => useEngineLibrarySync('spotify' as ProviderId));

    // #then
    expect(mockSubscribe).toHaveBeenCalledOnce();
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it('unsubscribes on unmount but does not stop the engine', () => {
    // #given
    const { unmount } = renderHook(() => useEngineLibrarySync('spotify' as ProviderId));

    // #when
    unmount();

    // #then
    expect(unsubscribeFn).toHaveBeenCalledOnce();
    expect(mockStop).not.toHaveBeenCalled();
  });

  it('updates playlists/albums/likedCount when the engine emits new data', async () => {
    // #given
    const { result } = renderHook(() => useEngineLibrarySync('spotify' as ProviderId));

    // #when
    act(() => {
      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [makePlaylist('p1', 'My Playlist')],
        [makeAlbum('a1', 'My Album')],
        42,
      );
    });

    // #then
    await waitFor(() => {
      expect(result.current.playlists).toHaveLength(1);
      expect(result.current.playlists[0].name).toBe('My Playlist');
      expect(result.current.albums[0].name).toBe('My Album');
      expect(result.current.likedCount).toBe(42);
      expect(result.current.syncState.isInitialLoadComplete).toBe(true);
    });
  });

  it('stamps the engine providerId onto playlists and albums', async () => {
    // #given
    const { result } = renderHook(() => useEngineLibrarySync('spotify' as ProviderId));

    // #when
    act(() => {
      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [makePlaylist('p1')],
        [makeAlbum('a1')],
        0,
      );
    });

    // #then
    await waitFor(() => {
      expect(result.current.playlists[0].provider).toBe('spotify');
      expect(result.current.albums[0].provider).toBe('spotify');
    });
  });

  it('refresh calls syncNow when an engine is active', async () => {
    // #given
    const { result } = renderHook(() => useEngineLibrarySync('spotify' as ProviderId));

    // #when
    await result.current.refresh();

    // #then
    expect(mockSyncNow).toHaveBeenCalledOnce();
  });

  it('refresh is a no-op when no engine provider is active', async () => {
    // #given
    const { result } = renderHook(() => useEngineLibrarySync(undefined));

    // #when
    await result.current.refresh();

    // #then
    expect(mockSyncNow).not.toHaveBeenCalled();
  });

  it('keeps initialLoadComplete sticky once the engine emits true', async () => {
    // #given
    const { result } = renderHook(() => useEngineLibrarySync('spotify' as ProviderId));

    act(() => {
      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
      );
    });
    await waitFor(() => expect(result.current.syncState.isInitialLoadComplete).toBe(true));

    // #when — engine emits a later state with isInitialLoadComplete: false
    act(() => {
      capturedListener!(
        { isInitialLoadComplete: false, isSyncing: true, lastSyncTimestamp: 1000, error: null },
      );
    });

    // #then — sticky stays true
    await waitFor(() => expect(result.current.syncState.isInitialLoadComplete).toBe(true));
  });

  it('removeCollection optimistically drops a playlist by id', async () => {
    // #given
    const { result } = renderHook(() => useEngineLibrarySync('spotify' as ProviderId));
    act(() => {
      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [makePlaylist('p1', 'Keep'), makePlaylist('p2', 'Drop')],
        [],
        0,
      );
    });
    await waitFor(() => expect(result.current.playlists).toHaveLength(2));

    // #when
    act(() => {
      result.current.removeCollection('p2');
    });

    // #then
    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].id).toBe('p1');
  });
});
