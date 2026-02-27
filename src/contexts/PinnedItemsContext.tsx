import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const MAX_PINS_PER_TAB = 4;

interface PinnedItemsContextValue {
  pinnedPlaylistIds: string[];
  pinnedAlbumIds: string[];
  isPlaylistPinned: (id: string) => boolean;
  isAlbumPinned: (id: string) => boolean;
  togglePinPlaylist: (id: string) => void;
  togglePinAlbum: (id: string) => void;
  canPinMorePlaylists: boolean;
  canPinMoreAlbums: boolean;
}

const PinnedItemsContext = createContext<PinnedItemsContextValue | null>(null);

export function PinnedItemsProvider({ children }: { children: React.ReactNode }) {
  const [pinnedPlaylistIds, setPinnedPlaylistIds] = useLocalStorage<string[]>(
    'vorbis-player-pinned-playlists',
    []
  );
  const [pinnedAlbumIds, setPinnedAlbumIds] = useLocalStorage<string[]>(
    'vorbis-player-pinned-albums',
    []
  );

  const isPlaylistPinned = useCallback(
    (id: string) => pinnedPlaylistIds.includes(id),
    [pinnedPlaylistIds]
  );

  const isAlbumPinned = useCallback(
    (id: string) => pinnedAlbumIds.includes(id),
    [pinnedAlbumIds]
  );

  const togglePinPlaylist = useCallback((id: string) => {
    setPinnedPlaylistIds(prev => {
      if (prev.includes(id)) return prev.filter(pid => pid !== id);
      if (prev.length >= MAX_PINS_PER_TAB) return prev;
      return [...prev, id];
    });
  }, [setPinnedPlaylistIds]);

  const togglePinAlbum = useCallback((id: string) => {
    setPinnedAlbumIds(prev => {
      if (prev.includes(id)) return prev.filter(pid => pid !== id);
      if (prev.length >= MAX_PINS_PER_TAB) return prev;
      return [...prev, id];
    });
  }, [setPinnedAlbumIds]);

  const canPinMorePlaylists = pinnedPlaylistIds.length < MAX_PINS_PER_TAB;
  const canPinMoreAlbums = pinnedAlbumIds.length < MAX_PINS_PER_TAB;

  const value = useMemo<PinnedItemsContextValue>(() => ({
    pinnedPlaylistIds,
    pinnedAlbumIds,
    isPlaylistPinned,
    isAlbumPinned,
    togglePinPlaylist,
    togglePinAlbum,
    canPinMorePlaylists,
    canPinMoreAlbums,
  }), [
    pinnedPlaylistIds,
    pinnedAlbumIds,
    isPlaylistPinned,
    isAlbumPinned,
    togglePinPlaylist,
    togglePinAlbum,
    canPinMorePlaylists,
    canPinMoreAlbums,
  ]);

  return <PinnedItemsContext.Provider value={value}>{children}</PinnedItemsContext.Provider>;
}

export function usePinnedItemsContext(): PinnedItemsContextValue {
  const ctx = useContext(PinnedItemsContext);
  if (!ctx) throw new Error('usePinnedItemsContext must be used within PinnedItemsProvider');
  return ctx;
}
