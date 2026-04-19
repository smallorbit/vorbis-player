import { useCallback, useMemo } from 'react';
import * as React from 'react';
import { useProviderContext } from '@/contexts/ProviderContext';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useLibrarySync } from '../../hooks/useLibrarySync';
import { usePinnedItems } from '../../hooks/usePinnedItems';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { useRecentlyPlayedCollections, type RecentlyPlayedEntry } from '@/hooks/useRecentlyPlayedCollections';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME, toAlbumPlaylistId } from '../../constants/playlist';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import { useLibraryBrowsing } from './useLibraryBrowsing';
import { useItemActions } from './useItemActions';
import { useLibraryViews } from './useLibraryViews';
import { useLibraryStatus } from './useLibraryStatus';
import { useLibraryContextValues } from './useLibraryContextValues';
import { useLibraryHandlers } from './useLibraryHandlers';

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
    allMusicCount,
    isInitialLoadComplete,
    isLikedSongsSyncing,
    removeCollection,
  } = useLibrarySync();

  const browsingState = useLibraryBrowsing(initialSearchQuery, initialViewMode);
  const { history: recentlyPlayedRaw } = useRecentlyPlayedCollections();

  const recentlyPlayed = useMemo<RecentlyPlayedEntry[]>(() => {
    return recentlyPlayedRaw.map((entry) => {
      if (entry.imageUrl) return entry;
      const { ref } = entry;
      if (ref.kind === 'playlist') {
        const match = playlists.find(
          (p) => p.id === ref.id && (p.provider ?? 'spotify') === ref.provider,
        );
        const imageUrl = match?.images?.[0]?.url;
        return imageUrl ? { ...entry, imageUrl } : entry;
      }
      if (ref.kind === 'album') {
        const match = albums.find(
          (a) => a.id === ref.id && (a.provider ?? 'spotify') === ref.provider,
        );
        const imageUrl = match?.images?.[0]?.url;
        return imageUrl ? { ...entry, imageUrl } : entry;
      }
      return entry;
    });
  }, [recentlyPlayedRaw, playlists, albums]);

  const handleRecentlyPlayedSelect = useCallback(
    (entry: RecentlyPlayedEntry) => {
      const { ref, name } = entry;
      if (ref.kind === 'liked') {
        onPlaylistSelect(LIKED_SONGS_ID, LIKED_SONGS_NAME, ref.provider);
        return;
      }
      if (ref.kind === 'album') {
        onPlaylistSelect(toAlbumPlaylistId(ref.id), name, ref.provider);
        return;
      }
      onPlaylistSelect(ref.id, name, ref.provider);
    },
    [onPlaylistSelect],
  );

  const {
    handlePlaylistContextMenu,
    handleAlbumContextMenu,
    albumPopoverPortal,
    playlistPopoverPortal,
    confirmDeletePortal,
    saveErrorToast,
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
    if (isMobile) return Math.min(viewport.width * 0.95, 400);
    if (isTablet) return Math.min(viewport.width * 0.8, 500);
    return Math.min(viewport.width * 0.6, 600);
  }, [viewport.width, isMobile, isTablet]);

  const { pinnedPlaylists, unpinnedPlaylists, pinnedAlbums, unpinnedAlbums, availableGenres } = useLibraryViews({
    playlists,
    albums,
    searchQuery: browsingState.searchQuery,
    playlistSort: browsingState.playlistSort,
    albumSort: browsingState.albumSort,
    artistFilter: browsingState.artistFilter,
    providerFilters: browsingState.providerFilters,
    selectedGenres: browsingState.selectedGenres,
    pinnedPlaylistIds,
    pinnedAlbumIds,
    ignoreProviderFilters: isMobile,
  });

  const { showMainContent, statusContentProps } = useLibraryStatus({
    activeDescriptor,
    enabledProviderIds,
    getDescriptor,
    playlistsCount: playlists.length,
    albumsCount: albums.length,
    likedSongsCount,
    isInitialLoadComplete,
  });

  const {
    handlePlaylistClick,
    handleAlbumClick,
    handleLikedSongsClick,
    handlePinPlaylistClick,
    handlePinAlbumClick,
    handleArtistClick,
  } = useLibraryHandlers({
    onPlaylistSelect,
    isUnifiedLikedActive,
    likedSongsPerProvider,
    activeDescriptor,
    togglePinPlaylist,
    togglePinAlbum,
    setSearchQuery: browsingState.setSearchQuery,
  });

  const { browsingValue, pinValue, actionsValue, dataValue } = useLibraryContextValues({
    browsingState,
    availableGenres,
    recentlyPlayed,
    onRecentlyPlayedSelect: handleRecentlyPlayedSelect,
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
    onPlaylistClick: handlePlaylistClick,
    onPlaylistContextMenu: handlePlaylistContextMenu,
    onLikedSongsClick: handleLikedSongsClick,
    onAlbumClick: handleAlbumClick,
    onAlbumContextMenu: handleAlbumContextMenu,
    onArtistClick: handleArtistClick,
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
    activeDescriptor: activeDescriptor ?? null,
  });

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
    saveErrorToast,
  };
}
