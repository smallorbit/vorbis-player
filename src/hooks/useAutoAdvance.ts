import { useEffect, useRef } from 'react';
import { logQueue } from '@/lib/debugLog';
import type { MediaTrack } from '@/types/domain';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
import type { PlaybackState, ProviderId } from '@/types/domain';

interface UseAutoAdvanceProps {
  tracks: MediaTrack[];
  currentTrackIndex: number;
  playTrack: (index: number, skipOnError?: boolean) => void;
  enabled?: boolean;
  endThreshold?: number;
  /** Ref tracking driving provider; active provider may differ during mixed/cross-provider queues. */
  currentPlaybackProviderRef?: React.RefObject<ProviderId | null>;
}

const PLAY_COOLDOWN_MS = 5000;

export const useAutoAdvance = ({
  tracks,
  currentTrackIndex,
  playTrack,
  enabled = true,
  endThreshold = 2000,
  currentPlaybackProviderRef: drivingProviderRef,
}: UseAutoAdvanceProps) => {
  const hasEnded = useRef(false);
  const wasPlayingRef = useRef(false);
  const tracksRef = useRef(tracks);
  const currentTrackIndexRef = useRef(currentTrackIndex);
  const playTrackRef = useRef(playTrack);
  /** Tracks when advanceToNext last initiated playback (fallback cooldown). */
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
  // Terminology:
  // - active provider: selected provider context
  // - driving provider: provider currently emitting playback state
  // Subscribe to ALL registered providers (like usePlayerLogic does) so that
  // cross-provider transitions in unified playlists are detected even before
  // activeDescriptor updates via async React state.
  useEffect(() => {
    if (!enabled || tracks.length === 0 || !activeDescriptor) {
      return;
    }

    function advanceToNext() {
      hasEnded.current = true;
      logQueue('autoAdvance — track ended, scheduling advance from index=%d', currentTrackIndexRef.current);
      // Compute nextIndex inside the timeout callback (not here) so that
      // if shuffle is toggled during the delay, we use the latest refs.
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        const currentIdx = currentTrackIndexRef.current;
        const totalTracks = tracksRef.current.length;
        // Stop at the end of the queue instead of wrapping around
        if (currentIdx >= totalTracks - 1) {
          logQueue('autoAdvance — at end of queue (%d/%d), stopping', currentIdx, totalTracks);
          return;
        }
        const nextIndex = currentIdx + 1;
        if (tracksRef.current[nextIndex]) {
          logQueue('autoAdvance — advancing %d → %d, track="%s"', currentIdx, nextIndex, tracksRef.current[nextIndex].name);
          lastPlayInitiatedRef.current = Date.now();
          playTrackRef.current(nextIndex, true);
          // Don't reset hasEnded here — playTrack is async and the audio element
          // still has the old track's ended state until the new track loads.
          // The useEffect on currentTrackIndex resets hasEnded when the track
          // actually changes (after playTrack succeeds and calls setCurrentTrackIndex).
        }
      }, 100);
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
        logQueue('autoAdvance — near-end detected: pos=%d, dur=%d, remaining=%dms', position, duration, timeRemaining);
        advanceToNext();
      }

      // Detect track naturally finished: was playing, now paused at position 0.
      // Guard: skip if a track was recently loaded — both Spotify SDK and HTML5
      // Audio briefly pause at position 0 during buffering, which would falsely
      // trigger advance.
      const effectiveProviderId = drivingProviderRef?.current ?? activeProviderId;
      const drivingDescriptor = effectiveProviderId ? providerRegistry.get(effectiveProviderId) : null;
      const lastPlayTime = drivingDescriptor?.playback.getLastPlayTime?.() ?? lastPlayInitiatedRef.current;
      const msSinceLastPlay = Date.now() - lastPlayTime;

      if (!hasEnded.current && wasPlayingRef.current && isPaused && position === 0 && duration > 0 && msSinceLastPlay > PLAY_COOLDOWN_MS) {
        logQueue('autoAdvance — track finished (paused@0): dur=%d, cooldown=%dms', duration, msSinceLastPlay);
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
          if (drivingProviderRef?.current === descriptor.id) {
            handleProviderStateChange(state);
          }
        });
        unsubscribes.push(otherUnsubscribe);
      }
    }

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [enabled, tracks.length, endThreshold, activeDescriptor, activeProviderId]);
};
