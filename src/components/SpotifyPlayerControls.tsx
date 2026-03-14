import { memo } from 'react';
import type { Track } from '../services/spotify';
import { useSpotifyControls } from '../hooks/useSpotifyControls';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { PlayerControlsContainer } from './controls/styled';
import TrackInfo from './controls/TrackInfo';
import PlaybackControls from './controls/PlaybackControls';
import TimelineControls from './controls/TimelineControls';


interface SpotifyPlayerControlsProps {
  currentTrack: Track | null;
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
}) => {
  // Get responsive sizing information
  const { isMobile, isTablet, isDesktop } = usePlayerSizingContext();

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
  });

  const effectiveIsLiked = propIsLiked ?? false;
  const effectiveIsLikePending = propIsLikePending ?? false;
  const effectiveHandleLikeToggle = handleLikeToggle;
  
  return (
    <PlayerControlsContainer $isMobile={isMobile} $isTablet={isTablet} $compact={!isDesktop}>
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
