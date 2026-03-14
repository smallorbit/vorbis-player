import { memo } from 'react';
import type { Track } from '../services/spotify';
import type { ProviderId } from '../types/domain';
import { useSpotifyControls } from '../hooks/useSpotifyControls';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import { PlayerControlsContainer } from './controls/styled';
import TrackInfo from './controls/TrackInfo';
import PlaybackControls from './controls/PlaybackControls';
import TimelineControls from './controls/TimelineControls';


interface SpotifyPlayerControlsProps {
  currentTrack: Track | null;
  accentColor: string;
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
  radioActive?: boolean;
  currentTrackProvider?: ProviderId;
}

// --- SpotifyPlayerControls Component ---
const SpotifyPlayerControls = memo<SpotifyPlayerControlsProps>(({
  currentTrack,
  accentColor,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  isLiked: propIsLiked,
  isLikePending: propIsLikePending,
  onToggleLike: propOnToggleLike,
  onArtistBrowse,
  onAlbumPlay,
  radioActive,
  currentTrackProvider,
}) => {
  // Get responsive sizing information
  const { isMobile, isTablet, isDesktop } = usePlayerSizing();

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
      <TrackInfo
        track={currentTrack}
        isMobile={isMobile}
        isTablet={isTablet}
        onArtistBrowse={onArtistBrowse}
        onAlbumPlay={onAlbumPlay}
        radioActive={radioActive}
        currentProvider={currentTrackProvider}
      />

      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '0.5rem' }}>
        <PlaybackControls
          onPrevious={onPrevious}
          onPlay={onPlay}
          onPause={onPause}
          onNext={onNext}
          isPlaying={isPlaying}
          accentColor={accentColor}
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
        accentColor={accentColor}
        isMobile={isMobile}
        isTablet={isTablet}
      />
    </PlayerControlsContainer>
  );
});

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default SpotifyPlayerControls; 
