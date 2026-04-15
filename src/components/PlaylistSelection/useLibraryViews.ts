import { useMemo } from 'react';
import {
  filterPlaylistsOnly,
  sortPlaylistSubgroup,
  filterAlbumsOnly,
  sortAlbumSubgroup,
  buildLibraryViewWithPins,
  getAvailableGenres,
  matchesRecentlyAddedFilter,
  type PlaylistSortOption,
  type AlbumSortOption,
  type RecentlyAddedFilterOption,
} from '../../utils/playlistFilters';
import type { PlaylistInfo, AlbumInfo } from '../../services/spotify';
import type { ProviderId } from '@/types/domain';

interface UseLibraryViewsParams {
  playlists: PlaylistInfo[];
  albums: AlbumInfo[];
  searchQuery: string;
  playlistSort: PlaylistSortOption;
  albumSort: AlbumSortOption;
  artistFilter: string;
  providerFilters: ProviderId[];
  selectedGenres: string[];
  recentlyAddedFilter: RecentlyAddedFilterOption;
  pinnedPlaylistIds: string[];
  pinnedAlbumIds: string[];
  ignoreProviderFilters: boolean;
}

export interface LibraryViewsResult {
  pinnedPlaylists: PlaylistInfo[];
  unpinnedPlaylists: PlaylistInfo[];
  pinnedAlbums: AlbumInfo[];
  unpinnedAlbums: AlbumInfo[];
  availableGenres: string[];
}

export function useLibraryViews({
  playlists,
  albums,
  searchQuery,
  playlistSort,
  albumSort,
  artistFilter,
  providerFilters,
  selectedGenres,
  recentlyAddedFilter,
  pinnedPlaylistIds,
  pinnedAlbumIds,
  ignoreProviderFilters,
}: UseLibraryViewsParams): LibraryViewsResult {
  const playlistLibraryView = useMemo(() => {
    let items = playlists;
    if (!ignoreProviderFilters && providerFilters.length > 0) {
      items = items.filter((p) => p.provider && providerFilters.includes(p.provider));
    }
    let filtered = filterPlaylistsOnly(items, searchQuery, selectedGenres);
    if (recentlyAddedFilter && recentlyAddedFilter !== 'all') {
      filtered = filtered.filter((p) => matchesRecentlyAddedFilter(p.added_at, recentlyAddedFilter));
    }
    return buildLibraryViewWithPins(
      filtered,
      pinnedPlaylistIds,
      (p) => p.id,
      (subgroup) => sortPlaylistSubgroup(subgroup, playlistSort)
    );
  }, [playlists, searchQuery, playlistSort, providerFilters, ignoreProviderFilters, pinnedPlaylistIds, selectedGenres, recentlyAddedFilter]);

  const albumLibraryView = useMemo(() => {
    let items = albums;
    if (!ignoreProviderFilters && providerFilters.length > 0) {
      items = items.filter((a) => a.provider && providerFilters.includes(a.provider));
    }
    let filtered = filterAlbumsOnly(items, searchQuery, 'all', artistFilter, selectedGenres);
    if (recentlyAddedFilter && recentlyAddedFilter !== 'all') {
      filtered = filtered.filter((a) => matchesRecentlyAddedFilter(a.added_at, recentlyAddedFilter));
    }
    return buildLibraryViewWithPins(
      filtered,
      pinnedAlbumIds,
      (a) => a.id,
      (subgroup) => sortAlbumSubgroup(subgroup, albumSort)
    );
  }, [albums, searchQuery, albumSort, artistFilter, providerFilters, ignoreProviderFilters, pinnedAlbumIds, selectedGenres, recentlyAddedFilter]);

  const availableGenres = useMemo(() => getAvailableGenres(albums), [albums]);

  return {
    pinnedPlaylists: playlistLibraryView.pinned,
    unpinnedPlaylists: playlistLibraryView.unpinned,
    pinnedAlbums: albumLibraryView.pinned,
    unpinnedAlbums: albumLibraryView.unpinned,
    availableGenres,
  };
}
