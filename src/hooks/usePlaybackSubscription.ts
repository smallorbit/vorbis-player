import { useEffect } from 'react';
import type { Track } from '@/services/spotify';
import type { PlaybackState, ProviderId } from '@/types/domain';
import type { MediaTrack } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { logQueue } from '@/lib/debugLog';

interface UsePlaybackSubscriptionProps {
  activeDescriptor: any;
  drivingProviderRef: React.MutableRefObject<ProviderId | null>;
  tracksRef: React.MutableRefObject<Track[]>;
  currentTrackIndexRef: React.MutableRefObject<number>;
  expectedTrackIdRef: React.MutableRefObject<string | null>;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackPosition: (position: number) => void;
  setCurrentTrackIndex: (index: number | ((prev: number) => number)) => void;
  setTracks: (tracks: Track[] | ((prev: Track[]) => Track[])) => void;
}

export function usePlaybackSubscription({
  activeDescriptor,
  drivingProviderRef,
  tracksRef,
  currentTrackIndexRef,
  expectedTrackIdRef,
  mediaTracksRef,
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
          const trackIndex = currentTracks.findIndex((t: Track) => t.id === trackId);
          if (expectedTrackIdRef.current !== null) {
            if (trackId === expectedTrackIdRef.current) {
              logQueue('Provider state — expected track arrived: %s', trackId.slice(0, 8));
              expectedTrackIdRef.current = null;
            }
            // while waiting for the expected track, ignore provider index updates
          } else if (trackIndex !== -1 && trackIndex !== currentTrackIndexRef.current) {
            logQueue(
              'Provider state — index sync: %d → %d (trackId=%s, queueLen=%d)',
              currentTrackIndexRef.current,
              trackIndex,
              trackId.slice(0, 8),
              currentTracks.length,
            );
            setCurrentTrackIndex(trackIndex);
          }

          if (state.trackMetadata && trackIndex !== -1) {
            const meta = state.trackMetadata;
            if (meta.name !== undefined || meta.artists !== undefined || meta.album !== undefined || meta.image !== undefined || meta.durationMs !== undefined) {
              setTracks((prev: Track[]) =>
                prev.map((t, i) =>
                  i === trackIndex
                    ? {
                        ...t,
                        ...(meta.name !== undefined && { name: meta.name }),
                        ...(meta.artists !== undefined && { artists: meta.artists }),
                        ...(meta.album !== undefined && { album: meta.album }),
                        ...(meta.image !== undefined && { image: meta.image }),
                        ...(meta.durationMs !== undefined && { duration_ms: meta.durationMs }),
                      }
                    : t
                )
              );
              const mediaIdx = mediaTracksRef.current.findIndex((m) => m.id === trackId);
              if (mediaIdx !== -1) {
                mediaTracksRef.current[mediaIdx] = { ...mediaTracksRef.current[mediaIdx], ...meta };
              }
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
      playback.subscribe((state) => handleProviderStateChange(activeProviderId, state))
    );

    // Also subscribe to other registered providers for cross-provider queue support.
    // Only process events when that provider is the one currently playing.
    for (const descriptor of providerRegistry.getAll()) {
      if (descriptor.id !== activeProviderId) {
        const otherUnsubscribe = descriptor.playback.subscribe((state) => {
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

    return () => unsubscribes.forEach((unsub) => unsub());
  // Intentionally omit `tracks` and `currentTrackIndex` from deps — we read
  // them via refs so the subscription is only recreated when the active
  // provider changes, not on every track transition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDescriptor, setCurrentTrackIndex, setTracks]);
}
