import * as React from 'react';
import { ALL_MUSIC_PIN_ID } from '@/constants/playlist';
import {
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
  PinnableGridCard,
  TabSpinner,
} from './styled';
import { allMusicAsPlaylistInfo, getLikedSongsGradient } from './playlistUtils';
import { PinIcon } from './utils';
import { useLibraryPins, useLibraryActions } from './LibraryContext';

const ALL_MUSIC_TITLE = 'All Music';

interface AllMusicCardProps {
  layout: 'grid' | 'list';
  count: number;
}

const ShuffleArt: React.FC<{ gradient: string; layout: 'grid' | 'list' }> = ({ gradient, layout }) => {
  const glyphSize = layout === 'list' ? 28 : 64;
  return (
    <div
      data-testid="all-music-art"
      style={{
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        borderRadius: layout === 'list' ? '0.5rem' : undefined,
        color: 'white',
      }}
    >
      <svg
        data-testid="all-music-shuffle-glyph"
        width={glyphSize}
        height={glyphSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M16 3h5v5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 20 21 3"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 16v5h-5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 15l6 6"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 4l5 5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const AllMusicCard: React.FC<AllMusicCardProps> = React.memo(function AllMusicCard({ layout, count }) {
  const { isPlaylistPinned, canPinMorePlaylists, onPinPlaylistClick } = useLibraryPins();
  const { onPlaylistContextMenu } = useLibraryActions();

  const allMusicPinned = isPlaylistPinned(ALL_MUSIC_PIN_ID);
  const gradient = getLikedSongsGradient('dropbox');

  const subtitleText = count > 0 ? `${count} tracks • Shuffled` : null;
  const subtitle = subtitleText ?? <TabSpinner />;

  const openPopover = (e: React.MouseEvent) =>
    onPlaylistContextMenu(allMusicAsPlaylistInfo(), e);

  if (layout === 'grid') {
    return (
      <PinnableGridCard
        key="all-music"
        onClick={openPopover}
        onContextMenu={openPopover}
      >
        <GridCardArtWrapper style={{ position: 'relative' }}>
          <ShuffleArt gradient={gradient} layout="grid" />
          <GridCardPinOverlay
            $isPinned={allMusicPinned}
            onClick={(e) => onPinPlaylistClick(ALL_MUSIC_PIN_ID, e)}
          >
            <PinIcon filled={allMusicPinned} />
          </GridCardPinOverlay>
        </GridCardArtWrapper>
        <GridCardTextArea>
          <GridCardTitle>{ALL_MUSIC_TITLE}</GridCardTitle>
          <GridCardSubtitle>{subtitle}</GridCardSubtitle>
        </GridCardTextArea>
      </PinnableGridCard>
    );
  }

  return (
    <PinnableListItem key="all-music" onClick={openPopover} onContextMenu={openPopover}>
      <PlaylistImageWrapper>
        <ShuffleArt gradient={gradient} layout="list" />
      </PlaylistImageWrapper>
      <PlaylistInfoDiv>
        <PlaylistName>{ALL_MUSIC_TITLE}</PlaylistName>
        <PlaylistDetails>{subtitle}</PlaylistDetails>
      </PlaylistInfoDiv>
      <PinButton
        $isPinned={allMusicPinned}
        $disabled={!canPinMorePlaylists && !allMusicPinned}
        onClick={(e) => onPinPlaylistClick(ALL_MUSIC_PIN_ID, e)}
        title={allMusicPinned ? 'Unpin' : (canPinMorePlaylists ? 'Pin to top' : 'Pin limit reached (12)')}
        aria-label={allMusicPinned ? 'Unpin All Music' : 'Pin All Music to top'}
      >
        <PinIcon filled={allMusicPinned} />
      </PinButton>
    </PinnableListItem>
  );
});

export { AllMusicCard };
