import { useEffect, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';

interface UseAutoAdvanceProps {
  tracks: Track[];
  currentTrackIndex: number;
  playTrack: (index: number) => void;
  enabled?: boolean;
  pollInterval?: number;
  endThreshold?: number;
}

/**
 * Auto-advance hook - automatically plays the next track in the queue when the current track ends.
 */
export function useAutoAdvance({
  tracks,
  currentTrackIndex,
  playTrack,
  enabled = true,
  pollInterval = 2000,
  endThreshold = 2000
}: UseAutoAdvanceProps): void {
  const pollIntervalRef = useRef<number>();
  const hasEnded = useRef(false);

  useEffect(() => {
    if (!enabled || tracks.length === 0) {
      return;
    }

    hasEnded.current = false;

    const checkForSongEnd = async (): Promise<void> => {
      try {
        const state = await spotifyPlayer.getCurrentState();
        if (!state?.track_window.current_track) {
          return;
        }

        const currentTrack = state.track_window.current_track;
        const duration = currentTrack.duration_ms;
        const position = state.position;
        const timeRemaining = duration - position;

        if (hasEnded.current || duration <= 0 || position <= 0) {
          return;
        }

        if (timeRemaining <= endThreshold || position >= duration - 1000) {
          hasEnded.current = true;

          setTimeout(() => {
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            if (tracks[nextIndex]) {
              playTrack(nextIndex);
            }
            hasEnded.current = false;
          }, 500);
        }
      } catch {
        // Ignore polling errors
      }
    };

    pollIntervalRef.current = setInterval(checkForSongEnd, pollInterval) as unknown as number;

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [tracks, currentTrackIndex, playTrack, enabled, pollInterval, endThreshold]);
}