import { useState, useEffect, useCallback } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';

export const useVolume = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [previousVolume, setPreviousVolume] = useState(50);

  // Initialize volume on mount
  useEffect(() => {
    spotifyPlayer.setVolume(0.5);
    setVolume(50);
    setPreviousVolume(50);
  }, []);

  const handleMuteToggle = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (newMutedState) {
      setPreviousVolume(volume);
      spotifyPlayer.setVolume(0);
    } else {
      const volumeToRestore = previousVolume > 0 ? previousVolume : 50;
      setVolume(volumeToRestore);
      spotifyPlayer.setVolume(volumeToRestore / 100);
    }
  }, [isMuted, volume, previousVolume]);

  const handleVolumeButtonClick = useCallback(() => {
    handleMuteToggle();
  }, [handleMuteToggle]);

  const setVolumeLevel = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, newVolume));
    setVolume(clampedVolume);
    spotifyPlayer.setVolume(clampedVolume / 100);

    // Auto-unmute if volume is increased from 0
    if (clampedVolume > 0 && isMuted) {
      setIsMuted(false);
    }

    // Auto-mute if volume is set to 0
    if (clampedVolume === 0 && !isMuted) {
      setIsMuted(true);
    }
  }, [isMuted]);

  return {
    isMuted,
    volume,
    handleMuteToggle,
    handleVolumeButtonClick,
    setVolumeLevel,
  };
};