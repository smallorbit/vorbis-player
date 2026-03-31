import { memo } from 'react';
import type { MediaTrack } from '@/types/domain';
import { useSpotifyControls } from '../hooks/useSpotifyControls';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { PlayerControlsContainer } from './controls/styled';
import TrackInfo from './controls/TrackInfo';
import PlaybackControls from './controls/PlaybackControls';
import TimelineControls from './controls/TimelineControls';
import ProviderIcon from './ProviderIcon';
import type { ProviderId } from '@/types/domain';


interface SpotifyPlayerControlsProps {
  currentTrack: MediaTrack | null;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  trackCount: number;
  isLiked?: boolean;
  isLikePending?: boolean;
  onToggleLike?: () => void;
  onArtistBrowse?: (artistName: string) => void;
  onAlbumPlay?: (albumId: string, albumName: string) => void;
  currentTrackProvider?: ProviderId;
}

// --- SpotifyPlayerControls Component ---
const SpotifyPlayerControls = memo<SpotifyPlayerControlsProps>(({
  currentTrack,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  isLiked: propIsLiked,
  isLikePending: propIsLikePending,
  onToggleLike: propOnToggleLike,
  onArtistBrowse,
  onAlbumPlay,
  currentTrackProvider,
}) => {
  // Get responsive sizing information
  const { isMobile, isTablet, isDesktop } = usePlayerSizingContext();
  const { hasMultipleProviders, enabledProviderIds } = useProviderContext();
  const showProviderBadge = hasMultipleProviders && enabledProviderIds.length > 1;
  const trackProvider = currentTrack?.provider as ProviderId | undefined;

  // Use Spotify controls hook — like state is always provided via props from usePlayerLogic
  const {
    isPlaying,
    currentPosition,
    duration,
    handleLikeToggle,
    handleSliderChange,
    handleSliderMouseDown,
    handleSliderMouseUp,
    formatTime,
  } = useSpotifyControls({
    currentTrack,
    isLiked: propIsLiked ?? false,
    isLikePending: propIsLikePending ?? false,
    onPlay,
    onPause,
    onNext,
    onPrevious,
    onLikeToggle: propOnToggleLike ?? (() => {}),
    currentTrackProvider,
  });

  const effectiveIsLiked = propIsLiked ?? false;
  const effectiveIsLikePending = propIsLikePending ?? false;
  const effectiveHandleLikeToggle = handleLikeToggle;
  
  return (
    <PlayerControlsContainer $isMobile={isMobile} $isTablet={isTablet} $compact={!isDesktop}>
      {showProviderBadge && trackProvider && (
        <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 12 }}>
          <ProviderIcon provider={trackProvider} size={22} />
        </div>
      )}
      <TrackInfo
        track={currentTrack}
        isMobile={isMobile}
        isTablet={isTablet}
        onArtistBrowse={onArtistBrowse}
        onAlbumPlay={onAlbumPlay}
      />

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '0.5rem' }}>
        <PlaybackControls
          onPrevious={onPrevious}
          onPlay={onPlay}
          onPause={onPause}
          onNext={onNext}
          isPlaying={isPlaying}
          isMobile={isMobile}
          isTablet={isTablet}
        />
      </div>

      <TimelineControls
        currentPosition={currentPosition}
        duration={duration}
        formatTime={formatTime}
        onSliderChange={handleSliderChange}
        onSliderMouseDown={handleSliderMouseDown}
        onSliderMouseUp={handleSliderMouseUp}
        trackId={currentTrack?.id}
        isLiked={effectiveIsLiked}
        isLikePending={effectiveIsLikePending}
        onLikeToggle={effectiveHandleLikeToggle}
        isMobile={isMobile}
        isTablet={isTablet}
      />
    </PlayerControlsContainer>
  );
});

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default SpotifyPlayerControls; 
