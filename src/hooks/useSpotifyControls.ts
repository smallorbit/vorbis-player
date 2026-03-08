import { useState, useEffect, useCallback, useRef } from 'react';
import type { Track } from '../services/spotify';
import { useVolume } from './useVolume';
import { useProviderContext } from '@/contexts/ProviderContext';
import type { PlaybackState } from '@/types/domain';

interface UseSpotifyControlsProps {
  currentTrack: Track | null;
  isLiked: boolean;
  isLikePending: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onLikeToggle: () => void;
}

export const useSpotifyControls = ({
  currentTrack,
  isLiked,
  isLikePending,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onLikeToggle
}: UseSpotifyControlsProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const { activeDescriptor } = useProviderContext();

  // Use volume hook for volume-related functionality
  const { isMuted, volume, handleMuteToggle, handleVolumeButtonClick, setVolumeLevel } = useVolume();

  // Keep ref in sync so the event handler always has the latest value
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Seed duration from track metadata so the slider has a valid max
  // before the playback engine reports it (e.g. MusicKit currentPlaybackDuration
  // returns 0 until the track fully loads).
  useEffect(() => {
    if (currentTrack?.duration_ms) {
      setDuration(currentTrack.duration_ms);
    }
  }, [currentTrack?.id, currentTrack?.duration_ms]);

  // Use event-based playback state updates via the provider adapter
  useEffect(() => {
    const playback = activeDescriptor?.playback;
    if (!playback) return;

    function handleProviderStateChange(state: PlaybackState | null) {
      if (state) {
        setIsPlaying(state.isPlaying);
        if (!isDraggingRef.current) {
          setCurrentPosition(state.positionMs);
        }
        if (state.durationMs) {
          setDuration(state.durationMs);
        }
      }
    }

    const unsubscribe = playback.subscribe(handleProviderStateChange);

    // Also check initial state once
    playback.getState().then((state) => {
      if (state) {
        setIsPlaying(state.isPlaying);
        if (!isDraggingRef.current) {
          setCurrentPosition(state.positionMs);
        }
        if (state.durationMs) {
          setDuration(state.durationMs);
        }
      }
    });

    return unsubscribe;
  }, [activeDescriptor]);

  // Lightweight position poll — only to update the timeline slider smoothly.
  useEffect(() => {
    if (!isPlaying) return;
    const playback = activeDescriptor?.playback;
    if (!playback) return;

    const interval = setInterval(async () => {
      if (isDraggingRef.current) return;
      const state = await playback.getState();
      if (state) {
        setCurrentPosition(state.positionMs);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, activeDescriptor]);

  const handlePlayPause = useCallback(async () => {
    const playback = activeDescriptor?.playback;
    if (!playback) return;

    if (isPlaying) {
      onPause();
    } else {
      // Check if there's a track loaded in the player
      const state = await playback.getState();

      if (!state || !state.currentTrackId ||
          (currentTrack && state.currentTrackId !== currentTrack.id)) {
        onPlay();
      } else {
        if (!state.isPlaying) {
          await playback.resume();
        }
      }
    }
  }, [isPlaying, onPlay, onPause, currentTrack, activeDescriptor]);

  const handleSeek = useCallback(async (position: number) => {
    try {
      const playback = activeDescriptor?.playback;
      if (!playback) return;
      await playback.seek(position);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }, [activeDescriptor]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const position = parseInt(e.target.value);
    setCurrentPosition(position);
  }, []);

  const handleSliderMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleSliderMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const position = parseInt((e.target as HTMLInputElement).value);
    setIsDragging(false);
    handleSeek(position);
  }, [handleSeek]);

  const formatTime = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    isPlaying,
    isMuted,
    volume,
    currentPosition,
    duration,
    isDragging,
    isLiked,
    isLikePending,
    handlePlayPause,
    handleMuteToggle,
    handleVolumeButtonClick,
    setVolumeLevel,
    handleLikeToggle: onLikeToggle,
    handleSeek,
    handleSliderChange,
    handleSliderMouseDown,
    handleSliderMouseUp,
    formatTime,
    onNext,
    onPrevious,
  };
};
