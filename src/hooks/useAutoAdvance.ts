import { useEffect, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';

interface UseAutoAdvanceProps {
  tracks: Track[];
  currentTrackIndex: number;
  playTrack: (index: number, skipOnError?: boolean) => void;
  enabled?: boolean;
  endThreshold?: number;
}

const PLAY_COOLDOWN_MS = 5000;

export const useAutoAdvance = ({
  tracks,
  currentTrackIndex,
  playTrack,
  enabled = true,
  endThreshold = 2000
}: UseAutoAdvanceProps) => {
  const hasEnded = useRef(false);
  const wasPlayingRef = useRef(false);
  const tracksRef = useRef(tracks);
  const currentTrackIndexRef = useRef(currentTrackIndex);
  const playTrackRef = useRef(playTrack);

  // Keep refs up to date so the event callback always has fresh values
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentTrackIndexRef.current = currentTrackIndex; }, [currentTrackIndex]);
  useEffect(() => { playTrackRef.current = playTrack; }, [playTrack]);

  // Reset hasEnded flag when track changes
  useEffect(() => {
    hasEnded.current = false;
  }, [currentTrackIndex]);

  // Use event-based detection instead of polling
  useEffect(() => {
    if (!enabled || tracks.length === 0) {
      return;
    }

    function advanceToNext() {
      hasEnded.current = true;
      const nextIndex = (currentTrackIndexRef.current + 1) % tracksRef.current.length;
      if (tracksRef.current[nextIndex]) {
        setTimeout(() => {
          playTrackRef.current(nextIndex, true);
          hasEnded.current = false;
        }, 500);
      }
    }

    function handleStateChange(state: SpotifyPlaybackState | null) {
      if (!state || !state.track_window.current_track || tracksRef.current.length === 0) {
        return;
      }

      const duration = state.track_window.current_track.duration_ms;
      const position = state.position;
      const timeRemaining = duration - position;
      const isPaused = state.paused;

      // Detect near-end of track while still playing
      if (!hasEnded.current && duration > 0 && position > 0 && (
        timeRemaining <= endThreshold ||
        position >= duration - 1000
      )) {
        advanceToNext();
      }

      // Detect track naturally finished: was playing, now paused at position 0.
      // Guard: skip if a track was recently loaded — mobile Spotify SDK briefly
      // pauses at position 0 during buffering, which would falsely trigger advance.
      const msSinceLastPlay = Date.now() - spotifyPlayer.lastPlayTrackTime;
      if (!hasEnded.current && wasPlayingRef.current && isPaused && position === 0 && duration > 0 && msSinceLastPlay > PLAY_COOLDOWN_MS) {
        advanceToNext();
      }

      wasPlayingRef.current = !isPaused;
    }

    const unsubscribe = spotifyPlayer.onPlayerStateChanged(handleStateChange);

    return unsubscribe;
  }, [enabled, tracks.length, endThreshold]);
};
