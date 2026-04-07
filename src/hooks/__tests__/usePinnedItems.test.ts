import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { usePinnedItems } from '../usePinnedItems';
import { PinnedItemsProvider } from '@/contexts/PinnedItemsContext';

vi.mock('@/services/settings/pinnedItemsStorage', () => ({
  getPins: vi.fn().mockResolvedValue([]),
  setPins: vi.fn().mockResolvedValue(undefined),
  migratePinsFromLocalStorage: vi.fn().mockResolvedValue(undefined),
  MAX_PINS: 12,
  UNIFIED_PROVIDER: '_unified',
  PINS_CHANGED_EVENT: 'vorbis-pins-changed',
}));

import { getPins, setPins } from '@/services/settings/pinnedItemsStorage';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(PinnedItemsProvider, null, children);

describe('usePinnedItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getPins as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (setPins as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('should initialize with empty arrays', async () => {
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => {
      expect(result.current.pinnedPlaylistIds).toEqual([]);
      expect(result.current.pinnedAlbumIds).toEqual([]);
    });
  });

  it('should read existing pinned IDs from storage', async () => {
    // #given - mock storage with existing pins
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) => {
        if (type === 'playlists') return Promise.resolve(['p1', 'p2']);
        if (type === 'albums') return Promise.resolve(['a1']);
        return Promise.resolve([]);
      }
    );

    // #when - initialize hook
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    // #then
    await waitFor(() => {
      expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2']);
      expect(result.current.pinnedAlbumIds).toEqual(['a1']);
    });
  });

  it('should pin an unpinned playlist', async () => {
    // #given
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual([]));

    // #when - pin a new playlist
    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    // #then
    expect(result.current.pinnedPlaylistIds).toEqual(['p1']);
    expect(result.current.isPlaylistPinned('p1')).toBe(true);
    expect(setPins).toHaveBeenCalledWith('_unified', 'playlists', ['p1']);
  });

  it('should unpin a pinned playlist', async () => {
    // #given - initialize with two pinned playlists
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'playlists' ? Promise.resolve(['p1', 'p2']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2']));

    // #when - unpin one playlist
    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    // #then
    expect(result.current.pinnedPlaylistIds).toEqual(['p2']);
    expect(result.current.isPlaylistPinned('p1')).toBe(false);
    expect(setPins).toHaveBeenCalledWith('_unified', 'playlists', ['p2']);
  });

  it('should not pin beyond 12 playlists', async () => {
    // #given - initialize with max playlists (12)
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'playlists' ? Promise.resolve(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']));

    // #when - attempt to pin another playlist
    act(() => {
      result.current.togglePinPlaylist('p13');
    });

    // #then
    expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']);
    expect(result.current.canPinMorePlaylists).toBe(false);
  });

  it('should pin an unpinned album', async () => {
    // #given
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedAlbumIds).toEqual([]));

    // #when - pin a new album
    act(() => {
      result.current.togglePinAlbum('a1');
    });

    // #then
    expect(result.current.pinnedAlbumIds).toEqual(['a1']);
    expect(result.current.isAlbumPinned('a1')).toBe(true);
    expect(setPins).toHaveBeenCalledWith('_unified', 'albums', ['a1']);
  });

  it('should unpin a pinned album', async () => {
    // #given - initialize with two pinned albums
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'albums' ? Promise.resolve(['a1', 'a2']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedAlbumIds).toEqual(['a1', 'a2']));

    // #when - unpin one album
    act(() => {
      result.current.togglePinAlbum('a1');
    });

    // #then
    expect(result.current.pinnedAlbumIds).toEqual(['a2']);
    expect(result.current.isAlbumPinned('a1')).toBe(false);
    expect(setPins).toHaveBeenCalledWith('_unified', 'albums', ['a2']);
  });

  it('should not pin beyond 12 albums', async () => {
    // #given - initialize with max albums (12)
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'albums' ? Promise.resolve(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedAlbumIds).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12']));

    // #when - attempt to pin another album
    act(() => {
      result.current.togglePinAlbum('a13');
    });

    // #then
    expect(result.current.pinnedAlbumIds).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12']);
    expect(result.current.canPinMoreAlbums).toBe(false);
  });

  it('should report canPinMore correctly', async () => {
    // #given
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual([]));

    expect(result.current.canPinMorePlaylists).toBe(true);
    expect(result.current.canPinMoreAlbums).toBe(true);

    // #when - pin 11 playlists
    act(() => {
      result.current.togglePinPlaylist('p1');
      result.current.togglePinPlaylist('p2');
      result.current.togglePinPlaylist('p3');
      result.current.togglePinPlaylist('p4');
      result.current.togglePinPlaylist('p5');
      result.current.togglePinPlaylist('p6');
      result.current.togglePinPlaylist('p7');
      result.current.togglePinPlaylist('p8');
      result.current.togglePinPlaylist('p9');
      result.current.togglePinPlaylist('p10');
      result.current.togglePinPlaylist('p11');
    });

    // #then - still have capacity
    expect(result.current.canPinMorePlaylists).toBe(true);

    // #when - pin 12th playlist
    act(() => {
      result.current.togglePinPlaylist('p12');
    });

    // #then - at max capacity
    expect(result.current.canPinMorePlaylists).toBe(false);
  });

  it('should persist to storage on change', async () => {
    // #given
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual([]));

    // #when - pin a playlist
    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    // #then
    expect(setPins).toHaveBeenCalledWith('_unified', 'playlists', ['p1']);

    // #when - pin an album
    act(() => {
      result.current.togglePinAlbum('a1');
    });

    // #then
    expect(setPins).toHaveBeenCalledWith('_unified', 'albums', ['a1']);
  });

  it('should allow unpinning even when at max capacity', async () => {
    // #given - initialize with max playlists
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'playlists' ? Promise.resolve(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']));

    // #when - unpin one while at max
    act(() => {
      result.current.togglePinPlaylist('p2');
    });

    // #then
    expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']);
    expect(result.current.canPinMorePlaylists).toBe(true);
  });

  it('should preserve pin order (appended at end)', async () => {
    // #given
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual([]));

    // #when - pin playlists in sequence
    act(() => {
      result.current.togglePinPlaylist('p3');
    });
    act(() => {
      result.current.togglePinPlaylist('p1');
    });
    act(() => {
      result.current.togglePinPlaylist('p2');
    });

    // #then - order matches insertion sequence
    expect(result.current.pinnedPlaylistIds).toEqual(['p3', 'p1', 'p2']);
  });
});
