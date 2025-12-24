import React, { useCallback } from 'react';
import SpotifyPlayerControls from './SpotifyPlayerControls';
import type { Track } from '../services/spotify';

interface PlaybackHandlers {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
}

interface PlayerControlsProps {
  currentTrack: Track | null;
  accentColor: string;
  trackCount: number;
  isLiked?: boolean;
  isLikePending?: boolean;
  isMuted?: boolean;
  volume?: number;
  onMuteToggle?: () => void;
  onToggleLike?: () => void;
  onPlayback: PlaybackHandlers;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentTrack,
  accentColor,
  trackCount,
  isLiked,
  isLikePending,
  isMuted,
  volume,
  onMuteToggle,
  onToggleLike,
  onPlayback
}) => {
  // Control state logic
  const handlePlayClick = useCallback(() => {
    onPlayback.play();
  }, [onPlayback]);

  const handlePauseClick = useCallback(() => {
    onPlayback.pause();
  }, [onPlayback]);

  // Control validation
  const handleNext = useCallback(() => {
    if (trackCount > 0) {
      onPlayback.next();
    }
  }, [onPlayback, trackCount]);

  const handlePrevious = useCallback(() => {
    if (trackCount > 0) {
      onPlayback.previous();
    }
  }, [onPlayback, trackCount]);

  // Note: Keyboard shortcuts are handled in PlayerContent via useKeyboardShortcuts
  // This component only manages playback UI rendering

  return (
    <SpotifyPlayerControls
      currentTrack={currentTrack}
      accentColor={accentColor}
      onPlay={handlePlayClick}
      onPause={handlePauseClick}
      onNext={handleNext}
      onPrevious={handlePrevious}
      trackCount={trackCount}
      isLiked={isLiked}
      isLikePending={isLikePending}
      isMuted={isMuted}
      volume={volume}
      onMuteToggle={onMuteToggle}
      onToggleLike={onToggleLike}
    />
  );
};

export default PlayerControls;