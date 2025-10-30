import React, { useState, useEffect, useCallback } from 'react';
import SpotifyPlayerControls from './SpotifyPlayerControls';
import { spotifyPlayer } from '../services/spotifyPlayer';
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

const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: 'Space',
  NEXT_TRACK: 'ArrowRight',
  PREVIOUS_TRACK: 'ArrowLeft',
  TOGGLE_PLAYLIST: 'KeyP',
  TOGGLE_VISUAL_EFFECTS: 'KeyV',
  VOLUME_UP: 'ArrowUp',
  VOLUME_DOWN: 'ArrowDown',
  MUTE: 'KeyM'
} as const;

const PlayerControls: React.FC<PlayerControlsProps> = ({
  currentTrack,
  accentColor,
  trackCount,
  visualEffectsEnabled,
  onPlayback,
  onUI,
  onAccentColorChange
}) => {
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;

      switch (event.code) {
        case KEYBOARD_SHORTCUTS.PLAY_PAUSE:
          event.preventDefault();
          if (isPlaying) {
            handlePauseClick();
          } else {
            handlePlayClick();
          }
          break;
        case KEYBOARD_SHORTCUTS.NEXT_TRACK:
          event.preventDefault();
          handleNext();
          break;
        case KEYBOARD_SHORTCUTS.PREVIOUS_TRACK:
          event.preventDefault();
          handlePrevious();
          break;
        case KEYBOARD_SHORTCUTS.TOGGLE_PLAYLIST:
          event.preventDefault();
          onUI.showPlaylist();
          break;
        case KEYBOARD_SHORTCUTS.TOGGLE_VISUAL_EFFECTS:
          event.preventDefault();
          onUI.toggleVisualEffects();
          break;
        case KEYBOARD_SHORTCUTS.VOLUME_UP:
          event.preventDefault();
          // Volume control functionality can be added here if needed
          break;
        case KEYBOARD_SHORTCUTS.VOLUME_DOWN:
          event.preventDefault();
          // Volume control functionality can be added here if needed
          break;
        case KEYBOARD_SHORTCUTS.MUTE:
          event.preventDefault();
          // Mute functionality can be added here if needed
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, handlePlayClick, handlePauseClick, handleNext, handlePrevious, onUI]);

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
      onAccentColorChange={onAccentColorChange}
      onShowVisualEffects={onUI.showVisualEffects}
      glowEnabled={visualEffectsEnabled}
      onGlowToggle={onUI.toggleVisualEffects}
    />
  );
};

export default PlayerControls;