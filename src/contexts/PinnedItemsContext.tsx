import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { getPins, setPins, migratePinsFromLocalStorage, MAX_PINS, UNIFIED_PROVIDER, PINS_CHANGED_EVENT } from '@/services/settings/pinnedItemsStorage';
import { getPreferencesSync } from '@/providers/dropbox/dropboxPreferencesSync';

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
  const [pinnedPlaylistIds, setPinnedPlaylistIds] = useState<string[]>([]);
  const [pinnedAlbumIds, setPinnedAlbumIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await migratePinsFromLocalStorage();
      const [playlists, albums] = await Promise.all([
        getPins(UNIFIED_PROVIDER, 'playlists'),
        getPins(UNIFIED_PROVIDER, 'albums'),
      ]);
      if (cancelled) return;
      setPinnedPlaylistIds(playlists);
      setPinnedAlbumIds(albums);
    }
    load().catch(err => console.warn('[PinnedItemsContext] Failed to load pins:', err));
    return () => { cancelled = true; };
  }, []);

  // Reload pins when updated externally (e.g. Dropbox sync)
  useEffect(() => {
    function onPinsChanged() {
      Promise.all([
        getPins(UNIFIED_PROVIDER, 'playlists'),
        getPins(UNIFIED_PROVIDER, 'albums'),
      ]).then(([playlists, albums]) => {
        setPinnedPlaylistIds(playlists);
        setPinnedAlbumIds(albums);
      }).catch(err => console.warn('[PinnedItemsContext] Failed to reload pins:', err));
    }
    window.addEventListener(PINS_CHANGED_EVENT, onPinsChanged);
    return () => window.removeEventListener(PINS_CHANGED_EVENT, onPinsChanged);
  }, []);

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
      setPins(UNIFIED_PROVIDER, 'playlists', next).catch(err => console.warn('[PinnedItemsContext] pin write failed:', err));
      getPreferencesSync()?.schedulePush();
      return next;
    });
  }, []);

  const togglePinAlbum = useCallback((id: string) => {
    setPinnedAlbumIds(prev => {
      const next = prev.includes(id) ? prev.filter(pid => pid !== id) : prev.length >= MAX_PINS ? prev : [...prev, id];
      setPins(UNIFIED_PROVIDER, 'albums', next).catch(err => console.warn('[PinnedItemsContext] pin write failed:', err));
      getPreferencesSync()?.schedulePush();
      return next;
    });
  }, []);

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
