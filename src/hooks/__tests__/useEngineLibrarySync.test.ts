import 'fake-indexeddb/auto';
import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SyncState } from '../../services/cache/cacheTypes';
import type { MediaCollection, ProviderId } from '@/types/domain';

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

function makePlaylist(id: string, name?: string): MediaCollection {
  return {
    id,
    provider: 'spotify',
    kind: 'playlist',
    name: name ?? `Playlist ${id}`,
    trackCount: 10,
    ownerName: 'TestUser',
    genres: [],
  };
}

function makeAlbum(id: string, name?: string): MediaCollection {
  return {
    id,
    provider: 'spotify',
    kind: 'album',
    name: name ?? `Album ${id}`,
    ownerName: 'Test Artist',
    trackCount: 12,
    releaseDate: '2024-01-01',
    genres: [],
  };
}

describe('useEngineLibrarySync', () => {
  let capturedListener: ((state: SyncState, pl?: MediaCollection[], al?: MediaCollection[], lc?: number) => void) | null = null;
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
      expect(result.current.playlists[0]?.name).toBe('My Playlist');
      expect(result.current.albums[0]?.name).toBe('My Album');
      expect(result.current.likedCount).toBe(42);
      expect(result.current.syncState.isInitialLoadComplete).toBe(true);
    });
  });

  it('passes through provider-stamped engine records unchanged', async () => {
    // #given — the engine emits records already stamped with its provider
    const playlist = makePlaylist('p1');
    const album = makeAlbum('a1');
    const { result } = renderHook(() => useEngineLibrarySync('spotify' as ProviderId));

    // #when
    act(() => {
      capturedListener!(
        { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
        [playlist],
        [album],
        0,
      );
    });

    // #then — the hook does not re-stamp; the engine's records flow through as-is
    await waitFor(() => {
      expect(result.current.playlists[0]).toEqual(playlist);
      expect(result.current.albums[0]).toEqual(album);
      expect(result.current.playlists[0]?.provider).toBe('spotify');
      expect(result.current.albums[0]?.provider).toBe('spotify');
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
    expect(result.current.playlists[0]?.id).toBe('p1');
  });
});
