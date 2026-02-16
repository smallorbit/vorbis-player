import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const MAX_PINS_PER_TAB = 4;

interface UsePinnedItemsReturn {
  pinnedPlaylistIds: string[];
  pinnedAlbumIds: string[];
  isPlaylistPinned: (id: string) => boolean;
  isAlbumPinned: (id: string) => boolean;
  togglePinPlaylist: (id: string) => void;
  togglePinAlbum: (id: string) => void;
  canPinMorePlaylists: boolean;
  canPinMoreAlbums: boolean;
}

export function usePinnedItems(): UsePinnedItemsReturn {
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
      if (prev.includes(id)) {
        return prev.filter(pid => pid !== id);
      }
      if (prev.length >= MAX_PINS_PER_TAB) return prev;
      return [...prev, id];
    });
  }, [setPinnedPlaylistIds]);

  const togglePinAlbum = useCallback((id: string) => {
    setPinnedAlbumIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pid => pid !== id);
      }
      if (prev.length >= MAX_PINS_PER_TAB) return prev;
      return [...prev, id];
    });
  }, [setPinnedAlbumIds]);

  const canPinMorePlaylists = pinnedPlaylistIds.length < MAX_PINS_PER_TAB;
  const canPinMoreAlbums = pinnedAlbumIds.length < MAX_PINS_PER_TAB;

  return {
    pinnedPlaylistIds,
    pinnedAlbumIds,
    isPlaylistPinned,
    isAlbumPinned,
    togglePinPlaylist,
    togglePinAlbum,
    canPinMorePlaylists,
    canPinMoreAlbums,
  };
}
