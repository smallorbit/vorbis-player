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

  const [searchQuery, setSearchQuery] = useLocalStorage<string>(
    'vorbis-player-library-search',
    initialSearchQuery ?? '',
  );

  const [playlistSort, setPlaylistSort] = useLocalStorage<PlaylistSortOption>(
    'vorbis-player-playlist-sort',
    'recently-added'
  );

  const [albumSort, setAlbumSort] = useLocalStorage<AlbumSortOption>(
    'vorbis-player-album-sort',
    'recently-added'
  );

  const [artistFilter, setArtistFilter] = useState<string>('');
  const [providerFilters, setProviderFilters] = useLocalStorage<ProviderId[]>(
    'vorbis-player-library-provider-filters',
    [],
  );
  const [selectedGenres, setSelectedGenres] = useLocalStorage<string[]>(
    'vorbis-player-library-genres',
    [],
  );
  const [recentlyAddedFilter, setRecentlyAddedFilter] = useLocalStorage<RecentlyAddedFilterOption>(
    'vorbis-player-library-recently-added',
    'all',
  );

  useEffect(() => {
    if (viewMode === 'playlists' && artistFilter !== '') {
      setArtistFilter('');
    }
  }, [viewMode, artistFilter]);

  const handleProviderToggle = useCallback((provider: ProviderId) => {
    setProviderFilters((prev) => {
      if (prev.length === 0) {
        return [provider];
      }
      if (prev.length === 1 && prev[0] === provider) {
        return [];
      }
      if (prev.includes(provider)) {
        return prev.filter((p) => p !== provider);
      }
      return [...prev, provider];
    });
  }, [setProviderFilters]);

  const handleGenreToggle = useCallback((genre: string) => {
    setSelectedGenres((prev) => {
      if (prev.length === 0) {
        return [genre];
      }
      if (prev.length === 1 && prev[0] === genre) {
        return [];
      }
      if (prev.includes(genre)) {
        return prev.filter((g) => g !== genre);
      }
      return [...prev, genre];
    });
  }, [setSelectedGenres]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setArtistFilter('');
    setProviderFilters([]);
    setSelectedGenres([]);
    setRecentlyAddedFilter('all');
  }, [setSearchQuery, setProviderFilters, setSelectedGenres, setRecentlyAddedFilter]);

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
    handleGenreToggle,
    recentlyAddedFilter,
    setRecentlyAddedFilter,
    hasActiveFilters,
    handleClearFilters,
  };
}
