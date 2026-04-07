import * as React from 'react';
import ProviderIcon from '../ProviderIcon';
import { LIKED_SONGS_ID, LIKED_SONGS_NAME } from '@/constants/playlist';
import type { ProviderId } from '@/types/domain';
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
  ProviderBadgeOverlay,
  PinnableGridCard,
  TabSpinner,
} from './styled';
import { getLikedSongsGradient, likedSongsAsPlaylistInfo, PinIcon } from './utils';
import { useLibraryContext } from './LibraryContext';

interface LikedSongsCardProps {
  layout: 'grid' | 'list';
  provider?: ProviderId;
  count: number;
}

const HeartArt: React.FC<{ gradient: string; layout: 'grid' | 'list' }> = ({ gradient, layout }) => (
  <div style={{
    background: gradient,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    borderRadius: layout === 'list' ? '0.5rem' : undefined,
    fontSize: layout === 'list' ? '1.5rem' : '3rem',
    color: 'white',
  }}>♥</div>
);

const LikedSongsCard: React.FC<LikedSongsCardProps> = React.memo(function LikedSongsCard({ layout, provider, count }) {
  const {
    isLikedSongsSyncing,
    isUnifiedLikedActive,
    isPlaylistPinned,
    canPinMorePlaylists,
    activeDescriptor,
    onPlaylistContextMenu,
    onPinPlaylistClick,
    onLikedSongsClick,
  } = useLibraryContext();

  const likedSongsPinned = isPlaylistPinned(LIKED_SONGS_ID);
  const isPerProvider = provider !== undefined;
  const gradient = getLikedSongsGradient(
    isPerProvider ? provider : (isUnifiedLikedActive ? 'unified' : activeDescriptor?.id)
  );

  const syncSpinner = isLikedSongsSyncing ? <TabSpinner /> : null;
  const subtitle = count > 0
    ? <>{count} tracks{syncSpinner}</>
    : <TabSpinner />;
  const listSubtitle = count > 0
    ? <>{count} tracks{syncSpinner} • Shuffle enabled</>
    : <TabSpinner />;

  const cardKey = isUnifiedLikedActive
    ? 'liked-songs-unified'
    : isPerProvider ? `liked-songs-${provider}` : 'liked-songs';

  if (layout === 'grid') {
    return (
      <PinnableGridCard
        key={cardKey}
        onClick={(e) => onPlaylistContextMenu(likedSongsAsPlaylistInfo(isPerProvider ? provider : undefined), e)}
        onContextMenu={(e) => onPlaylistContextMenu(likedSongsAsPlaylistInfo(isPerProvider ? provider : undefined), e)}
      >
        <GridCardArtWrapper style={{ position: 'relative' }}>
          <HeartArt gradient={gradient} layout="grid" />
          {isPerProvider && (
            <ProviderBadgeOverlay>
              <ProviderIcon provider={provider} size={22} />
            </ProviderBadgeOverlay>
          )}
          <GridCardPinOverlay $isPinned={likedSongsPinned} onClick={(e) => onPinPlaylistClick(LIKED_SONGS_ID, e)}>
            <PinIcon filled={likedSongsPinned} />
          </GridCardPinOverlay>
        </GridCardArtWrapper>
        <GridCardTextArea>
          <GridCardTitle>{LIKED_SONGS_NAME}</GridCardTitle>
          <GridCardSubtitle>{isPerProvider ? <>{count} tracks{syncSpinner}</> : subtitle}</GridCardSubtitle>
        </GridCardTextArea>
      </PinnableGridCard>
    );
  }

  const pinBtn = (
    <PinButton
      $isPinned={likedSongsPinned}
      $disabled={!canPinMorePlaylists && !likedSongsPinned}
      onClick={(e) => onPinPlaylistClick(LIKED_SONGS_ID, e)}
      title={likedSongsPinned ? 'Unpin' : (canPinMorePlaylists ? 'Pin to top' : 'Pin limit reached (12)')}
      aria-label={likedSongsPinned ? 'Unpin Liked Songs' : 'Pin Liked Songs to top'}
    >
      <PinIcon filled={likedSongsPinned} />
    </PinButton>
  );

  return (
    <PinnableListItem key={cardKey} onClick={() => onLikedSongsClick(isPerProvider ? provider : undefined)}>
      {isPerProvider ? (
        <div style={{ position: 'relative' }}>
          <PlaylistImageWrapper>
            <HeartArt gradient={gradient} layout="list" />
          </PlaylistImageWrapper>
          <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 2 }}>
            <ProviderIcon provider={provider} size={18} />
          </div>
        </div>
      ) : (
        <PlaylistImageWrapper>
          <HeartArt gradient={gradient} layout="list" />
        </PlaylistImageWrapper>
      )}
      <PlaylistInfoDiv>
        <PlaylistName>{LIKED_SONGS_NAME}</PlaylistName>
        <PlaylistDetails>{isPerProvider ? <>{count} tracks{syncSpinner} • Shuffle enabled</> : listSubtitle}</PlaylistDetails>
      </PlaylistInfoDiv>
      {pinBtn}
    </PinnableListItem>
  );
});

export { LikedSongsCard };
