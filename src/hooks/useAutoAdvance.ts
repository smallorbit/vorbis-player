import { useEffect, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import type { PlaybackState, ProviderId } from '@/types/domain';

interface UseAutoAdvanceProps {
  tracks: Track[];
  currentTrackIndex: number;
  playTrack: (index: number, skipOnError?: boolean) => void;
  enabled?: boolean;
  endThreshold?: number;
  /** Ref tracking which provider is currently handling playback (may differ from activeDescriptor). */
  currentPlaybackProviderRef?: React.RefObject<ProviderId | null>;
}

const PLAY_COOLDOWN_MS = 5000;

export const useAutoAdvance = ({
  tracks,
  currentTrackIndex,
  playTrack,
  enabled = true,
  endThreshold = 2000,
  currentPlaybackProviderRef,
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

  // Use event-based detection via provider playback subscriptions.
  // Subscribe to ALL registered providers (like usePlayerLogic does) so that
  // cross-provider transitions in unified playlists are detected even before
  // activeDescriptor updates via async React state.
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
      const currentProvider = currentPlaybackProviderRef?.current;
      let msSinceLastPlay: number;
      if (currentProvider === 'spotify' || (!currentProvider && activeProviderId === 'spotify')) {
        msSinceLastPlay = Date.now() - spotifyPlayer.lastPlayTrackTime;
      } else {
        msSinceLastPlay = Date.now() - lastPlayInitiatedRef.current;
      }

      if (!hasEnded.current && wasPlayingRef.current && isPaused && position === 0 && duration > 0 && msSinceLastPlay > PLAY_COOLDOWN_MS) {
        advanceToNext();
      }

      wasPlayingRef.current = !isPaused;
    }

    const unsubscribes: (() => void)[] = [];

    // Subscribe to the active provider
    unsubscribes.push(activeDescriptor.playback.subscribe(handleProviderStateChange));

    // Also subscribe to other registered providers for cross-provider queue support.
    // Only process events when that provider is the one currently playing.
    for (const descriptor of providerRegistry.getAll()) {
      if (descriptor.id !== activeDescriptor.id) {
        const otherUnsubscribe = descriptor.playback.subscribe((state) => {
          if (currentPlaybackProviderRef?.current === descriptor.id) {
            handleProviderStateChange(state);
          }
        });
        unsubscribes.push(otherUnsubscribe);
      }
    }

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [enabled, tracks.length, endThreshold, activeDescriptor, activeProviderId]);
};
