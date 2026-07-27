import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useLibrarySearch } from '@/hooks/useLibrarySearch';
import {
  initCache,
  closeCache,
  clearAll,
  replaceProviderPlaylists,
  replaceProviderAlbums,
  putTrackList,
} from '@/services/cache/libraryCache';
import type { MediaCollection, MediaTrack } from '@/types/domain';

function makePlaylist(id: string, name: string): MediaCollection {
  return {
    id,
    provider: 'spotify',
    kind: 'playlist',
    name,
    trackCount: 10,
    ownerName: 'TestUser',
    genres: [],
  };
}

function makeAlbum(id: string, name: string, ownerName = 'Test Artist'): MediaCollection {
  return {
    id,
    provider: 'spotify',
    kind: 'album',
    name,
    ownerName,
    trackCount: 12,
    releaseDate: '2024-01-01',
    genres: [],
  };
}

function makeTrack(id: string, name: string, artists = 'Artist'): MediaTrack {
  return {
    id,
    provider: 'spotify',
    playbackRef: { provider: 'spotify', ref: `spotify:track:${id}` },
    name,
    artists,
    album: 'Album',
    durationMs: 200_000,
    genres: [],
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
    await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Rock Mix')]);

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
    await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Rock Mix')]);

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
    await replaceProviderPlaylists('spotify', [
      makePlaylist('p1', 'Rock Mix'),
      makePlaylist('p2', 'Jazz Hour'),
    ]);
    await replaceProviderAlbums('spotify', [makeAlbum('a1', 'Funeral', 'Arcade Fire')]);
    await putTrackList(
      { provider: 'spotify', kind: 'liked' },
      [makeTrack('t1', 'Wake Up', 'Arcade Fire')],
    );

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
    await replaceProviderPlaylists('spotify', [makePlaylist('p1', 'Rock Mix')]);

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
