import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import type { Track } from '../services/spotify';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import type { PlaybackState, ProviderId } from '@/types/domain';

interface UseSpotifyControlsProps {
  currentTrack: Track | null;
  isLiked: boolean;
  isLikePending: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onLikeToggle: () => void;
  currentTrackProvider?: ProviderId;
}

interface PlaybackTimingState {
  isPlaying: boolean;
  currentPosition: number;
  duration: number;
}

type PlaybackTimingAction =
  | { type: 'update'; isPlaying: boolean; positionMs: number; durationMs?: number }
  | { type: 'update_no_position'; isPlaying: boolean; durationMs?: number }
  | { type: 'position'; positionMs: number };

function playbackTimingReducer(state: PlaybackTimingState, action: PlaybackTimingAction): PlaybackTimingState {
  switch (action.type) {
    case 'update':
      return {
        isPlaying: action.isPlaying,
        currentPosition: action.positionMs,
        duration: action.durationMs ?? state.duration,
      };
    case 'update_no_position':
      return {
        ...state,
        isPlaying: action.isPlaying,
        duration: action.durationMs ?? state.duration,
      };
    case 'position':
      return { ...state, currentPosition: action.positionMs };
  }
}

export const useSpotifyControls = ({
  currentTrack,
  isLiked,
  isLikePending,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onLikeToggle,
  currentTrackProvider,
}: UseSpotifyControlsProps) => {
  const [{ isPlaying, currentPosition, duration }, dispatchTiming] = useReducer(
    playbackTimingReducer,
    { isPlaying: false, currentPosition: 0, duration: 0 }
  );
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const { activeDescriptor } = useProviderContext();

  // Keep ref in sync so the event handler always has the latest value
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // Use event-based playback state updates via the provider adapter.
  // In Vorbis mode the active descriptor may be Dropbox while a Spotify track is
  // actually playing, so we subscribe to whichever adapter owns the current track.
  useEffect(() => {
    const playingDescriptor =
      currentTrackProvider && currentTrackProvider !== activeDescriptor?.id
        ? providerRegistry.get(currentTrackProvider)
        : activeDescriptor;
    const playback = playingDescriptor?.playback;
    if (!playback) return;

    function handleProviderStateChange(state: PlaybackState | null) {
      if (!state) return;
      if (isDraggingRef.current) {
        dispatchTiming({ type: 'update_no_position', isPlaying: state.isPlaying, durationMs: state.durationMs });
      } else {
        dispatchTiming({ type: 'update', isPlaying: state.isPlaying, positionMs: state.positionMs, durationMs: state.durationMs });
      }
    }

    const unsubscribe = playback.subscribe(handleProviderStateChange);

    // Also check initial state once
    playback.getState().then((state) => {
      if (state) {
        dispatchTiming({ type: 'update', isPlaying: state.isPlaying, positionMs: state.positionMs, durationMs: state.durationMs });
      }
    });

    return unsubscribe;
  }, [activeDescriptor, currentTrackProvider]);

  // Lightweight position poll — only to update the timeline slider smoothly.
  // Poll the adapter that is actually playing, which may differ from the active
  // descriptor in cross-provider (Vorbis) queues.
  useEffect(() => {
    if (!isPlaying) return;
    const playingDescriptor =
      currentTrackProvider && currentTrackProvider !== activeDescriptor?.id
        ? providerRegistry.get(currentTrackProvider)
        : activeDescriptor;
    const playback = playingDescriptor?.playback;
    if (!playback) return;

    const interval = setInterval(async () => {
      if (isDraggingRef.current) return;
      const state = await playback.getState();
      if (state) {
        dispatchTiming({ type: 'position', positionMs: state.positionMs });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, activeDescriptor, currentTrackProvider]);

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
      const playingDescriptor =
        currentTrackProvider && currentTrackProvider !== activeDescriptor?.id
          ? providerRegistry.get(currentTrackProvider)
          : activeDescriptor;
      const playback = playingDescriptor?.playback;
      if (!playback) return;
      await playback.seek(position);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }, [activeDescriptor, currentTrackProvider]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const position = parseInt(e.target.value);
    dispatchTiming({ type: 'position', positionMs: position });
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
    currentPosition,
    duration,
    isDragging,
    isLiked,
    isLikePending,
    handlePlayPause,
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
