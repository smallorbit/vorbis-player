import * as React from 'react';
import type { AlbumInfo } from '../../services/spotify';
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
  ClickableArtist,
} from './styled';
import { PinIcon, PlaylistImage, GridCardImageComponent } from './utils';

interface AlbumGridProps {
  inDrawer: boolean;
  albums: AlbumInfo[];
  isInitialLoadComplete: boolean;
  showProviderBadges: boolean;
  searchQuery: string;
  artistFilter: string;
  pinnedAlbums: AlbumInfo[];
  unpinnedAlbums: AlbumInfo[];
  isAlbumPinned: (id: string) => boolean;
  canPinMoreAlbums: boolean;
  onAlbumClick: (album: AlbumInfo) => void;
  onAlbumContextMenu: (album: AlbumInfo, e: React.MouseEvent) => void;
  onPinAlbumClick: (id: string, e: React.MouseEvent) => void;
  onArtistClick: (artist: string, e: React.MouseEvent) => void;
}

export const AlbumGrid: React.FC<AlbumGridProps> = React.memo(function AlbumGrid({
  inDrawer,
  isInitialLoadComplete,
  showProviderBadges,
  searchQuery,
  artistFilter,
  pinnedAlbums,
  unpinnedAlbums,
  isAlbumPinned,
  canPinMoreAlbums,
  onAlbumClick,
  onAlbumContextMenu,
  onPinAlbumClick,
  onArtistClick,
}) {
  const renderAlbumGrid = (album: AlbumInfo) => {
    const pinned = isAlbumPinned(album.id);
    return (
      <PinnableGridCard
        key={`${album.provider ?? 'default'}-${album.id}`}
        onClick={(e) => onAlbumContextMenu(album, e)}
        onContextMenu={(e) => onAlbumContextMenu(album, e)}
      >
        <GridCardArtWrapper style={{ position: 'relative' }}>
          <GridCardImageComponent images={album.images} alt={`${album.name} by ${album.artists}`} />
          {showProviderBadges && album.provider && (
            <ProviderBadgeOverlay>
              <ProviderIcon provider={album.provider} size={22} />
            </ProviderBadgeOverlay>
          )}
          <GridCardPinOverlay $isPinned={pinned} onClick={(e) => onPinAlbumClick(album.id, e)}>
            <PinIcon filled={pinned} />
          </GridCardPinOverlay>
        </GridCardArtWrapper>
        <GridCardTextArea>
          <GridCardTitle>{album.name}</GridCardTitle>
          <GridCardSubtitle
            $clickable={true}
            onClick={(e) => onArtistClick(album.artists, e)}
          >
            {album.artists}
          </GridCardSubtitle>
        </GridCardTextArea>
      </PinnableGridCard>
    );
  };

  const renderAlbumList = (album: AlbumInfo) => {
    const pinned = isAlbumPinned(album.id);
    return (
      <PinnableListItem
        key={`${album.provider ?? 'default'}-${album.id}`}
        onClick={() => onAlbumClick(album)}
        onContextMenu={(e) => onAlbumContextMenu(album, e)}
      >
        <div style={{ position: 'relative' }}>
          <PlaylistImage images={album.images} alt={`${album.name} by ${album.artists}`} />
          {showProviderBadges && album.provider && (
            <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 2 }}>
              <ProviderIcon provider={album.provider} size={18} />
            </div>
          )}
        </div>
        <PlaylistInfoDiv>
          <PlaylistName>{album.name}</PlaylistName>
          <PlaylistDetails>
            <ClickableArtist onClick={(e) => onArtistClick(album.artists, e)}>
              {album.artists}
            </ClickableArtist>
            {' • '}{album.total_tracks} tracks
          </PlaylistDetails>
        </PlaylistInfoDiv>
        <PinButton
          $isPinned={pinned}
          $disabled={!canPinMoreAlbums && !pinned}
          onClick={(e) => onPinAlbumClick(album.id, e)}
          title={pinned ? 'Unpin' : (canPinMoreAlbums ? 'Pin to top' : 'Pin limit reached (8)')}
          aria-label={pinned ? `Unpin ${album.name}` : `Pin ${album.name} to top`}
        >
          <PinIcon filled={pinned} />
        </PinButton>
      </PinnableListItem>
    );
  };

  const renderFn = inDrawer ? renderAlbumGrid : renderAlbumList;

  const emptyState = pinnedAlbums.length === 0 && unpinnedAlbums.length === 0 && isInitialLoadComplete && (
    <EmptyState $fullWidth={inDrawer}>
      {searchQuery || artistFilter
        ? 'No albums match your filters.'
        : 'No albums found. Save some albums in Spotify to see them here!'}
    </EmptyState>
  );

  const Grid = inDrawer ? MobileGrid : PlaylistGridDiv;
  return (
    <Grid $inDrawer={inDrawer ? undefined : false}>
      {pinnedAlbums.map(renderFn)}
      {pinnedAlbums.length > 0 && <PinnedSectionLabel key="__album-pin-sep">Pinned</PinnedSectionLabel>}
      {unpinnedAlbums.map(renderFn)}
      {emptyState}
    </Grid>
  );
});
