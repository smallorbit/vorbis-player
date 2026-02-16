import 'fake-indexeddb/auto';
import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CachedPlaylistInfo, SyncState } from '../../services/cache/cacheTypes';
import type { AlbumInfo, SpotifyImage } from '../../services/spotify';

// vi.hoisted runs before vi.mock, so variables are available when the factory runs
const { mockSubscribe, mockStart, mockStop, mockSyncNow } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockStart: vi.fn(),
  mockStop: vi.fn(),
  mockSyncNow: vi.fn(),
}));

vi.mock('../../services/cache/librarySyncEngine', () => ({
  librarySyncEngine: {
    subscribe: mockSubscribe,
    start: mockStart,
    stop: mockStop,
    syncNow: mockSyncNow,
  },
}));

// Import after mocking
import { useLibrarySync } from '../useLibrarySync';

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

    mockSubscribe.mockImplementation((listener: typeof capturedListener) => {
      capturedListener = listener;
      // Emit initial state
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

  afterEach(() => {
    capturedListener = null;
  });

  it('should start with empty state', () => {
    const { result } = renderHook(() => useLibrarySync());

    expect(result.current.playlists).toEqual([]);
    expect(result.current.albums).toEqual([]);
    expect(result.current.likedSongsCount).toBe(0);
    expect(result.current.isInitialLoadComplete).toBe(false);
    expect(result.current.isSyncing).toBe(false);
  });

  it('should subscribe to engine and start on mount', () => {
    renderHook(() => useLibrarySync());

    expect(mockSubscribe).toHaveBeenCalledOnce();
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it('should unsubscribe and stop engine on unmount', () => {
    const { unmount } = renderHook(() => useLibrarySync());

    unmount();

    expect(unsubscribeFn).toHaveBeenCalledOnce();
    expect(mockStop).toHaveBeenCalledOnce();
  });

  it('should update state when engine emits data', async () => {
    const { result } = renderHook(() => useLibrarySync());

    const playlists = [makePlaylist('p1', 'My Playlist')];
    const albums = [makeAlbum('a1', 'My Album')];

    // Simulate engine emitting data
    capturedListener!(
      { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: 1000, error: null },
      playlists,
      albums,
      42,
    );

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
    const { result } = renderHook(() => useLibrarySync());

    await result.current.refreshNow();

    expect(mockSyncNow).toHaveBeenCalledOnce();
  });

  it('should handle sync errors', async () => {
    const { result } = renderHook(() => useLibrarySync());

    capturedListener!(
      { isInitialLoadComplete: true, isSyncing: false, lastSyncTimestamp: null, error: 'Network error' },
    );

    await waitFor(() => {
      expect(result.current.syncError).toBe('Network error');
      expect(result.current.isSyncing).toBe(false);
    });
  });
});
