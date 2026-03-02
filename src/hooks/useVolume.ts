import { useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useProviderContext } from '@/contexts/ProviderContext';

const VOLUME_KEY = 'vorbis-player-volume';
const MUTED_KEY = 'vorbis-player-muted';
const DEFAULT_VOLUME = 50;

export const useVolume = () => {
  const [volume, setVolume] = useLocalStorage<number>(VOLUME_KEY, DEFAULT_VOLUME);
  const [isMuted, setIsMuted] = useLocalStorage<boolean>(MUTED_KEY, false);
  const previousVolumeRef = useRef(volume > 0 ? volume : DEFAULT_VOLUME);
  const initialVolumeRef = useRef(isMuted ? 0 : volume / 100);

  const { activeDescriptor } = useProviderContext();

  useEffect(() => {
    activeDescriptor?.playback.setVolume(initialVolumeRef.current);
  }, [activeDescriptor]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (newMuted) {
        previousVolumeRef.current = volume > 0 ? volume : DEFAULT_VOLUME;
        activeDescriptor?.playback.setVolume(0);
      } else {
        const restore = previousVolumeRef.current > 0 ? previousVolumeRef.current : DEFAULT_VOLUME;
        setVolume(restore);
        activeDescriptor?.playback.setVolume(restore / 100);
      }
      return newMuted;
    });
  }, [volume, setIsMuted, setVolume, activeDescriptor]);

  const handleVolumeButtonClick = useCallback(() => {
    handleMuteToggle();
  }, [handleMuteToggle]);

  const setVolumeLevel = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVolume)));
    setVolume(clamped);
    activeDescriptor?.playback.setVolume(clamped / 100);

    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    if (clamped === 0 && !isMuted) {
      setIsMuted(true);
    }
  }, [isMuted, setVolume, setIsMuted, activeDescriptor]);

  return {
    isMuted,
    volume,
    handleMuteToggle,
    handleVolumeButtonClick,
    setVolumeLevel,
  };
};
