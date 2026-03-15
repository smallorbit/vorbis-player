import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { usePinnedItems } from '../usePinnedItems';
import { PinnedItemsProvider } from '@/contexts/PinnedItemsContext';

vi.mock('@/services/settings/pinnedItemsStorage', () => ({
  getPins: vi.fn().mockResolvedValue([]),
  setPins: vi.fn().mockResolvedValue(undefined),
  migratePinsFromLocalStorage: vi.fn().mockResolvedValue(undefined),
  MAX_PINS: 8,
}));

vi.mock('@/contexts/ProviderContext', () => ({
  useProviderContext: vi.fn().mockReturnValue({ activeProviderId: 'spotify' }),
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
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) => {
        if (type === 'playlists') return Promise.resolve(['p1', 'p2']);
        if (type === 'albums') return Promise.resolve(['a1']);
        return Promise.resolve([]);
      }
    );

    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => {
      expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2']);
      expect(result.current.pinnedAlbumIds).toEqual(['a1']);
    });
  });

  it('should pin an unpinned playlist', async () => {
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual([]));

    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p1']);
    expect(result.current.isPlaylistPinned('p1')).toBe(true);
    expect(setPins).toHaveBeenCalledWith('spotify', 'playlists', ['p1']);
  });

  it('should unpin a pinned playlist', async () => {
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'playlists' ? Promise.resolve(['p1', 'p2']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2']));

    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p2']);
    expect(result.current.isPlaylistPinned('p1')).toBe(false);
    expect(setPins).toHaveBeenCalledWith('spotify', 'playlists', ['p2']);
  });

  it('should not pin beyond 8 playlists', async () => {
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'playlists' ? Promise.resolve(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']));

    act(() => {
      result.current.togglePinPlaylist('p9');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    expect(result.current.canPinMorePlaylists).toBe(false);
  });

  it('should pin an unpinned album', async () => {
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedAlbumIds).toEqual([]));

    act(() => {
      result.current.togglePinAlbum('a1');
    });

    expect(result.current.pinnedAlbumIds).toEqual(['a1']);
    expect(result.current.isAlbumPinned('a1')).toBe(true);
    expect(setPins).toHaveBeenCalledWith('spotify', 'albums', ['a1']);
  });

  it('should unpin a pinned album', async () => {
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'albums' ? Promise.resolve(['a1', 'a2']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedAlbumIds).toEqual(['a1', 'a2']));

    act(() => {
      result.current.togglePinAlbum('a1');
    });

    expect(result.current.pinnedAlbumIds).toEqual(['a2']);
    expect(result.current.isAlbumPinned('a1')).toBe(false);
    expect(setPins).toHaveBeenCalledWith('spotify', 'albums', ['a2']);
  });

  it('should not pin beyond 8 albums', async () => {
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'albums' ? Promise.resolve(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedAlbumIds).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']));

    act(() => {
      result.current.togglePinAlbum('a9');
    });

    expect(result.current.pinnedAlbumIds).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8']);
    expect(result.current.canPinMoreAlbums).toBe(false);
  });

  it('should report canPinMore correctly', async () => {
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual([]));

    expect(result.current.canPinMorePlaylists).toBe(true);
    expect(result.current.canPinMoreAlbums).toBe(true);

    act(() => {
      result.current.togglePinPlaylist('p1');
      result.current.togglePinPlaylist('p2');
      result.current.togglePinPlaylist('p3');
      result.current.togglePinPlaylist('p4');
      result.current.togglePinPlaylist('p5');
      result.current.togglePinPlaylist('p6');
      result.current.togglePinPlaylist('p7');
    });

    expect(result.current.canPinMorePlaylists).toBe(true);

    act(() => {
      result.current.togglePinPlaylist('p8');
    });

    expect(result.current.canPinMorePlaylists).toBe(false);
  });

  it('should persist to storage on change', async () => {
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual([]));

    act(() => {
      result.current.togglePinPlaylist('p1');
    });

    expect(setPins).toHaveBeenCalledWith('spotify', 'playlists', ['p1']);

    act(() => {
      result.current.togglePinAlbum('a1');
    });

    expect(setPins).toHaveBeenCalledWith('spotify', 'albums', ['a1']);
  });

  it('should allow unpinning even when at max capacity', async () => {
    (getPins as ReturnType<typeof vi.fn>).mockImplementation(
      (_provider: string, type: string) =>
        type === 'playlists' ? Promise.resolve(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']) : Promise.resolve([])
    );
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']));

    act(() => {
      result.current.togglePinPlaylist('p2');
    });

    expect(result.current.pinnedPlaylistIds).toEqual(['p1', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    expect(result.current.canPinMorePlaylists).toBe(true);
  });

  it('should preserve pin order (appended at end)', async () => {
    const { result } = renderHook(() => usePinnedItems(), { wrapper });

    await waitFor(() => expect(result.current.pinnedPlaylistIds).toEqual([]));

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
