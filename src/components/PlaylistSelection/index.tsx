import { useState, useEffect, useMemo } from 'react';
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
} from '../../utils/playlistFilters';
import { usePinnedItems } from '../../hooks/usePinnedItems';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME, toAlbumPlaylistId } from '../../constants/playlist';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { logQueue } from '@/lib/debugLog';
import type { AddToQueueResult, ProviderId } from '@/types/domain';
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
import LibraryDrawerHeader from './LibraryDrawerHeader';

interface PlaylistSelectionProps {
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
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
}

const PlaylistSelection = React.memo(function PlaylistSelection({
  onPlaylistSelect,
  onAddToQueue,
  inDrawer = false,
  swipeZoneRef,
  initialSearchQuery,
  initialViewMode,
  onLibraryRefresh,
  isLibraryRefreshing
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

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
    const filtered = filterPlaylistsOnly(items, searchQuery);
    return buildLibraryViewWithPins(
      filtered,
      pinnedPlaylistIds,
      (p) => p.id,
      (subgroup) => sortPlaylistSubgroup(subgroup, playlistSort)
    );
  }, [playlists, searchQuery, playlistSort, providerFilters, pinnedPlaylistIds]);

  const pinnedPlaylists = playlistLibraryView.pinned;
  const unpinnedPlaylists = playlistLibraryView.unpinned;

  const albumLibraryView = useMemo(() => {
    let items = albums;
    if (providerFilters.length > 0) {
      items = items.filter((a) => a.provider && providerFilters.includes(a.provider));
    }
    const filtered = filterAlbumsOnly(items, searchQuery, 'all', artistFilter);
    return buildLibraryViewWithPins(
      filtered,
      pinnedAlbumIds,
      (a) => a.id,
      (subgroup) => sortAlbumSubgroup(subgroup, albumSort)
    );
  }, [albums, searchQuery, albumSort, artistFilter, providerFilters, pinnedAlbumIds]);

  const pinnedAlbums = albumLibraryView.pinned;
  const unpinnedAlbums = albumLibraryView.unpinned;

  useEffect(() => {
    if (!isInitialLoadComplete) return;
    if (playlists.length === 0 && albums.length === 0 && likedSongsCount === 0) {
      const providerName = activeDescriptor?.name ?? 'your music service';
      setError(
        `No playlists, albums, or liked songs found. Please add some music to ${providerName} first.`
      );
    } else {
      setError(null);
    }
  }, [isInitialLoadComplete, playlists.length, albums.length, likedSongsCount, activeDescriptor]);

  useEffect(() => {
    const hasAuth = enabledProviderIds.some(id => {
      const desc = getDescriptor(id);
      return desc?.auth.isAuthenticated();
    }) || activeDescriptor?.auth.isAuthenticated();
    if (hasAuth) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  }, [activeDescriptor, enabledProviderIds, getDescriptor]);

  useEffect(() => {
    if (isInitialLoadComplete || playlists.length > 0 || albums.length > 0 || likedSongsCount > 0) {
      setIsLoading(false);
    }
  }, [isInitialLoadComplete, playlists.length, albums.length, likedSongsCount]);

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

  const mainContentProps = {
    inDrawer,
    swipeZoneRef,
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
    hasActiveFilters,
    albums,
    isInitialLoadComplete,
    showProviderBadges,
    enabledProviderIds,
    likedSongsPerProvider,
    likedSongsCount,
    isLikedSongsSyncing,
    isUnifiedLikedActive,
    unifiedLikedCount,
    pinnedPlaylists,
    unpinnedPlaylists,
    pinnedAlbums,
    unpinnedAlbums,
    isPlaylistPinned,
    canPinMorePlaylists,
    isAlbumPinned,
    canPinMoreAlbums,
    activeDescriptor: activeDescriptor ?? null,
    onPlaylistClick: handlePlaylistClick,
    onPlaylistContextMenu: handlePlaylistContextMenu,
    onPinPlaylistClick: handlePinPlaylistClick,
    onLikedSongsClick: handleLikedSongsClick,
    onAlbumClick: handleAlbumClick,
    onAlbumContextMenu: handleAlbumContextMenu,
    onPinAlbumClick: handlePinAlbumClick,
    onArtistClick: handleArtistClick,
    onLibraryRefresh,
    isLibraryRefreshing,
  };

  const statusContentProps = {
    isLoading,
    isAuthenticated,
    error,
    activeDescriptor: activeDescriptor ?? null,
    setError,
  };

  if (inDrawer) {
    return (
      <DrawerContentWrapper>
        <LibraryDrawerHeader activeDescriptor={activeDescriptor ?? null} />
        <LibraryStatusContent {...statusContentProps} />
        {showMainContent && <LibraryMainContent {...mainContentProps} />}
        {albumPopoverPortal}
        {playlistPopoverPortal}
        {confirmDeletePortal}
      </DrawerContentWrapper>
    );
  }

  return (
    <Container $inDrawer={false}>
      <SelectionCard $maxWidth={maxWidth} $inDrawer={false}>
        <CardContent style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <LibraryStatusContent {...statusContentProps} />
          {showMainContent && <LibraryMainContent {...mainContentProps} />}
          {albumPopoverPortal}
          {playlistPopoverPortal}
          {confirmDeletePortal}
        </CardContent>
      </SelectionCard>
    </Container>
  );
});

export default PlaylistSelection;
