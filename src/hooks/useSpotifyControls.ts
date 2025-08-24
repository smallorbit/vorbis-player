import { useState, useEffect, useCallback } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { spotifyAuth, checkTrackSaved, saveTrack, unsaveTrack } from '../services/spotify';
import { unifiedPlayer } from '../services/unifiedPlayer';
import type { Track } from '../services/spotify';

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
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [previousVolume, setPreviousVolume] = useState(50);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);

  useEffect(() => {
    const checkPlaybackState = async () => {
      // Skip Spotify API calls for local tracks
      if (currentTrack && (currentTrack as any).source === 'local') {
        return;
      }

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
  }, [isDragging, currentTrack]);

  // Listen to unified player events for local tracks
  useEffect(() => {
    if (!currentTrack || (currentTrack as any).source !== 'local') {
      return;
    }

    const handlePlaybackStarted = ({ track }: { track: any }) => {
      console.log('🎵 Local playback started:', { trackName: track?.name });
      setIsPlaying(true);
    };

    const handlePlaybackPaused = ({ track }: { track: any }) => {
      console.log('🎵 Local playback paused:', { trackName: track?.name });
      setIsPlaying(false);
    };

    const handlePlaybackStopped = ({ track }: { track: any }) => {
      console.log('🎵 Local playback stopped:', { trackName: track?.name });
      setIsPlaying(false);
    };

    const handleSeeked = ({ position }: { position: number }) => {
      if (!isDragging) {
        setCurrentPosition(position);
      }
    };

    const handleDurationChanged = ({ duration }: { duration: number }) => {
      setDuration(duration);
    };

    // Subscribe to unified player events
    unifiedPlayer.on('playbackStarted', handlePlaybackStarted);
    unifiedPlayer.on('playbackPaused', handlePlaybackPaused);
    unifiedPlayer.on('playbackStopped', handlePlaybackStopped);
    unifiedPlayer.on('seeked', handleSeeked);
    unifiedPlayer.on('durationChanged', handleDurationChanged);

    return () => {
      // Cleanup event listeners
      unifiedPlayer.off('playbackStarted', handlePlaybackStarted);
      unifiedPlayer.off('playbackPaused', handlePlaybackPaused);
      unifiedPlayer.off('playbackStopped', handlePlaybackStopped);
      unifiedPlayer.off('seeked', handleSeeked);
      unifiedPlayer.off('durationChanged', handleDurationChanged);
    };
  }, [currentTrack, isDragging]);

  useEffect(() => {
    spotifyPlayer.setVolume(0.5);
    setVolume(50);
    setPreviousVolume(50);
  }, []);

  useEffect(() => {
    const checkLikeStatus = async () => {
      if (!currentTrack?.id) {
        setIsLiked(false);
        return;
      }

      // Skip Spotify API calls for local tracks
      console.log('🔍 Checking track source:', { 
        trackId: currentTrack.id, 
        source: (currentTrack as any).source,
        isLocal: (currentTrack as any).source === 'local'
      });
      
      if ((currentTrack as any).source === 'local') {
        console.log('🎵 Skipping Spotify API for local track');
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
    // For local tracks, just call the appropriate callback
    if (currentTrack && (currentTrack as any).source === 'local') {
      if (isPlaying) {
        onPause();
      } else {
        onPlay();
      }
      return;
    }

    // For Spotify tracks, use the existing logic
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

  const handleMuteToggle = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (newMutedState) {
      setPreviousVolume(volume);
      if (currentTrack && (currentTrack as any).source === 'local') {
        unifiedPlayer.setVolume(0);
      } else {
        spotifyPlayer.setVolume(0);
      }
    } else {
      const volumeToRestore = previousVolume > 0 ? previousVolume : 50;
      setVolume(volumeToRestore);
      if (currentTrack && (currentTrack as any).source === 'local') {
        unifiedPlayer.setVolume(volumeToRestore / 100);
      } else {
        spotifyPlayer.setVolume(volumeToRestore / 100);
      }
    }
  }, [isMuted, volume, previousVolume, currentTrack]);

  const handleVolumeButtonClick = useCallback(() => {
    handleMuteToggle();
  }, [handleMuteToggle]);

  const handleLikeToggle = useCallback(async () => {
    if (!currentTrack?.id || isLikePending) return;

    // Skip Spotify API calls for local tracks
    if ((currentTrack as any).source === 'local') {
      return;
    }

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
    // For local tracks, use unified player
    if (currentTrack && (currentTrack as any).source === 'local') {
      unifiedPlayer.seek(position);
      return;
    }

    // For Spotify tracks, use the existing logic
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
  }, [currentTrack]);

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

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (currentTrack && (currentTrack as any).source === 'local') {
      unifiedPlayer.setVolume(newVolume / 100);
    } else {
      spotifyPlayer.setVolume(newVolume / 100);
    }
  }, [currentTrack]);

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
    handleVolumeChange,
    formatTime,
    onNext,
    onPrevious,
  };
};