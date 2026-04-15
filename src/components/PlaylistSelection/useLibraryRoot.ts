import { useState, useMemo } from 'react';
import * as React from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useLibrarySync } from '../../hooks/useLibrarySync';
import {
  filterPlaylistsOnly,
  sortPlaylistSubgroup,
  filterAlbumsOnly,
  sortAlbumSubgroup,
  buildLibraryViewWithPins,
  getAvailableGenres,
  matchesRecentlyAddedFilter,
} from '../../utils/playlistFilters';
import { usePinnedItems } from '../../hooks/usePinnedItems';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME, toAlbumPlaylistId } from '../../constants/playlist';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { logQueue } from '@/lib/debugLog';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { PlaylistInfo, AlbumInfo } from '../../services/spotify';
import { useLibraryBrowsing } from './useLibraryBrowsing';
import { useItemActions } from './useItemActions';
import type {
  LibraryBrowsingContextValue,
  LibraryPinContextValue,
  LibraryActionsContextValue,
  LibraryDataContextValue,
} from './LibraryContext';

interface UseLibraryRootParams {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  inDrawer: boolean;
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
  initialSearchQuery?: string;
  initialViewMode?: 'playlists' | 'albums';
  onLibraryRefresh?: () => void;
  isLibraryRefreshing?: boolean;
}

export function useLibraryRoot({
  onPlaylistSelect,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
  inDrawer,
  swipeZoneRef,
  initialSearchQuery,
  initialViewMode,
  onLibraryRefresh,
  isLibraryRefreshing,
}: UseLibraryRootParams) {
  const { activeDescriptor, hasMultipleProviders, enabledProviderIds, getDescriptor } = useProviderContext();
  const { isUnifiedLikedActive, totalCount: unifiedLikedCount } = useUnifiedLikedTracks();
  const showProviderBadges = hasMultipleProviders && enabledProviderIds.length > 1;

  const {
    playlists,
    albums,
    likedSongsCount,
    likedSongsPerProvider,
    isInitialLoadComplete,
    isLikedSongsSyncing,
    removeCollection,
  } = useLibrarySync();

  const [loginError, setLoginError] = useState<string | null>(null);

  const browsingState = useLibraryBrowsing(initialSearchQuery, initialViewMode);

  const {
    searchQuery,
    playlistSort,
    albumSort,
    artistFilter,
    providerFilters,
    selectedGenres,
    recentlyAddedFilter,
  } = browsingState;

  const {
    handlePlaylistContextMenu,
    handleAlbumContextMenu,
    albumPopoverPortal,
    playlistPopoverPortal,
    confirmDeletePortal,
  } = useItemActions({
    onPlaylistSelect,
    onAddToQueue,
    onPlayLikedTracks,
    onQueueLikedTracks,
    activeDescriptor: activeDescriptor ?? null,
    getDescriptor,
    removeCollection,
  });

  const { viewport, isMobile, isTablet } = usePlayerSizingContext();
  const {
    pinnedPlaylistIds,
    pinnedAlbumIds,
    isPlaylistPinned,
    isAlbumPinned,
    togglePinPlaylist,
    togglePinAlbum,
    canPinMorePlaylists,
    canPinMoreAlbums,
  } = usePinnedItems();

  const maxWidth = useMemo(() => {
    if (isMobile) {
      return Math.min(viewport.width * 0.95, 400);
    }
    if (isTablet) {
      return Math.min(viewport.width * 0.8, 500);
    }
    return Math.min(viewport.width * 0.6, 600);
  }, [viewport.width, isMobile, isTablet]);

  const ignoreProviderFilters = isMobile;

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

  const pinnedPlaylists = playlistLibraryView.pinned;
  const unpinnedPlaylists = playlistLibraryView.unpinned;

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

  const pinnedAlbums = albumLibraryView.pinned;
  const unpinnedAlbums = albumLibraryView.unpinned;

  const availableGenres = useMemo(() => getAvailableGenres(albums), [albums]);

  const isAuthenticated = useMemo(
    () =>
      enabledProviderIds.some(id => getDescriptor(id)?.auth.isAuthenticated()) ||
      (activeDescriptor?.auth.isAuthenticated() ?? false),
    [activeDescriptor, enabledProviderIds, getDescriptor]
  );

  const isLoading = false;

  const libraryError = useMemo(() => {
    if (!isInitialLoadComplete) return null;
    if (playlists.length === 0 && albums.length === 0 && likedSongsCount === 0) {
      const providerName = activeDescriptor?.name ?? 'your music service';
      return `No playlists, albums, or liked songs found. Please add some music to ${providerName} first.`;
    }
    return null;
  }, [isInitialLoadComplete, playlists.length, albums.length, likedSongsCount, activeDescriptor]);

  const error = loginError ?? libraryError;

  function handlePlaylistClick(playlist: PlaylistInfo): void {
    logQueue('selected playlist: %s (%s)', playlist.name, playlist.id);
    onPlaylistSelect(playlist.id, playlist.name, playlist.provider);
  }

  function handleAlbumClick(album: AlbumInfo): void {
    logQueue('selected album: %s (%s)', album.name, album.id);
    onPlaylistSelect(toAlbumPlaylistId(album.id), album.name, album.provider);
  }

  function handleLikedSongsClick(provider?: ProviderId): void {
    if (provider !== undefined) {
      logQueue('liked songs click: explicit provider %s', provider);
      onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, provider);
      return;
    }

    if (isUnifiedLikedActive) {
      logQueue('liked songs click: unified path');
      onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, undefined);
      return;
    }

    if (likedSongsPerProvider.length === 1) {
      logQueue('liked songs click: single provider %s', likedSongsPerProvider[0].provider);
      onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, likedSongsPerProvider[0].provider);
      return;
    }

    logQueue(
      'liked songs click: ambiguous — %d providers, unified inactive; falling back to active provider',
      likedSongsPerProvider.length,
    );
    onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, activeDescriptor?.id);
  }

  function handlePinPlaylistClick(id: string, event: React.MouseEvent): void {
    event.stopPropagation();
    togglePinPlaylist(id);
  }

  function handlePinAlbumClick(id: string, event: React.MouseEvent): void {
    event.stopPropagation();
    togglePinAlbum(id);
  }

  function handleArtistClick(artistName: string, event: React.MouseEvent): void {
    event.stopPropagation();
    browsingState.setArtistFilter(artistName);
  }

  const hasAnyContent = playlists.length > 0 || albums.length > 0 || likedSongsCount > 0;
  const showMainContent = isAuthenticated && !error && (hasAnyContent || (!isLoading && !isInitialLoadComplete));

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
      recentlyAddedFilter: browsingState.recentlyAddedFilter,
      setRecentlyAddedFilter: browsingState.setRecentlyAddedFilter,
      hasActiveFilters: browsingState.hasActiveFilters,
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
      browsingState.recentlyAddedFilter,
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
      onPinPlaylistClick: handlePinPlaylistClick,
      onPinAlbumClick: handlePinAlbumClick,
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
      handlePinPlaylistClick,
      handlePinAlbumClick,
    ]
  );

  const actionsValue: LibraryActionsContextValue = useMemo(
    () => ({
      onPlaylistClick: handlePlaylistClick,
      onPlaylistContextMenu: handlePlaylistContextMenu,
      onLikedSongsClick: handleLikedSongsClick,
      onAlbumClick: handleAlbumClick,
      onAlbumContextMenu: handleAlbumContextMenu,
      onArtistClick: handleArtistClick,
      onLibraryRefresh,
      isLibraryRefreshing,
    }),
    [
      handlePlaylistClick,
      handlePlaylistContextMenu,
      handleLikedSongsClick,
      handleAlbumClick,
      handleAlbumContextMenu,
      handleArtistClick,
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
      activeDescriptor: activeDescriptor ?? null,
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
      activeDescriptor,
    ]
  );

  const statusContentProps = {
    isLoading,
    isAuthenticated,
    error,
    activeDescriptor: activeDescriptor ?? null,
    setError: setLoginError,
  };

  return {
    browsingValue,
    pinValue,
    actionsValue,
    dataValue,
    statusContentProps,
    showMainContent,
    maxWidth,
    albumPopoverPortal,
    playlistPopoverPortal,
    confirmDeletePortal,
  };
}
