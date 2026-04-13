import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { PlaylistSortOption, AlbumSortOption, RecentlyAddedFilterOption } from '@/utils/playlistFilters';
import type { ProviderId } from '@/types/domain';

type ViewMode = 'playlists' | 'albums';

export function useLibraryBrowsing(initialSearchQuery?: string, initialViewMode?: ViewMode) {
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    'vorbis-player-view-mode',
    initialViewMode ?? 'playlists',
  );

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');

  const [playlistSort, setPlaylistSort] = useLocalStorage<PlaylistSortOption>(
    'vorbis-player-playlist-sort',
    'recently-added'
  );

  const [albumSort, setAlbumSort] = useLocalStorage<AlbumSortOption>(
    'vorbis-player-album-sort',
    'recently-added'
  );

  const [artistFilter, setArtistFilter] = useState<string>('');
  const [providerFilters, setProviderFilters] = useState<ProviderId[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [recentlyAddedFilter, setRecentlyAddedFilter] = useState<RecentlyAddedFilterOption>('all');

  // Sync when initial props change (e.g., drawer re-opened with new filter)
  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Clear artist filter when switching away from albums view
  useEffect(() => {
    if (viewMode === 'playlists') {
      if (artistFilter !== '') {
        setArtistFilter('');
      }
    }
  }, [viewMode, artistFilter]);

  const handleProviderToggle = useCallback((provider: ProviderId) => {
    setProviderFilters((prev) => {
      if (prev.length === 0) {
        // First toggle: activate only this provider (deactivate others)
        return [provider];
      }
      if (prev.includes(provider)) {
        const next = prev.filter((p) => p !== provider);
        // If removing last filter, return to "all" (empty = no filter)
        return next;
      }
      return [...prev, provider];
    });
  }, []);

  const hasActiveFilters =
    searchQuery !== '' ||
    artistFilter !== '' ||
    providerFilters.length > 0 ||
    selectedGenres.length > 0 ||
    (recentlyAddedFilter !== 'all' && recentlyAddedFilter !== undefined);

  return {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    playlistSort,
    setPlaylistSort,
    albumSort,
    setAlbumSort,
    artistFilter,
    setArtistFilter,
    providerFilters,
    setProviderFilters,
    handleProviderToggle,
    selectedGenres,
    setSelectedGenres,
    recentlyAddedFilter,
    setRecentlyAddedFilter,
    hasActiveFilters,
  };
}
