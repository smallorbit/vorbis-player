import { useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ProviderId } from '@/types/domain';
const DEFAULT_VOLUME = 50;

export const useVolume = (currentTrackProvider?: ProviderId) => {
  const [volume, setVolume] = useLocalStorage<number>(STORAGE_KEYS.VOLUME, DEFAULT_VOLUME);
  const [isMuted, setIsMuted] = useLocalStorage<boolean>(STORAGE_KEYS.MUTED, false);
  const previousVolumeRef = useRef(volume > 0 ? volume : DEFAULT_VOLUME);
  const initialVolumeRef = useRef(isMuted ? 0 : volume / 100);

  const { activeDescriptor } = useProviderContext();

  const getPlayingPlayback = useCallback(() => {
    const playingDescriptor =
      currentTrackProvider && currentTrackProvider !== activeDescriptor?.id
        ? providerRegistry.get(currentTrackProvider)
        : activeDescriptor;
    return playingDescriptor?.playback;
  }, [activeDescriptor, currentTrackProvider]);

  useEffect(() => {
    getPlayingPlayback()?.setVolume(initialVolumeRef.current);
  }, [getPlayingPlayback]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (newMuted) {
        previousVolumeRef.current = volume > 0 ? volume : DEFAULT_VOLUME;
        getPlayingPlayback()?.setVolume(0);
      } else {
        const restore = previousVolumeRef.current > 0 ? previousVolumeRef.current : DEFAULT_VOLUME;
        setVolume(restore);
        getPlayingPlayback()?.setVolume(restore / 100);
      }
      return newMuted;
    });
  }, [volume, setIsMuted, setVolume, getPlayingPlayback]);

  const handleVolumeButtonClick = useCallback(() => {
    handleMuteToggle();
  }, [handleMuteToggle]);

  const setVolumeLevel = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVolume)));
    setVolume(clamped);
    getPlayingPlayback()?.setVolume(clamped / 100);

    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
    if (clamped === 0 && !isMuted) {
      setIsMuted(true);
    }
  }, [isMuted, setVolume, setIsMuted, getPlayingPlayback]);

  return {
    isMuted,
    volume,
    handleMuteToggle,
    handleVolumeButtonClick,
    setVolumeLevel,
  };
};
