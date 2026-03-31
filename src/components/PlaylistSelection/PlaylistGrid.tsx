import * as React from 'react';
import type { PlaylistInfo } from '../../services/spotify';
import type { ProviderId } from '@/types/domain';
import type { ProviderDescriptor } from '@/types/providers';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME } from '@/constants/playlist';
import ProviderIcon from '../ProviderIcon';
import {
  MobileGrid,
  PlaylistGridDiv,
  GridCardArtWrapper,
  GridCardTextArea,
  GridCardTitle,
  GridCardSubtitle,
  PlaylistImageWrapper,
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
import { getLikedSongsGradient, likedSongsAsPlaylistInfo, PinIcon, PlaylistImage, GridCardImageComponent } from './utils';

interface PlaylistGridProps {
  inDrawer: boolean;
  playlists: PlaylistInfo[];
  likedSongsPerProvider: { provider: ProviderId; count: number }[];
  likedSongsCount: number;
  isUnifiedLikedActive: boolean;
  unifiedLikedCount: number;
  isInitialLoadComplete: boolean;
  showProviderBadges: boolean;
  hasActiveFilters: boolean;
  searchQuery: string;
  pinnedPlaylists: PlaylistInfo[];
  unpinnedPlaylists: PlaylistInfo[];
  isPlaylistPinned: (id: string) => boolean;
  canPinMorePlaylists: boolean;
  activeDescriptor: ProviderDescriptor | null;
  onPlaylistClick: (playlist: PlaylistInfo) => void;
  onPlaylistContextMenu: (playlist: PlaylistInfo, e: React.MouseEvent) => void;
  onPinPlaylistClick: (id: string, e: React.MouseEvent) => void;
  onLikedSongsClick: (provider?: ProviderId) => void;
}

export const PlaylistGrid: React.FC<PlaylistGridProps> = React.memo(function PlaylistGrid({
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
  activeDescriptor,
  onPlaylistClick,
  onPlaylistContextMenu,
  onPinPlaylistClick,
  onLikedSongsClick,
}) {
  const likedSongsPinned = isPlaylistPinned(LIKED_SONGS_ID);
  const likedSongsPinBtn = (
    <PinButton
      $isPinned={likedSongsPinned}
      $disabled={!canPinMorePlaylists && !likedSongsPinned}
      onClick={(e) => onPinPlaylistClick(LIKED_SONGS_ID, e)}
      title={likedSongsPinned ? 'Unpin' : (canPinMorePlaylists ? 'Pin to top' : 'Pin limit reached (8)')}
      aria-label={likedSongsPinned ? 'Unpin Liked Songs' : 'Pin Liked Songs to top'}
    >
      <PinIcon filled={likedSongsPinned} />
    </PinButton>
  );

  const usePerProviderLiked = showProviderBadges && likedSongsPerProvider.length >= 1 && !isUnifiedLikedActive;
  const effectiveLikedCount = isUnifiedLikedActive ? unifiedLikedCount : likedSongsCount;

  const likedSongsGridCard = effectiveLikedCount > 0 && (isUnifiedLikedActive ? (
    <PinnableGridCard
      key="liked-songs-unified"
      onClick={(e) => onPlaylistContextMenu(likedSongsAsPlaylistInfo(), e)}
      onContextMenu={(e) => onPlaylistContextMenu(likedSongsAsPlaylistInfo(), e)}
    >
      <GridCardArtWrapper style={{ position: 'relative' }}>
        <div style={{ background: getLikedSongsGradient('unified'), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '3rem', color: 'white' }}>♥</div>
        <GridCardPinOverlay $isPinned={likedSongsPinned} onClick={(e) => onPinPlaylistClick(LIKED_SONGS_ID, e)}>
          <PinIcon filled={likedSongsPinned} />
        </GridCardPinOverlay>
      </GridCardArtWrapper>
      <GridCardTextArea>
        <GridCardTitle>{LIKED_SONGS_NAME}</GridCardTitle>
        <GridCardSubtitle>{effectiveLikedCount} tracks</GridCardSubtitle>
      </GridCardTextArea>
    </PinnableGridCard>
  ) : usePerProviderLiked ? (
    likedSongsPerProvider.map(({ provider, count }) => (
      <PinnableGridCard
        key={`liked-songs-${provider}`}
        onClick={(e) => onPlaylistContextMenu(likedSongsAsPlaylistInfo(provider), e)}
        onContextMenu={(e) => onPlaylistContextMenu(likedSongsAsPlaylistInfo(provider), e)}
      >
        <GridCardArtWrapper style={{ position: 'relative' }}>
          <div style={{ background: getLikedSongsGradient(provider), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '3rem', color: 'white' }}>♥</div>
          <ProviderBadgeOverlay>
            <ProviderIcon provider={provider} size={22} />
          </ProviderBadgeOverlay>
          <GridCardPinOverlay $isPinned={likedSongsPinned} onClick={(e) => onPinPlaylistClick(LIKED_SONGS_ID, e)}>
            <PinIcon filled={likedSongsPinned} />
          </GridCardPinOverlay>
        </GridCardArtWrapper>
        <GridCardTextArea>
          <GridCardTitle>{LIKED_SONGS_NAME}</GridCardTitle>
          <GridCardSubtitle>{count} tracks</GridCardSubtitle>
        </GridCardTextArea>
      </PinnableGridCard>
    ))
  ) : (
    <PinnableGridCard
      key="liked-songs"
      onClick={(e) => onPlaylistContextMenu(likedSongsAsPlaylistInfo(), e)}
      onContextMenu={(e) => onPlaylistContextMenu(likedSongsAsPlaylistInfo(), e)}
    >
      <GridCardArtWrapper style={{ position: 'relative' }}>
        <div style={{ background: getLikedSongsGradient(activeDescriptor?.id), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '3rem', color: 'white' }}>♥</div>
        <GridCardPinOverlay $isPinned={likedSongsPinned} onClick={(e) => onPinPlaylistClick(LIKED_SONGS_ID, e)}>
          <PinIcon filled={likedSongsPinned} />
        </GridCardPinOverlay>
      </GridCardArtWrapper>
      <GridCardTextArea>
        <GridCardTitle>{LIKED_SONGS_NAME}</GridCardTitle>
        <GridCardSubtitle>{likedSongsCount} tracks</GridCardSubtitle>
      </GridCardTextArea>
    </PinnableGridCard>
  ));

  const likedSongsListItem = effectiveLikedCount > 0 && (isUnifiedLikedActive ? (
    <PinnableListItem key="liked-songs-unified" onClick={() => onLikedSongsClick()}>
      <PlaylistImageWrapper>
        <div style={{ background: getLikedSongsGradient('unified'), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '0.5rem', fontSize: '1.5rem', color: 'white' }}>♥</div>
      </PlaylistImageWrapper>
      <PlaylistInfoDiv>
        <PlaylistName>{LIKED_SONGS_NAME}</PlaylistName>
        <PlaylistDetails>{effectiveLikedCount} tracks • Shuffle enabled</PlaylistDetails>
      </PlaylistInfoDiv>
      {likedSongsPinBtn}
    </PinnableListItem>
  ) : usePerProviderLiked ? (
    likedSongsPerProvider.map(({ provider, count }) => (
      <PinnableListItem key={`liked-songs-${provider}`} onClick={() => onLikedSongsClick(provider)}>
        <div style={{ position: 'relative' }}>
          <PlaylistImageWrapper>
            <div style={{ background: getLikedSongsGradient(provider), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '0.5rem', fontSize: '1.5rem', color: 'white' }}>♥</div>
          </PlaylistImageWrapper>
          <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 2 }}>
            <ProviderIcon provider={provider} size={18} />
          </div>
        </div>
        <PlaylistInfoDiv>
          <PlaylistName>{LIKED_SONGS_NAME}</PlaylistName>
          <PlaylistDetails>{count} tracks • Shuffle enabled</PlaylistDetails>
        </PlaylistInfoDiv>
        {likedSongsPinBtn}
      </PinnableListItem>
    ))
  ) : (
    <PinnableListItem key="liked-songs" onClick={() => onLikedSongsClick()}>
      <PlaylistImageWrapper>
        <div style={{ background: getLikedSongsGradient(activeDescriptor?.id), display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', borderRadius: '0.5rem', fontSize: '1.5rem', color: 'white' }}>♥</div>
      </PlaylistImageWrapper>
      <PlaylistInfoDiv>
        <PlaylistName>{LIKED_SONGS_NAME}</PlaylistName>
        <PlaylistDetails>{likedSongsCount} tracks • Shuffle enabled</PlaylistDetails>
      </PlaylistInfoDiv>
      {likedSongsPinBtn}
    </PinnableListItem>
  ));

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
  const hasPinnedSection = pinnedPlaylists.length > 0 || (likedSongsPinned && likedSongsCount > 0 && !hasActiveFilters);
  const likedSongsItem = inDrawer ? likedSongsGridCard : likedSongsListItem;

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
      {/* Pinned section: liked songs (if pinned) + pinned playlists */}
      {!hasActiveFilters && likedSongsPinned && likedSongsItem}
      {pinnedPlaylists.map(renderFn)}
      {hasPinnedSection && <PinnedSectionLabel key="__pin-sep">Pinned</PinnedSectionLabel>}
      {/* Unpinned section: liked songs (if not pinned) + remaining playlists */}
      {(hasActiveFilters || !likedSongsPinned) && likedSongsItem}
      {unpinnedPlaylists.map(renderFn)}
      {emptyState}
    </Grid>
  );
});
