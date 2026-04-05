import * as React from 'react';
import type { PlaylistInfo } from '../../services/spotify';
import { LIKED_SONGS_ID } from '@/constants/playlist';
import ProviderIcon from '../ProviderIcon';
import {
  MobileGrid,
  PlaylistGridDiv,
  GridCardArtWrapper,
  GridCardTextArea,
  GridCardTitle,
  GridCardSubtitle,
  PlaylistInfoDiv,
  PlaylistName,
  PlaylistDetails,
  PinButton,
  PinnableListItem,
  GridCardPinOverlay,
  ProviderBadgeOverlay,
  PinnableGridCard,
  PinnedSectionLabel,
  EmptyState,
} from './styled';
import { PinIcon, PlaylistImage, GridCardImageComponent } from './utils';
import { useLibraryContext } from './LibraryContext';
import { LikedSongsCard } from './LikedSongsCard';

export const PlaylistGrid: React.FC = React.memo(function PlaylistGrid() {
  const {
    inDrawer,
    likedSongsPerProvider,
    likedSongsCount,
    isUnifiedLikedActive,
    unifiedLikedCount,
    isInitialLoadComplete,
    showProviderBadges,
    hasActiveFilters,
    searchQuery,
    pinnedPlaylists,
    unpinnedPlaylists,
    isPlaylistPinned,
    canPinMorePlaylists,
    onPlaylistClick,
    onPlaylistContextMenu,
    onPinPlaylistClick,
  } = useLibraryContext();

  const likedSongsPinned = isPlaylistPinned(LIKED_SONGS_ID);
  const usePerProviderLiked = showProviderBadges && likedSongsPerProvider.length >= 1 && !isUnifiedLikedActive;
  const effectiveLikedCount = isUnifiedLikedActive ? unifiedLikedCount : likedSongsCount;
  const isLikedLoading = !isInitialLoadComplete && effectiveLikedCount === 0;
  const showLikedSongs = effectiveLikedCount > 0 || isLikedLoading;

  const layout = inDrawer ? 'grid' : 'list';

  const likedSongsItem = showLikedSongs && (usePerProviderLiked
    ? likedSongsPerProvider.map(({ provider, count }) => (
        <LikedSongsCard key={`liked-songs-${provider}`} layout={layout} provider={provider} count={count} />
      ))
    : <LikedSongsCard layout={layout} count={effectiveLikedCount} />
  );

  const renderPlaylistGrid = (playlist: PlaylistInfo) => {
    const pinned = isPlaylistPinned(playlist.id);
    return (
      <PinnableGridCard
        key={`${playlist.provider ?? 'default'}-${playlist.id}`}
        onClick={(e) => onPlaylistContextMenu(playlist, e)}
        onContextMenu={(e) => onPlaylistContextMenu(playlist, e)}
      >
        <GridCardArtWrapper style={{ position: 'relative' }}>
          <GridCardImageComponent images={playlist.images} alt={playlist.name} />
          {showProviderBadges && playlist.provider && (
            <ProviderBadgeOverlay>
              <ProviderIcon provider={playlist.provider} size={22} />
            </ProviderBadgeOverlay>
          )}
          <GridCardPinOverlay $isPinned={pinned} onClick={(e) => onPinPlaylistClick(playlist.id, e)}>
            <PinIcon filled={pinned} />
          </GridCardPinOverlay>
        </GridCardArtWrapper>
        <GridCardTextArea>
          <GridCardTitle>{playlist.name}</GridCardTitle>
          <GridCardSubtitle>
            {playlist.tracks?.total ?? 0} tracks
            {playlist.owner?.display_name && ` • ${playlist.owner.display_name}`}
          </GridCardSubtitle>
        </GridCardTextArea>
      </PinnableGridCard>
    );
  };

  const renderPlaylistList = (playlist: PlaylistInfo) => {
    const pinned = isPlaylistPinned(playlist.id);
    return (
      <PinnableListItem key={`${playlist.provider ?? 'default'}-${playlist.id}`} onClick={() => onPlaylistClick(playlist)} onContextMenu={(e) => onPlaylistContextMenu(playlist, e)}>
        <div style={{ position: 'relative' }}>
          <PlaylistImage images={playlist.images} alt={playlist.name} />
          {showProviderBadges && playlist.provider && (
            <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 2 }}>
              <ProviderIcon provider={playlist.provider} size={18} />
            </div>
          )}
        </div>
        <PlaylistInfoDiv>
          <PlaylistName>{playlist.name}</PlaylistName>
          <PlaylistDetails>
            {playlist.tracks?.total ?? 0} tracks
            {playlist.owner?.display_name && ` • by ${playlist.owner.display_name}`}
          </PlaylistDetails>
        </PlaylistInfoDiv>
        <PinButton
          $isPinned={pinned}
          $disabled={!canPinMorePlaylists && !pinned}
          onClick={(e) => onPinPlaylistClick(playlist.id, e)}
          title={pinned ? 'Unpin' : (canPinMorePlaylists ? 'Pin to top' : 'Pin limit reached (8)')}
          aria-label={pinned ? `Unpin ${playlist.name}` : `Pin ${playlist.name} to top`}
        >
          <PinIcon filled={pinned} />
        </PinButton>
      </PinnableListItem>
    );
  };

  const renderFn = inDrawer ? renderPlaylistGrid : renderPlaylistList;
  const hasPinnedSection = pinnedPlaylists.length > 0 || (likedSongsPinned && showLikedSongs && !hasActiveFilters);

  const filteredPlaylistsCount = pinnedPlaylists.length + unpinnedPlaylists.length;
  const emptyState = filteredPlaylistsCount === 0 && likedSongsCount === 0 && isInitialLoadComplete && (
    <EmptyState $fullWidth={inDrawer}>
      {searchQuery
        ? `No playlists match "${searchQuery}"`
        : 'No playlists found. Create some playlists in Spotify or save some songs!'}
    </EmptyState>
  );

  const Grid = inDrawer ? MobileGrid : PlaylistGridDiv;
  return (
    <Grid $inDrawer={inDrawer ? undefined : false}>
      {!hasActiveFilters && likedSongsPinned && likedSongsItem}
      {pinnedPlaylists.map(renderFn)}
      {hasPinnedSection && <PinnedSectionLabel key="__pin-sep">Pinned</PinnedSectionLabel>}
      {(hasActiveFilters || !likedSongsPinned) && likedSongsItem}
      {unpinnedPlaylists.map(renderFn)}
      {emptyState}
    </Grid>
  );
});
