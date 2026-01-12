import { useEffect, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';

interface UseAutoAdvanceProps {
  tracks: Track[];
  currentTrackIndex: number;
  playTrack: (index: number, skipOnError?: boolean) => void;
  enabled?: boolean;
  pollInterval?: number;
  endThreshold?: number;
}

/**
 * Auto-advance hook - automatically plays the next track in the queue when the current track ends.
 */
export const useAutoAdvance = ({
  tracks,
  currentTrackIndex,
  playTrack,
  enabled = true,
  pollInterval = 2000,
  endThreshold = 2000
}: UseAutoAdvanceProps) => {
  const pollIntervalRef = useRef<number>();
  const hasEnded = useRef(false);

  useEffect(() => {
    if (!enabled || tracks.length === 0) {
      return;
    }

    const checkForSongEnd = async () => {
      try {
        const state = await spotifyPlayer.getCurrentState();
        if (state && state.track_window.current_track && tracks.length > 0) {
          const currentTrack = state.track_window.current_track;
          const duration = currentTrack.duration_ms;
          const position = state.position;
          const timeRemaining = duration - position;

          if (!hasEnded.current && duration > 0 && position > 0 && (
            timeRemaining <= endThreshold ||
            position >= duration - 1000
          )) {
            hasEnded.current = true;

            setTimeout(() => {
              // Advance to next track in queue
              const nextIndex = (currentTrackIndex + 1) % tracks.length;
              if (tracks[nextIndex]) {
                playTrack(nextIndex, true); // Enable auto-skip for unavailable tracks
              }
              hasEnded.current = false;
            }, 500);
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Reset hasEnded flag when track changes
    hasEnded.current = false;

    pollIntervalRef.current = setInterval(checkForSongEnd, pollInterval) as unknown as number;

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [tracks, currentTrackIndex, playTrack, enabled, pollInterval, endThreshold]);
};