import { useEffect, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import { useProviderContext } from '@/contexts/ProviderContext';
import type { PlaybackState } from '@/types/domain';

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
  /** Tracks when advanceToNext last initiated playback (used as cooldown for non-Spotify). */
  const lastPlayInitiatedRef = useRef(0);
  /** ID for cancelling pending advance timeouts (e.g. when shuffle is toggled). */
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { activeDescriptor, activeProviderId } = useProviderContext();

  // Keep refs up to date so the event callback always has fresh values
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentTrackIndexRef.current = currentTrackIndex; }, [currentTrackIndex]);
  useEffect(() => { playTrackRef.current = playTrack; }, [playTrack]);

  // Reset hasEnded flag and cancel pending advance when track changes
  // (includes shuffle toggle which changes currentTrackIndex).
  useEffect(() => {
    hasEnded.current = false;
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, [currentTrackIndex]);

  // Also cancel pending advance when the tracks array changes (e.g. shuffle toggle)
  // to prevent a stale-index timeout from playing the wrong track.
  useEffect(() => {
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, [tracks]);

  // Use event-based detection via the provider's playback subscribe
  useEffect(() => {
    if (!enabled || tracks.length === 0 || !activeDescriptor) {
      return;
    }

    function advanceToNext() {
      hasEnded.current = true;
      // Compute nextIndex inside the timeout callback (not here) so that
      // if shuffle is toggled during the delay, we use the latest refs.
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        const nextIndex = (currentTrackIndexRef.current + 1) % tracksRef.current.length;
        if (tracksRef.current[nextIndex]) {
          lastPlayInitiatedRef.current = Date.now();
          playTrackRef.current(nextIndex, true);
          // Don't reset hasEnded here — playTrack is async and the audio element
          // still has the old track's ended state until the new track loads.
          // The useEffect on currentTrackIndex resets hasEnded when the track
          // actually changes (after playTrack succeeds and calls setCurrentTrackIndex).
        }
      }, 500);
    }

    function handleProviderStateChange(state: PlaybackState | null) {
      if (!state || !state.currentTrackId || tracksRef.current.length === 0) {
        return;
      }

      const duration = state.durationMs;
      const position = state.positionMs;
      const timeRemaining = duration - position;
      const isPaused = !state.isPlaying;

      // Detect near-end of track while still playing
      if (!hasEnded.current && duration > 0 && position > 0 && (
        timeRemaining <= endThreshold ||
        position >= duration - 1000
      )) {
        advanceToNext();
      }

      // Detect track naturally finished: was playing, now paused at position 0.
      // Guard: skip if a track was recently loaded — both Spotify SDK and HTML5
      // Audio briefly pause at position 0 during buffering, which would falsely
      // trigger advance.
      let msSinceLastPlay: number;
      if (activeProviderId === 'spotify') {
        msSinceLastPlay = Date.now() - spotifyPlayer.lastPlayTrackTime;
      } else {
        msSinceLastPlay = Date.now() - lastPlayInitiatedRef.current;
      }

      if (!hasEnded.current && wasPlayingRef.current && isPaused && position === 0 && duration > 0 && msSinceLastPlay > PLAY_COOLDOWN_MS) {
        advanceToNext();
      }

      wasPlayingRef.current = !isPaused;
    }

    const unsubscribe = activeDescriptor.playback.subscribe(handleProviderStateChange);

    return unsubscribe;
  }, [enabled, tracks.length, endThreshold, activeDescriptor, activeProviderId]);
};
