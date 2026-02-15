import { useState, useEffect, useCallback, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { spotifyAuth } from '../services/spotify';
import type { Track } from '../services/spotify';
import { useVolume } from './useVolume';

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

  // Use volume hook for volume-related functionality
  const { isMuted, volume, handleMuteToggle, handleVolumeButtonClick } = useVolume();

  // Keep ref in sync so the event handler always has the latest value
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Use event-based playback state updates instead of polling
  useEffect(() => {
    function handlePlayerStateChange(state: SpotifyPlaybackState | null) {
      if (state) {
        setIsPlaying(!state.paused);
        if (!isDraggingRef.current) {
          setCurrentPosition(state.position);
        }
        if (state.track_window.current_track) {
          setDuration(state.track_window.current_track.duration_ms);
        }
      }
    }

    const unsubscribe = spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);

    // Also check initial state once
    (async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
        if (!isDraggingRef.current) {
          setCurrentPosition(state.position);
        }
        if (state.track_window.current_track) {
          setDuration(state.track_window.current_track.duration_ms);
        }
      }
    })();

    return unsubscribe;
  }, []);

  // Lightweight position poll — only to update the timeline slider smoothly.
  // The event listener above handles play/pause/track changes;
  // this just fills in sub-second position ticks during active playback.
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(async () => {
      if (isDraggingRef.current) return;
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setCurrentPosition(state.position);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      onPause();
    } else {
      const state = await spotifyPlayer.getCurrentState();
      
      if (!state || !state.track_window?.current_track || 
          (currentTrack && state.track_window.current_track.id !== currentTrack.id)) {
        onPlay();
      } else {
        if (state.paused) {
          await spotifyPlayer.resume();
        }
      }
    }
  }, [isPlaying, onPlay, onPause, currentTrack]);

  const handleSeek = useCallback(async (position: number) => {
    try {
      const token = await spotifyAuth.ensureValidToken();
      const deviceId = spotifyPlayer.getDeviceId();

      if (!deviceId) {
        console.error('No device ID available for seeking');
        return;
      }

      await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(position)}&device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }, []);

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