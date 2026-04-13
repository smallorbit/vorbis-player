import { useState, useMemo } from 'react';
import * as React from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import { CardContent } from '../styled';
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
import {
  Container,
  SelectionCard,
  DrawerContentWrapper,
} from './styled';
import { useLibraryBrowsing } from './useLibraryBrowsing';
import { useItemActions } from './useItemActions';
import { LibraryStatusContent } from './LibraryStatusContent';
import { LibraryMainContent } from './LibraryMainContent';
import {
  LibraryBrowsingProvider,
  LibraryPinProvider,
  LibraryActionsProvider,
  LibraryDataProvider,
} from './LibraryContext';
import type {
  LibraryBrowsingContextValue,
  LibraryPinContextValue,
  LibraryActionsContextValue,
  LibraryDataContextValue,
} from './LibraryContext';

interface PlaylistSelectionProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  /** When true, uses compact layout for drawer context (no centering, fills available space) */
  inDrawer?: boolean;
  /** Ref for swipe-to-close gesture zone (search/filters area only, not the scrollable list) */
  swipeZoneRef?: React.RefObject<HTMLDivElement>;
  /** Pre-populate the search input when the drawer opens */
  initialSearchQuery?: string;
  /** Set the active tab when the drawer opens */
  initialViewMode?: 'playlists' | 'albums';
  /** Drawer-only: show refresh button near the sort dropdown */
  onLibraryRefresh?: () => void;
  /** Drawer-only: controls the refresh spinner */
  isLibraryRefreshing?: boolean;
  /** Optional element rendered below the grid inside the card */
  footer?: React.ReactNode;
}

const PlaylistSelection = React.memo(function PlaylistSelection({
  onPlaylistSelect,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
  inDrawer = false,
  swipeZoneRef,
  initialSearchQuery,
  initialViewMode,
  onLibraryRefresh,
  isLibraryRefreshing,
  footer,
}: PlaylistSelectionProps): JSX.Element {
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

  const {
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
  } = useLibraryBrowsing(initialSearchQuery, initialViewMode);

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

  const playlistLibraryView = useMemo(() => {
    let items = playlists;
    if (providerFilters.length > 0) {
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
  }, [playlists, searchQuery, playlistSort, providerFilters, pinnedPlaylistIds, selectedGenres, recentlyAddedFilter]);

  const pinnedPlaylists = playlistLibraryView.pinned;
  const unpinnedPlaylists = playlistLibraryView.unpinned;

  const albumLibraryView = useMemo(() => {
    let items = albums;
    if (providerFilters.length > 0) {
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
  }, [albums, searchQuery, albumSort, artistFilter, providerFilters, pinnedAlbumIds, selectedGenres, recentlyAddedFilter]);

  const pinnedAlbums = albumLibraryView.pinned;
  const unpinnedAlbums = albumLibraryView.unpinned;

  // Derive available genres from the full album list (albums carry genre metadata; playlists don't)
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
    const resolvedProvider = provider ?? (likedSongsPerProvider.length === 1 ? likedSongsPerProvider[0].provider : undefined);
    onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, resolvedProvider);
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
    setArtistFilter(artistName);
  }

  const hasAnyContent = playlists.length > 0 || albums.length > 0 || likedSongsCount > 0;
  const showMainContent = isAuthenticated && !error && (hasAnyContent || (!isLoading && !isInitialLoadComplete));

  const browsingValue: LibraryBrowsingContextValue = useMemo(
    () => ({
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
      availableGenres,
      selectedGenres,
      setSelectedGenres,
      recentlyAddedFilter,
      setRecentlyAddedFilter,
      hasActiveFilters,
    }),
    [
      viewMode,
      searchQuery,
      playlistSort,
      albumSort,
      artistFilter,
      providerFilters,
      availableGenres,
      selectedGenres,
      recentlyAddedFilter,
      hasActiveFilters,
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

  if (inDrawer) {
    return (
      <LibraryDataProvider value={dataValue}>
      <LibraryBrowsingProvider value={browsingValue}>
      <LibraryPinProvider value={pinValue}>
      <LibraryActionsProvider value={actionsValue}>
        <DrawerContentWrapper>
          <LibraryStatusContent {...statusContentProps} />
          {showMainContent && <LibraryMainContent />}
          {albumPopoverPortal}
          {playlistPopoverPortal}
          {confirmDeletePortal}
        </DrawerContentWrapper>
      </LibraryActionsProvider>
      </LibraryPinProvider>
      </LibraryBrowsingProvider>
      </LibraryDataProvider>
    );
  }

  return (
    <LibraryDataProvider value={dataValue}>
    <LibraryBrowsingProvider value={browsingValue}>
    <LibraryPinProvider value={pinValue}>
    <LibraryActionsProvider value={actionsValue}>
      <Container $inDrawer={false}>
        <SelectionCard $maxWidth={maxWidth} $inDrawer={false}>
          <CardContent style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <LibraryStatusContent {...statusContentProps} />
            {showMainContent && <LibraryMainContent />}
            {albumPopoverPortal}
            {playlistPopoverPortal}
            {confirmDeletePortal}
          </CardContent>
          {footer}
        </SelectionCard>
      </Container>
    </LibraryActionsProvider>
    </LibraryPinProvider>
    </LibraryBrowsingProvider>
    </LibraryDataProvider>
  );
});

export default PlaylistSelection;
