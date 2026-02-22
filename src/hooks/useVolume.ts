import { useEffect, useCallback, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { useLocalStorage } from './useLocalStorage';

const VOLUME_KEY = 'vorbis-player-volume';
const MUTED_KEY = 'vorbis-player-muted';
const DEFAULT_VOLUME = 50;

export const useVolume = () => {
  const [volume, setVolume] = useLocalStorage<number>(VOLUME_KEY, DEFAULT_VOLUME);
  const [isMuted, setIsMuted] = useLocalStorage<boolean>(MUTED_KEY, false);
  const previousVolumeRef = useRef(volume > 0 ? volume : DEFAULT_VOLUME);
  const initialVolumeRef = useRef(isMuted ? 0 : volume / 100);

  useEffect(() => {
    spotifyPlayer.setVolume(initialVolumeRef.current);
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (newMuted) {
        previousVolumeRef.current = volume > 0 ? volume : DEFAULT_VOLUME;
        spotifyPlayer.setVolume(0);
      } else {
        const restore = previousVolumeRef.current > 0 ? previousVolumeRef.current : DEFAULT_VOLUME;
        setVolume(restore);
        spotifyPlayer.setVolume(restore / 100);
      }
      return newMuted;
    });
  }, [volume, setIsMuted, setVolume]);

  const handleVolumeButtonClick = useCallback(() => {
    handleMuteToggle();
  }, [handleMuteToggle]);

  const setVolumeLevel = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVolume)));
    setVolume(clamped);
    spotifyPlayer.setVolume(clamped / 100);

    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    if (clamped === 0 && !isMuted) {
      setIsMuted(true);
    }
  }, [isMuted, setVolume, setIsMuted]);

  return {
    isMuted,
    volume,
    handleMuteToggle,
    handleVolumeButtonClick,
    setVolumeLevel,
  };
};