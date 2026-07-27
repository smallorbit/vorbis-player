import { useState, useCallback } from 'react';
import type { MediaTrack } from '@/types/domain';
import type { ProviderId } from '@/types/domain';
import { playbackStore } from '@/stores/playbackStore';
import { usePlaybackState } from '@/hooks/usePlaybackState';

interface UsePlaybackControlsProps {
  currentTrack: MediaTrack | null;
  isLiked: boolean;
  isLikePending: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onLikeToggle: () => void;
  currentTrackProvider?: ProviderId | undefined;
}

/**
 * Timeline + transport controls, reading playback state straight from the
 * playback store. Only the scrub interaction is local: while the user drags
 * the slider, the cursor follows the pointer (`scrubPositionMs` overlays the
 * store position); on release the seek is issued through the store, whose
 * seek guard keeps stale pre-seek emits from yanking the cursor back.
 */
export const usePlaybackControls = ({
  currentTrack,
  isLiked,
  isLikePending,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onLikeToggle,
  currentTrackProvider,
}: UsePlaybackControlsProps) => {
  const { isPlaying, positionMs, durationMs } = usePlaybackState();

  // Scrub-local cursor: non-null only while dragging (or during the optimistic
  // window of a keyboard/inline seek handled by handleSeekDuringScrub).
  const [scrubPositionMs, setScrubPositionMs] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const currentPosition = scrubPositionMs ?? positionMs;

  const handlePlayPause = useCallback(async () => {
    const playback = playbackStore.getDrivingDescriptor(currentTrackProvider)?.playback;
    if (!playback) return;

    if (isPlaying) {
      onPause();
    } else {
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
  }, [isPlaying, onPlay, onPause, currentTrack, currentTrackProvider]);

  const handleSeek = useCallback(async (position: number) => {
    try {
      setScrubPositionMs(null);
      await playbackStore.seek(position, currentTrackProvider);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }, [currentTrackProvider]);

  const handleSeekDuringScrub = useCallback((position: number) => {
    setScrubPositionMs(position);
  }, []);

  const handleScrubStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleScrubEnd = useCallback((position: number) => {
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
    duration: durationMs,
    isDragging,
    isLiked,
    isLikePending,
    handlePlayPause,
    handleLikeToggle: onLikeToggle,
    handleSeek,
    handleSeekDuringScrub,
    handleScrubStart,
    handleScrubEnd,
    formatTime,
    onNext,
    onPrevious,
  };
};
