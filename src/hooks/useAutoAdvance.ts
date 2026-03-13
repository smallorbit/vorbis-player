import { useEffect, useRef } from 'react';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import { useProviderContext } from '@/contexts/ProviderContext';
import { providerRegistry } from '@/providers/registry';
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

  const { activeDescriptor, activeProviderId } = useProviderContext();

  // Keep refs up to date so the event callback always has fresh values
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentTrackIndexRef.current = currentTrackIndex; }, [currentTrackIndex]);
  useEffect(() => { playTrackRef.current = playTrack; }, [playTrack]);

  // Reset hasEnded flag when track changes
  useEffect(() => {
    hasEnded.current = false;
  }, [currentTrackIndex]);

  // Use event-based detection via provider playback subscriptions.
  // Subscribes to all registered providers to support cross-provider queues.
  useEffect(() => {
    if (!enabled || tracks.length === 0 || !activeDescriptor) {
      return;
    }

    function advanceToNext() {
      hasEnded.current = true;
      const nextIndex = (currentTrackIndexRef.current + 1) % tracksRef.current.length;
      if (tracksRef.current[nextIndex]) {
        setTimeout(() => {
          lastPlayInitiatedRef.current = Date.now();
          playTrackRef.current(nextIndex, true);
          // Don't reset hasEnded here — playTrack is async and the audio element
          // still has the old track's ended state until the new track loads.
          // The useEffect on currentTrackIndex resets hasEnded when the track
          // actually changes (after playTrack succeeds and calls setCurrentTrackIndex).
        }, 500);
      }
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
      // For cross-provider queues, check the current track's provider to determine
      // which cooldown source to use.
      const currentTrack = tracksRef.current[currentTrackIndexRef.current];
      const currentTrackProvider = currentTrack?.provider ?? activeProviderId;
      let msSinceLastPlay: number;
      if (currentTrackProvider === 'spotify') {
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

    // Subscribe to active provider
    unsubscribes.push(activeDescriptor.playback.subscribe(handleProviderStateChange));

    // Subscribe to other providers for cross-provider queue support
    for (const descriptor of providerRegistry.getAll()) {
      if (descriptor.id !== activeDescriptor.id) {
        unsubscribes.push(descriptor.playback.subscribe((state) => {
          // Only process events when a track from this provider is currently playing
          const currentTrack = tracksRef.current[currentTrackIndexRef.current];
          if (currentTrack?.provider === descriptor.id) {
            handleProviderStateChange(state);
          }
        }));
      }
    }

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [enabled, tracks.length, endThreshold, activeDescriptor, activeProviderId]);
};
