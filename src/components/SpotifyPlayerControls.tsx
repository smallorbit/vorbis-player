import { memo } from 'react';
import type { Track } from '../services/spotify';
import { useSpotifyControls } from '../hooks/useSpotifyControls';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import { useCustomAccentColors } from '../hooks/useCustomAccentColors';
import { PlayerControlsContainer } from './controls/styled';
import TrackInfo from './controls/TrackInfo';
import ControlsToolbar from './controls/ControlsToolbar';
import TimelineControls from './controls/TimelineControls';



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

  // Check glow settings
  if (prevProps.glowEnabled !== nextProps.glowEnabled) {
    return false;
  }

  // Check visual effects state
  if (prevProps.showVisualEffects !== nextProps.showVisualEffects) {
    return false;
  }

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
  onAccentColorChange?: (color: string) => void;
  onShowVisualEffects?: () => void;
  showVisualEffects?: boolean;
  // Add glow control props
  glowEnabled?: boolean;
  onGlowToggle?: () => void;
}

// --- SpotifyPlayerControls Component ---
const SpotifyPlayerControls = memo<SpotifyPlayerControlsProps>(({
  currentTrack,
  accentColor,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onAccentColorChange,
  onShowVisualEffects,
  showVisualEffects,
  glowEnabled,
  onGlowToggle
}) => {
  // Get responsive sizing information
  const { isMobile, isTablet } = usePlayerSizing();

  // Use custom accent colors hook
  const { customAccentColorOverrides, handleCustomAccentColor, handleAccentColorChange } = useCustomAccentColors({
    currentTrackId: currentTrack?.id,
    onAccentColorChange
  });

  // Use Spotify controls hook
  const {
    isPlaying,
    isMuted,
    volume,
    currentPosition,
    duration,
    isLiked,
    isLikePending,
    handleVolumeButtonClick,
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

  return (
    <PlayerControlsContainer $isMobile={isMobile} $isTablet={isTablet}>
      <TrackInfo
        track={currentTrack}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      <ControlsToolbar
        onPrevious={onPrevious}
        onPlay={onPlay}
        onPause={onPause}
        onNext={onNext}
        isPlaying={isPlaying}
        accentColor={accentColor}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      <TimelineControls
        isMuted={isMuted}
        volume={volume}
        onVolumeButtonClick={handleVolumeButtonClick}
        currentPosition={currentPosition}
        duration={duration}
        formatTime={formatTime}
        onSliderChange={handleSliderChange}
        onSliderMouseDown={handleSliderMouseDown}
        onSliderMouseUp={handleSliderMouseUp}
        trackId={currentTrack?.id}
        isLiked={isLiked}
        isLikePending={isLikePending}
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