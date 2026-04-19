import { useMemo } from 'react';
import * as React from 'react';
import type { PlaylistInfo, AlbumInfo } from '../../services/spotify';
import type { ProviderDescriptor } from '@/types/providers';
import type { ProviderId } from '@/types/domain';
import type { RecentlyPlayedEntry } from '@/hooks/useRecentlyPlayedCollections';
import type {
  LibraryBrowsingContextValue,
  LibraryPinContextValue,
  LibraryActionsContextValue,
  LibraryDataContextValue,
} from './LibraryContext';

type BrowsingState = Omit<LibraryBrowsingContextValue, 'availableGenres' | 'recentlyPlayed' | 'onRecentlyPlayedSelect'>;

interface LikedSongsEntry {
  provider: ProviderId;
  count: number;
}

interface UseLibraryContextValuesParams {
  browsingState: BrowsingState;
  availableGenres: string[];
  recentlyPlayed: RecentlyPlayedEntry[];
  onRecentlyPlayedSelect: (entry: RecentlyPlayedEntry) => void;
  pinnedPlaylists: PlaylistInfo[];
  unpinnedPlaylists: PlaylistInfo[];
  pinnedAlbums: AlbumInfo[];
  unpinnedAlbums: AlbumInfo[];
  isPlaylistPinned: (id: string) => boolean;
  canPinMorePlaylists: boolean;
  isAlbumPinned: (id: string) => boolean;
  canPinMoreAlbums: boolean;
  onPinPlaylistClick: (id: string, event: React.MouseEvent) => void;
  onPinAlbumClick: (id: string, event: React.MouseEvent) => void;
  onPlaylistClick: (playlist: PlaylistInfo) => void;
  onPlaylistContextMenu: (playlist: PlaylistInfo, event: React.MouseEvent) => void;
  onLikedSongsClick: (provider?: ProviderId) => void;
  onAlbumClick: (album: AlbumInfo) => void;
  onAlbumContextMenu: (album: AlbumInfo, event: React.MouseEvent) => void;
  onArtistClick: (artistName: string, event: React.MouseEvent) => void;
  onLibraryRefresh?: () => void;
  isLibraryRefreshing?: boolean;
  inDrawer: boolean;
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
  albums: AlbumInfo[];
  isInitialLoadComplete: boolean;
  showProviderBadges: boolean;
  enabledProviderIds: ProviderId[];
  likedSongsPerProvider: LikedSongsEntry[];
  likedSongsCount: number;
  isLikedSongsSyncing: boolean;
  isUnifiedLikedActive: boolean;
  unifiedLikedCount: number;
  allMusicCount: number;
  activeDescriptor: ProviderDescriptor | null;
}

export interface LibraryContextValuesResult {
  browsingValue: LibraryBrowsingContextValue;
  pinValue: LibraryPinContextValue;
  actionsValue: LibraryActionsContextValue;
  dataValue: LibraryDataContextValue;
}

export function useLibraryContextValues({
  browsingState,
  availableGenres,
  recentlyPlayed,
  onRecentlyPlayedSelect,
  pinnedPlaylists,
  unpinnedPlaylists,
  pinnedAlbums,
  unpinnedAlbums,
  isPlaylistPinned,
  canPinMorePlaylists,
  isAlbumPinned,
  canPinMoreAlbums,
  onPinPlaylistClick,
  onPinAlbumClick,
  onPlaylistClick,
  onPlaylistContextMenu,
  onLikedSongsClick,
  onAlbumClick,
  onAlbumContextMenu,
  onArtistClick,
  onLibraryRefresh,
  isLibraryRefreshing,
  inDrawer,
  swipeZoneRef,
  albums,
  isInitialLoadComplete,
  showProviderBadges,
  enabledProviderIds,
  likedSongsPerProvider,
  likedSongsCount,
  isLikedSongsSyncing,
  isUnifiedLikedActive,
  unifiedLikedCount,
  allMusicCount,
  activeDescriptor,
}: UseLibraryContextValuesParams): LibraryContextValuesResult {
  const browsingValue: LibraryBrowsingContextValue = useMemo(
    () => ({
      viewMode: browsingState.viewMode,
      setViewMode: browsingState.setViewMode,
      searchQuery: browsingState.searchQuery,
      setSearchQuery: browsingState.setSearchQuery,
      playlistSort: browsingState.playlistSort,
      setPlaylistSort: browsingState.setPlaylistSort,
      albumSort: browsingState.albumSort,
      setAlbumSort: browsingState.setAlbumSort,
      artistFilter: browsingState.artistFilter,
      setArtistFilter: browsingState.setArtistFilter,
      providerFilters: browsingState.providerFilters,
      setProviderFilters: browsingState.setProviderFilters,
      handleProviderToggle: browsingState.handleProviderToggle,
      availableGenres,
      selectedGenres: browsingState.selectedGenres,
      setSelectedGenres: browsingState.setSelectedGenres,
      handleGenreToggle: browsingState.handleGenreToggle,
      recentlyPlayed,
      onRecentlyPlayedSelect,
      hasActiveFilters: browsingState.hasActiveFilters,
      handleClearFilters: browsingState.handleClearFilters,
    }),
    [
      browsingState.viewMode,
      browsingState.searchQuery,
      browsingState.playlistSort,
      browsingState.albumSort,
      browsingState.artistFilter,
      browsingState.providerFilters,
      availableGenres,
      browsingState.selectedGenres,
      recentlyPlayed,
      onRecentlyPlayedSelect,
      browsingState.hasActiveFilters,
    ]
  );

  const pinValue: LibraryPinContextValue = useMemo(
    () => ({
      pinnedPlaylists,
      unpinnedPlaylists,
      pinnedAlbums,
      unpinnedAlbums,
      isPlaylistPinned,
      canPinMorePlaylists,
      isAlbumPinned,
      canPinMoreAlbums,
      onPinPlaylistClick,
      onPinAlbumClick,
    }),
    [
      pinnedPlaylists,
      unpinnedPlaylists,
      pinnedAlbums,
      unpinnedAlbums,
      isPlaylistPinned,
      canPinMorePlaylists,
      isAlbumPinned,
      canPinMoreAlbums,
      onPinPlaylistClick,
      onPinAlbumClick,
    ]
  );

  const actionsValue: LibraryActionsContextValue = useMemo(
    () => ({
      onPlaylistClick,
      onPlaylistContextMenu,
      onLikedSongsClick,
      onAlbumClick,
      onAlbumContextMenu,
      onArtistClick,
      onLibraryRefresh,
      isLibraryRefreshing,
    }),
    [
      onPlaylistClick,
      onPlaylistContextMenu,
      onLikedSongsClick,
      onAlbumClick,
      onAlbumContextMenu,
      onArtistClick,
      onLibraryRefresh,
      isLibraryRefreshing,
    ]
  );

  const dataValue: LibraryDataContextValue = useMemo(
    () => ({
      inDrawer,
      swipeZoneRef,
      albums,
      isInitialLoadComplete,
      showProviderBadges,
      enabledProviderIds,
      likedSongsPerProvider,
      likedSongsCount,
      isLikedSongsSyncing,
      isUnifiedLikedActive,
      unifiedLikedCount,
      allMusicCount,
      activeDescriptor,
    }),
    [
      inDrawer,
      swipeZoneRef,
      albums,
      isInitialLoadComplete,
      showProviderBadges,
      enabledProviderIds,
      likedSongsPerProvider,
      likedSongsCount,
      isLikedSongsSyncing,
      isUnifiedLikedActive,
      unifiedLikedCount,
      allMusicCount,
      activeDescriptor,
    ]
  );

  return { browsingValue, pinValue, actionsValue, dataValue };
}
