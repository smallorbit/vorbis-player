import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { PinnedItemsProvider, usePinnedItemsContext } from '@/contexts/PinnedItemsContext';
import { LIKED_SONGS_ID, ALL_MUSIC_PIN_ID } from '@/constants/playlist';
import { MAX_PINS } from '@/services/settings/pinnedItemsStorage';

vi.mock('@/services/settings/pinnedItemsStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/settings/pinnedItemsStorage')>();
  const store: Record<string, string[]> = {};
  return {
    ...actual,
    getPins: vi.fn(async (_provider: string, type: string) => store[type] ?? []),
    setPins: vi.fn(async (_provider: string, type: string, ids: string[]) => { store[type] = ids; }),
    migratePinsFromLocalStorage: vi.fn(async () => {}),
  };
});

vi.mock('@/providers/dropbox/dropboxPreferencesSync', () => ({
  getPreferencesSync: vi.fn(() => null),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <PinnedItemsProvider>{children}</PinnedItemsProvider>;
}

describe('PinnedItemsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MAX_PINS cap with special cards', () => {
    it('pinning LIKED_SONGS_ID does not reduce remaining capacity for regular collections', async () => {
      // #given
      const { result } = renderHook(() => usePinnedItemsContext(), { wrapper });

      // #when — pin the special Liked Songs card
      act(() => {
        result.current.togglePinPlaylist(LIKED_SONGS_ID);
      });

      // #then — 12 regular collections can still be pinned
      expect(result.current.canPinMorePlaylists).toBe(true);
    });

    it('pinning ALL_MUSIC_PIN_ID does not reduce remaining capacity for regular collections', async () => {
      // #given
      const { result } = renderHook(() => usePinnedItemsContext(), { wrapper });

      // #when — pin the special All Music card
      act(() => {
        result.current.togglePinPlaylist(ALL_MUSIC_PIN_ID);
      });

      // #then — 12 regular collections can still be pinned
      expect(result.current.canPinMorePlaylists).toBe(true);
    });

    it(`allows ${MAX_PINS} regular playlists even when LIKED_SONGS_ID and ALL_MUSIC_PIN_ID are pinned`, async () => {
      // #given
      const { result } = renderHook(() => usePinnedItemsContext(), { wrapper });

      // pin both special cards
      act(() => {
        result.current.togglePinPlaylist(LIKED_SONGS_ID);
        result.current.togglePinPlaylist(ALL_MUSIC_PIN_ID);
      });

      // #when — pin MAX_PINS regular collections
      for (let i = 0; i < MAX_PINS; i++) {
        act(() => {
          result.current.togglePinPlaylist(`regular-playlist-${i}`);
        });
      }

      // #then — all MAX_PINS regular playlists are pinned (special cards don't count against the cap)
      const regularPins = result.current.pinnedPlaylistIds.filter(
        id => id !== LIKED_SONGS_ID && id !== ALL_MUSIC_PIN_ID
      );
      expect(regularPins).toHaveLength(MAX_PINS);
      expect(result.current.canPinMorePlaylists).toBe(false);
    });

    it('reports canPinMorePlaylists=false only when MAX_PINS regular collections are pinned', async () => {
      // #given
      const { result } = renderHook(() => usePinnedItemsContext(), { wrapper });

      // pin LIKED_SONGS_ID (special — should not count)
      act(() => {
        result.current.togglePinPlaylist(LIKED_SONGS_ID);
      });

      // pin MAX_PINS - 1 regular playlists
      for (let i = 0; i < MAX_PINS - 1; i++) {
        act(() => {
          result.current.togglePinPlaylist(`p-${i}`);
        });
      }

      // #when — still one slot remaining
      // #then
      expect(result.current.canPinMorePlaylists).toBe(true);

      // #when — fill the last slot
      act(() => {
        result.current.togglePinPlaylist(`p-${MAX_PINS - 1}`);
      });

      // #then — now at capacity
      expect(result.current.canPinMorePlaylists).toBe(false);
    });
  });
});
