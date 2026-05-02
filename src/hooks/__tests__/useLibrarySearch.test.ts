import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useLibrarySearch } from '@/hooks/useLibrarySearch';
import {
  initCache,
  closeCache,
  clearAll,
  putAllPlaylists,
  putAllAlbums,
  putTrackList,
} from '@/services/cache/libraryCache';
import type { CachedPlaylistInfo } from '@/services/cache/cacheTypes';
import type { AlbumInfo, Track, SpotifyImage } from '@/services/spotify';

function makePlaylist(id: string, name: string): CachedPlaylistInfo {
  return {
    id,
    name,
    description: null,
    images: [] as SpotifyImage[],
    tracks: { total: 10 },
    owner: { display_name: 'TestUser' },
  };
}

function makeAlbum(id: string, name: string, artists = 'Test Artist'): AlbumInfo {
  return {
    id,
    name,
    artists,
    images: [] as SpotifyImage[],
    release_date: '2024-01-01',
    total_tracks: 12,
    uri: `spotify:album:${id}`,
    added_at: '2024-06-15T00:00:00Z',
  };
}

function makeTrack(id: string, name: string, artists = 'Artist'): Track {
  return {
    id,
    name,
    artists,
    album: 'Album',
    duration_ms: 200_000,
    uri: `spotify:track:${id}`,
  };
}

describe('useLibrarySearch', () => {
  beforeEach(async () => {
    await initCache();
    await clearAll();
    closeCache();
    localStorage.clear();
    await initCache();
  });

  afterEach(() => {
    closeCache();
  });

  it('returns an empty result for an empty query without loading', () => {
    // #when
    const { result } = renderHook(() => useLibrarySearch(''));

    // #then
    expect(result.current.results).toEqual({
      tracks: [],
      albums: [],
      artists: [],
      playlists: [],
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('does not query the cache before the debounce window elapses', async () => {
    // #given
    await putAllPlaylists([makePlaylist('p1', 'Rock Mix')]);

    const { result } = renderHook(() => useLibrarySearch('rock', { debounceMs: 150 }));

    // #then — synchronously after the first render, no query has resolved
    expect(result.current.isLoading).toBe(true);
    expect(result.current.results.playlists).toHaveLength(0);

    // #when — eventually the debounced query resolves
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.results.playlists.map((p) => p.id)).toEqual(['p1']);
  });

  it('clears results immediately when the query is reset to empty', async () => {
    // #given
    await putAllPlaylists([makePlaylist('p1', 'Rock Mix')]);

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useLibrarySearch(q, { debounceMs: 50 }),
      { initialProps: { q: 'rock' } },
    );

    await waitFor(() => {
      expect(result.current.results.playlists).toHaveLength(1);
    });

    // #when
    rerender({ q: '' });

    // #then
    expect(result.current.results.playlists).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('discards stale responses from superseded queries', async () => {
    // #given
    await putAllPlaylists([
      makePlaylist('p1', 'Rock Mix'),
      makePlaylist('p2', 'Jazz Hour'),
    ]);
    await putAllAlbums([makeAlbum('a1', 'Funeral', 'Arcade Fire')]);
    await putTrackList('liked-songs', [makeTrack('t1', 'Wake Up', 'Arcade Fire')]);

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useLibrarySearch(q, { debounceMs: 50 }),
      { initialProps: { q: 'rock' } },
    );

    // #when — swap to "jazz" before "rock" can settle
    rerender({ q: 'jazz' });

    // #then — only the most recent query's result is reflected
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.results.playlists.map((p) => p.id)).toEqual(['p2']);
  });

  it('respects a custom debounce window using fake timers', async () => {
    // #given
    await putAllPlaylists([makePlaylist('p1', 'Rock Mix')]);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { result } = renderHook(() => useLibrarySearch('rock', { debounceMs: 200 }));

      // #then — before the timer runs, still loading with no results
      expect(result.current.isLoading).toBe(true);
      expect(result.current.results.playlists).toHaveLength(0);

      // #when — let the debounce expire and async work flush
      await act(async () => {
        await vi.advanceTimersByTimeAsync(199);
      });
      expect(result.current.results.playlists).toHaveLength(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.results.playlists.map((p) => p.id)).toEqual(['p1']);
    } finally {
      vi.useRealTimers();
    }
  });
});
