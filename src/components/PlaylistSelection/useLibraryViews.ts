import { useMemo } from 'react';
import {
  filterPlaylistsOnly,
  sortPlaylistSubgroup,
  filterAlbumsOnly,
  sortAlbumSubgroup,
  buildLibraryViewWithPins,
  getAvailableGenres,
  type PlaylistSortOption,
  type AlbumSortOption,
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
  pinnedPlaylistIds,
  pinnedAlbumIds,
  ignoreProviderFilters,
}: UseLibraryViewsParams): LibraryViewsResult {
  const playlistLibraryView = useMemo(() => {
    let items = playlists;
    if (!ignoreProviderFilters && providerFilters.length > 0) {
      items = items.filter((p) => p.provider && providerFilters.includes(p.provider));
    }
    const filtered = filterPlaylistsOnly(items, searchQuery, selectedGenres);
    return buildLibraryViewWithPins(
      filtered,
      pinnedPlaylistIds,
      (p) => p.id,
      (subgroup) => sortPlaylistSubgroup(subgroup, playlistSort)
    );
  }, [playlists, searchQuery, playlistSort, providerFilters, ignoreProviderFilters, pinnedPlaylistIds, selectedGenres]);

  const albumLibraryView = useMemo(() => {
    let items = albums;
    if (!ignoreProviderFilters && providerFilters.length > 0) {
      items = items.filter((a) => a.provider && providerFilters.includes(a.provider));
    }
    const filtered = filterAlbumsOnly(items, searchQuery, 'all', artistFilter, selectedGenres);
    return buildLibraryViewWithPins(
      filtered,
      pinnedAlbumIds,
      (a) => a.id,
      (subgroup) => sortAlbumSubgroup(subgroup, albumSort)
    );
  }, [albums, searchQuery, albumSort, artistFilter, providerFilters, ignoreProviderFilters, pinnedAlbumIds, selectedGenres]);

  const availableGenres = useMemo(() => getAvailableGenres(albums), [albums]);

  return {
    pinnedPlaylists: playlistLibraryView.pinned,
    unpinnedPlaylists: playlistLibraryView.unpinned,
    pinnedAlbums: albumLibraryView.pinned,
    unpinnedAlbums: albumLibraryView.unpinned,
    availableGenres,
  };
}
