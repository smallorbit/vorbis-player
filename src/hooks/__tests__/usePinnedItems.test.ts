import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePinnedItems } from '../usePinnedItems';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

describe('usePinnedItems', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('should initialize with empty arrays', () => {
    const { result } = renderHook(() => usePinnedItems());
    expect(result.current.pinnedPlaylistIds).toEqual([]);
    expect(result.current.pinnedAlbumIds).toEqual([]);
  });

  it('should read existing pinned IDs from localStorage', () => {
    localStorageMock.setItem('vorbis-player-pinned-playlists', JSON.stringify(['p1', 'p2']));
    localStorageMock.setItem('vorbis-player-pinned-albums', JSON.stringify(['a1']));

    const { result } = renderHook(() => usePinnedItems());
    expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2']);
    expect(result.current.pinnedAlbumIds).toEqual(['a1']);
  });

  it('should pin an unpinned playlist', () => {
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p1']);
    expect(result.current.isPlaylistPinned('p1')).toBe(true);
  });

  it('should unpin a pinned playlist', () => {
    localStorageMock.setItem('vorbis-player-pinned-playlists', JSON.stringify(['p1', 'p2']));
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p2']);
    expect(result.current.isPlaylistPinned('p1')).toBe(false);
  });

  it('should not pin beyond 4 playlists', () => {
    localStorageMock.setItem('vorbis-player-pinned-playlists', JSON.stringify(['p1', 'p2', 'p3', 'p4']));
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinPlaylist('p5');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(result.current.canPinMorePlaylists).toBe(false);
  });

  it('should pin an unpinned album', () => {
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinAlbum('a1');
    });

    expect(result.current.pinnedAlbumIds).toEqual(['a1']);
    expect(result.current.isAlbumPinned('a1')).toBe(true);
  });

  it('should unpin a pinned album', () => {
    localStorageMock.setItem('vorbis-player-pinned-albums', JSON.stringify(['a1', 'a2']));
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinAlbum('a1');
    });

    expect(result.current.pinnedAlbumIds).toEqual(['a2']);
    expect(result.current.isAlbumPinned('a1')).toBe(false);
  });

  it('should not pin beyond 4 albums', () => {
    localStorageMock.setItem('vorbis-player-pinned-albums', JSON.stringify(['a1', 'a2', 'a3', 'a4']));
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinAlbum('a5');
    });

    expect(result.current.pinnedAlbumIds).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(result.current.canPinMoreAlbums).toBe(false);
  });

  it('should report canPinMore correctly', () => {
    const { result } = renderHook(() => usePinnedItems());

    expect(result.current.canPinMorePlaylists).toBe(true);
    expect(result.current.canPinMoreAlbums).toBe(true);

    act(() => {
      result.current.togglePinPlaylist('p1');
      result.current.togglePinPlaylist('p2');
      result.current.togglePinPlaylist('p3');
    });

    expect(result.current.canPinMorePlaylists).toBe(true);

    act(() => {
      result.current.togglePinPlaylist('p4');
    });

    expect(result.current.canPinMorePlaylists).toBe(false);
  });

  it('should persist to localStorage on change', () => {
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    expect(localStorageMock.getItem('vorbis-player-pinned-playlists')).toBe(JSON.stringify(['p1']));

    act(() => {
      result.current.togglePinAlbum('a1');
    });

    expect(localStorageMock.getItem('vorbis-player-pinned-albums')).toBe(JSON.stringify(['a1']));
  });

  it('should allow unpinning even when at max capacity', () => {
    localStorageMock.setItem('vorbis-player-pinned-playlists', JSON.stringify(['p1', 'p2', 'p3', 'p4']));
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinPlaylist('p2');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p3', 'p4']);
    expect(result.current.canPinMorePlaylists).toBe(true);
  });

  it('should preserve pin order (appended at end)', () => {
    const { result } = renderHook(() => usePinnedItems());

    act(() => {
      result.current.togglePinPlaylist('p3');
    });
    act(() => {
      result.current.togglePinPlaylist('p1');
    });
    act(() => {
      result.current.togglePinPlaylist('p2');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p3', 'p1', 'p2']);
  });
});
