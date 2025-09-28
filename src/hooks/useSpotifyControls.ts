import { useState, useEffect, useCallback } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { spotifyAuth, checkTrackSaved, saveTrack, unsaveTrack } from '../services/spotify';
import type { Track } from '../services/spotify';
import { useVolume } from './useVolume';

interface UseSpotifyControlsProps {
  currentTrack: Track | null;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const useSpotifyControls = ({
  currentTrack,
  onPlay,
  onPause,
  onNext,
  onPrevious
}: UseSpotifyControlsProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);

  // Use volume hook for volume-related functionality
  const { isMuted, volume, handleMuteToggle, handleVolumeButtonClick } = useVolume();

  useEffect(() => {
    const checkPlaybackState = async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
        if (!isDragging) {
          setCurrentPosition(state.position);
        }
        if (state.track_window.current_track) {
          setDuration(state.track_window.current_track.duration_ms);
        }
      }
    };

    const interval = setInterval(checkPlaybackState, 1000);
    return () => clearInterval(interval);
  }, [isDragging]);


  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!currentTrack?.id) {
        setIsLiked(false);
        return;
      }

      try {
        setIsLikePending(true);
        const liked = await checkTrackSaved(currentTrack.id);
        setIsLiked(liked);
      } catch (error) {
        console.error('Failed to check like status:', error);
        setIsLiked(false);
      } finally {
        setIsLikePending(false);
      }
    };

    checkLikeStatus();
  }, [currentTrack?.id]);

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


  const handleLikeToggle = useCallback(async () => {
    if (!currentTrack?.id || isLikePending) return;

    try {
      setIsLikePending(true);
      
      const newLikedState = !isLiked;
      setIsLiked(newLikedState);

      if (newLikedState) {
        await saveTrack(currentTrack.id);
      } else {
        await unsaveTrack(currentTrack.id);
      }
    } catch (error) {
      console.error('Failed to toggle like status:', error);
      setIsLiked(!isLiked);
    } finally {
      setIsLikePending(false);
    }
  }, [currentTrack?.id, isLikePending, isLiked]);

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
    handleLikeToggle,
    handleSeek,
    handleSliderChange,
    handleSliderMouseDown,
    handleSliderMouseUp,
    formatTime,
    onNext,
    onPrevious,
  };
};