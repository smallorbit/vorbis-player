import React, { useState, useEffect, useCallback } from 'react';
import SpotifyPlayerControls from './SpotifyPlayerControls';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { Track } from '../services/spotify';

interface PlaybackHandlers {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
}

interface UIHandlers {
  showPlaylist: () => void;
  showVisualEffects: () => void;
  toggleVisualEffects: () => void;
}

interface PlayerControlsProps {
  currentTrack: Track | null;
  accentColor: string;
  trackCount: number;
  visualEffectsEnabled: boolean;
  onPlayback: PlaybackHandlers;
  onUI: UIHandlers;
  onAccentColorChange: (color: string) => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentTrack,
  accentColor,
  trackCount,
  onPlayback,
  onUI}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Control state logic
  const handlePlayClick = useCallback(() => {
    setIsPlaying(true);
    onPlayback.play();
  }, [onPlayback]);

  const handlePauseClick = useCallback(() => {
    setIsPlaying(false);
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

  // Handle play/pause shortcut
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      handlePauseClick();
    } else {
      handlePlayClick();
    }
  }, [isPlaying, handlePlayClick, handlePauseClick]);

  // Use centralized keyboard shortcuts
  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: handleNext,
    onPrevious: handlePrevious,
    onTogglePlaylist: onUI.showPlaylist,
    onToggleVisualEffects: onUI.toggleVisualEffects
  });

  // Sync with actual Spotify player state
  useEffect(() => {
    const updateControlState = (state: SpotifyPlaybackState | null) => {
      if (state) {
        setIsPlaying(!state.paused);
        // Note: volume property may not be available in all Spotify API versions
        // setVolume(state.volume || 100);
      }
    };

    spotifyPlayer.onPlayerStateChanged(updateControlState);
    // Note: removePlayerStateListener may not be available in all versions
    // return () => spotifyPlayer.removePlayerStateListener(updateControlState);
  }, []);

  return (
    <SpotifyPlayerControls
      currentTrack={currentTrack}
      accentColor={accentColor}
      onPlay={handlePlayClick}
      onPause={handlePauseClick}
      onNext={handleNext}
      onPrevious={handlePrevious}
      trackCount={trackCount}
    />
  );
};

export default PlayerControls;