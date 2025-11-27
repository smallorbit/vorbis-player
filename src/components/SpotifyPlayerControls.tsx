import { memo } from 'react';
import type { Track } from '../services/spotify';
import { useSpotifyControls } from '../hooks/useSpotifyControls';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import { PlayerControlsContainer } from './controls/styled';
import TrackInfo from './controls/TrackInfo';
import PlaybackControls from './controls/PlaybackControls';
import TimelineControls from './controls/TimelineControls';
import { TrackInfoRow, TrackInfoLeft, TrackInfoCenter, TrackInfoRight } from './controls/styled';



// Custom comparison function for SpotifyPlayerControls memo optimization
const areControlsPropsEqual = (
  prevProps: SpotifyPlayerControlsProps,
  nextProps: SpotifyPlayerControlsProps
): boolean => {
  // Check if track changed (most important check)
  if (prevProps.currentTrack?.id !== nextProps.currentTrack?.id) {
    return false;
  }

  // Check accent color
  if (prevProps.accentColor !== nextProps.accentColor) {
    return false;
  }

  // Check liked status
  if (prevProps.isLiked !== nextProps.isLiked || prevProps.isLikePending !== nextProps.isLikePending) {
    return false;
  }

  // Check volume status
  if (prevProps.isMuted !== nextProps.isMuted || prevProps.volume !== nextProps.volume) {
    return false;
  }

  // Visual effects and glow are handled by the quick actions panel now

  // Check track count for playlist display
  if (prevProps.trackCount !== nextProps.trackCount) {
    return false;
  }

  // For callbacks, we assume they're stable (parent should use useCallback)
  // This prevents unnecessary re-renders due to function reference changes

  return true;
};

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
  isMuted?: boolean;
  volume?: number;
  onMuteToggle?: () => void;
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
  isMuted: propIsMuted,
  volume: propVolume,
  onMuteToggle: propOnMuteToggle,
}) => {
  // Get responsive sizing information
  const { isMobile, isTablet } = usePlayerSizing();

  // Color picker and overrides are managed in the quick actions panel

  // Use Spotify controls hook
  const {
    isPlaying,
    isMuted,
    volume,
    currentPosition,
    duration,
    isLiked: hookIsLiked,
    isLikePending: hookIsLikePending,
    handleVolumeButtonClick: hookHandleVolumeButtonClick,
    handleLikeToggle,
    handleSliderChange,
    handleSliderMouseDown,
    handleSliderMouseUp,
    formatTime,
  } = useSpotifyControls({
    currentTrack,
    onPlay,
    onPause,
    onNext,
    onPrevious
  });

  // Use props if available (from usePlayerLogic which handles keyboard shortcuts), otherwise fallback to hook state
  // Note: We prefer props for like state to ensure synchronization with keyboard shortcuts
  const effectiveIsLiked = typeof propIsLiked !== 'undefined' ? propIsLiked : hookIsLiked;
  const effectiveIsLikePending = typeof propIsLikePending !== 'undefined' ? propIsLikePending : hookIsLikePending;
  const effectiveIsMuted = typeof propIsMuted !== 'undefined' ? propIsMuted : isMuted;
  const effectiveVolume = typeof propVolume !== 'undefined' ? propVolume : volume;
  const effectiveHandleVolumeButtonClick = propOnMuteToggle || hookHandleVolumeButtonClick;

  // Use the parent's onLikeToggle if available (to unify state), otherwise use the hook's handler
  // Note: SpotifyPlayerControls doesn't currently receive onLikeToggle as a prop, but we should prioritize
  // using the logic that updates the state we are displaying.
  // Since we display propIsLiked, we should ideally trigger the handler that updates propIsLiked.
  // However, we currently rely on the parent passing the state change down.
  
  return (
    <PlayerControlsContainer $isMobile={isMobile} $isTablet={isTablet}>
      <TrackInfo
        track={currentTrack}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      <TrackInfoRow style={{ position: 'relative' }}>
        <TrackInfoLeft>
          {/* Left side is empty - could be used for other controls if needed */}
        </TrackInfoLeft>
        <TrackInfoCenter>
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
        </TrackInfoCenter>
        <TrackInfoRight>
          {/* Quick actions moved to right-side panel */}
        </TrackInfoRight>
      </TrackInfoRow>

      <TimelineControls
        isMuted={effectiveIsMuted}
        volume={effectiveVolume}
        onVolumeButtonClick={effectiveHandleVolumeButtonClick}
        currentPosition={currentPosition}
        duration={duration}
        formatTime={formatTime}
        onSliderChange={handleSliderChange}
        onSliderMouseDown={handleSliderMouseDown}
        onSliderMouseUp={handleSliderMouseUp}
        trackId={currentTrack?.id}
        isLiked={effectiveIsLiked}
        isLikePending={effectiveIsLikePending}
        onLikeToggle={handleLikeToggle}
        accentColor={accentColor}
        isMobile={isMobile}
        isTablet={isTablet}
      />
    </PlayerControlsContainer>
  );
}, areControlsPropsEqual);

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default SpotifyPlayerControls; 