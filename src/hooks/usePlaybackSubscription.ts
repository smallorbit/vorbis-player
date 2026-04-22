import { useEffect } from 'react';
import type { PlaybackState, ProviderId, MediaTrack } from '@/types/domain';
import type { PlaybackProvider } from '@/types/providers';
import { providerRegistry } from '@/providers/registry';
import { logQueue, logArtRace } from '@/lib/debugLog';

interface UsePlaybackSubscriptionProps {
  activeDescriptor: { id: ProviderId; playback: PlaybackProvider } | undefined;
  drivingProviderRef: React.MutableRefObject<ProviderId | null>;
  tracksRef: React.MutableRefObject<MediaTrack[]>;
  currentTrackIndexRef: React.MutableRefObject<number>;
  expectedTrackIdRef: React.MutableRefObject<string | null>;
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackPosition: (position: number) => void;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  setTracks: (tracks: MediaTrack[] | ((prev: MediaTrack[]) => MediaTrack[])) => void;
}

export function usePlaybackSubscription({
  activeDescriptor,
  drivingProviderRef,
  tracksRef,
  currentTrackIndexRef,
  expectedTrackIdRef,
  setIsPlaying,
  setPlaybackPosition,
  setCurrentTrackIndex,
  setTracks,
}: UsePlaybackSubscriptionProps): void {
  useEffect(() => {
    const playback = activeDescriptor?.playback;
    if (!playback) return;
    const activeProviderId = activeDescriptor.id;

    function handleProviderStateChange(providerId: ProviderId, state: PlaybackState | null) {
      const drivingProviderId = drivingProviderRef.current ?? activeProviderId;
      if (providerId !== drivingProviderId) {
        return;
      }

      if (state) {
        setIsPlaying(state.isPlaying);
        setPlaybackPosition(state.positionMs);

        if (state.currentTrackId) {
          const trackId = state.currentTrackId;
          const currentTracks = tracksRef.current;
          const trackIndex = currentTracks.findIndex((t: MediaTrack) => t.id === trackId);
          const expected = expectedTrackIdRef.current;
          if (expected !== null) {
            if (trackId === expected) {
              logArtRace('subscription: expected arrived → guard cleared (id=%s, idx=%d)',
                trackId.slice(0, 8), trackIndex);
              logQueue('Provider state — expected track arrived: %s', trackId.slice(0, 8));
              expectedTrackIdRef.current = null;
            } else {
              logArtRace('subscription: REJECT (id=%s, expected=%s, wouldFlipTo=%d, currentIdx=%d)',
                trackId.slice(0, 8), expected.slice(0, 8), trackIndex, currentTrackIndexRef.current);
            }
            // while waiting for the expected track, ignore provider index updates
          } else if (trackIndex !== -1 && trackIndex !== currentTrackIndexRef.current) {
            logArtRace('subscription: FALLBACK-ACCEPT flip %d → %d (id=%s, guard=null)',
              currentTrackIndexRef.current, trackIndex, trackId.slice(0, 8));
            logQueue(
              'Provider state — index sync: %d → %d (trackId=%s, queueLen=%d)',
              currentTrackIndexRef.current,
              trackIndex,
              trackId.slice(0, 8),
              currentTracks.length,
            );
            setCurrentTrackIndex(trackIndex);
          } else {
            logArtRace('subscription: NOOP (id=%s, idx=%d, currentIdx=%d, guard=null)',
              trackId.slice(0, 8), trackIndex, currentTrackIndexRef.current);
          }

          if (state.trackMetadata && trackIndex !== -1) {
            const meta = state.trackMetadata;
            const updates: Partial<MediaTrack> = {};
            if (meta.name !== undefined) updates.name = meta.name;
            if (meta.artists !== undefined) updates.artists = meta.artists;
            if (meta.album !== undefined) updates.album = meta.album;
            if (meta.image !== undefined) updates.image = meta.image;
            if (meta.durationMs !== undefined) updates.durationMs = meta.durationMs;

            if (Object.keys(updates).length > 0) {
              setTracks((prev: MediaTrack[]) =>
                prev.map((t, i) =>
                  i === trackIndex ? { ...t, ...updates } : t
                )
              );
            }
          }
        }
      } else {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }

    const unsubscribes: (() => void)[] = [];

    // Subscribe to the active provider
    unsubscribes.push(
      playback.subscribe((state: PlaybackState | null) => handleProviderStateChange(activeProviderId, state))
    );

    // Also subscribe to other registered providers for cross-provider queue support.
    // Only process events when that provider is the one currently playing.
    for (const descriptor of providerRegistry.getAll()) {
      if (descriptor.id !== activeProviderId) {
        const otherUnsubscribe = descriptor.playback.subscribe((state: PlaybackState | null) => {
          handleProviderStateChange(descriptor.id, state);
        });
        unsubscribes.push(otherUnsubscribe);
      }
    }

    // Check initial state for whichever provider is currently driving playback.
    const stateProviderId = drivingProviderRef.current ?? activeProviderId;
    const stateDescriptor = providerRegistry.get(stateProviderId);
    stateDescriptor?.playback.getState().then((state) => {
      if (state) {
        setIsPlaying(state.isPlaying);
        setPlaybackPosition(state.positionMs);
      }
    });

    function handleVisibilityChange() {
      if (document.hidden) return;
      expectedTrackIdRef.current = null;
      const resyncProviderId = drivingProviderRef.current ?? activeProviderId;
      const resyncDescriptor = providerRegistry.get(resyncProviderId);
      resyncDescriptor?.playback.getState().then((state) => {
        if (state) {
          handleProviderStateChange(resyncProviderId, state);
        }
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // Intentionally omit `tracks` and `currentTrackIndex` from deps — we read
  // them via refs so the subscription is only recreated when the active
  // provider changes, not on every track transition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDescriptor, setCurrentTrackIndex, setTracks]);
}
