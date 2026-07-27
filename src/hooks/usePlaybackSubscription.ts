import { useEffect } from 'react';
import type { PlaybackState, ProviderId, MediaTrack } from '@/types/domain';
import type { PlaybackProvider } from '@/types/providers';
import { providerRegistry } from '@/providers/registry';
import { queueStore } from '@/stores/queueStore';
import { logQueue, logArtRace } from '@/lib/debugLog';

interface UsePlaybackSubscriptionProps {
  activeDescriptor: { id: ProviderId; playback: PlaybackProvider } | undefined;
  drivingProviderRef: React.MutableRefObject<ProviderId | null>;
  expectedTrackIdRef: React.MutableRefObject<string | null>;
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackPosition: (position: number) => void;
}

export function usePlaybackSubscription({
  activeDescriptor,
  drivingProviderRef,
  expectedTrackIdRef,
  setIsPlaying,
  setPlaybackPosition,
}: UsePlaybackSubscriptionProps): void {
  useEffect(() => {
    const playback = activeDescriptor?.playback;
    if (!playback) return;
    const activeProviderId = activeDescriptor.id;

    // The initial and visibilitychange getState() calls are async and outlive
    // this effect if the active provider switches or the component unmounts
    // mid-flight. Cleanup flips this so a superseded getState cannot write the
    // previous provider's playback state into a torn-down subscription.
    let cancelled = false;

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
          const currentTracks = queueStore.getTracks();
          const currentIndex = queueStore.getCurrentIndex();
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
                trackId.slice(0, 8), expected.slice(0, 8), trackIndex, currentIndex);
            }
            // while waiting for the expected track, ignore provider index updates
          } else if (trackIndex !== -1 && trackIndex !== currentIndex) {
            logArtRace('subscription: FALLBACK-ACCEPT flip %d → %d (id=%s, guard=null)',
              currentIndex, trackIndex, trackId.slice(0, 8));
            logQueue(
              'Provider state — index sync: %d → %d (trackId=%s, queueLen=%d)',
              currentIndex,
              trackIndex,
              trackId.slice(0, 8),
              currentTracks.length,
            );
            queueStore.setCurrentIndex(trackIndex);
          } else {
            logArtRace('subscription: NOOP (id=%s, idx=%d, currentIdx=%d, guard=null)',
              trackId.slice(0, 8), trackIndex, currentIndex);
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
              queueStore.mapTracks((t, i) => (i === trackIndex ? { ...t, ...updates } : t));
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
      if (cancelled) return;
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
        if (cancelled) return;
        if (state) {
          handleProviderStateChange(resyncProviderId, state);
        }
      });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      unsubscribes.forEach((unsub) => unsub());
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // Queue state is read from queueStore at event time, so the subscription is
  // only recreated when the active provider changes, not on track transitions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDescriptor, setIsPlaying, setPlaybackPosition]);
}
