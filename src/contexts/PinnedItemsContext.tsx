import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import { getPins, setPins, migratePinsFromLocalStorage, MAX_PINS } from '@/services/settings/pinnedItemsStorage';

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
  const { activeProviderId } = useProviderContext();
  const [pinnedPlaylistIds, setPinnedPlaylistIds] = useState<string[]>([]);
  const [pinnedAlbumIds, setPinnedAlbumIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await migratePinsFromLocalStorage();
      const [playlists, albums] = await Promise.all([
        getPins(activeProviderId, 'playlists'),
        getPins(activeProviderId, 'albums'),
      ]);
      if (cancelled) return;
      setPinnedPlaylistIds(playlists);
      setPinnedAlbumIds(albums);
    }
    load().catch(err => console.warn('[PinnedItemsContext] Failed to load pins:', err));
    return () => { cancelled = true; };
  }, [activeProviderId]);

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
      const next = prev.includes(id) ? prev.filter(pid => pid !== id) : prev.length >= MAX_PINS ? prev : [...prev, id];
      setPins(activeProviderId, 'playlists', next).catch(err => console.warn('[PinnedItemsContext] pin write failed:', err));
      return next;
    });
  }, [activeProviderId]);

  const togglePinAlbum = useCallback((id: string) => {
    setPinnedAlbumIds(prev => {
      const next = prev.includes(id) ? prev.filter(pid => pid !== id) : prev.length >= MAX_PINS ? prev : [...prev, id];
      setPins(activeProviderId, 'albums', next).catch(err => console.warn('[PinnedItemsContext] pin write failed:', err));
      return next;
    });
  }, [activeProviderId]);

  const canPinMorePlaylists = pinnedPlaylistIds.length < MAX_PINS;
  const canPinMoreAlbums = pinnedAlbumIds.length < MAX_PINS;

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
