import { useCallback, useRef } from 'react';
import type { ProviderDescriptor } from '@/types/providers';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { AuthExpiredError, UnavailableTrackError } from '@/providers/errors';
import { logQueue, logArtRace } from '@/lib/debugLog';
import { SKIP_ON_ERROR_DELAY_MS } from '@/constants/timing';

interface UseProviderPlaybackProps {
  setCurrentTrackIndex: (index: number) => void;
  activeDescriptor?: ProviderDescriptor | null;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  onAuthExpired?: (providerId: ProviderId) => void;
  /**
   * Shared guard ref used by `usePlaybackSubscription` to ignore stale provider
   * index updates during a transition. `playTrack` sets this to the target
   * track id BEFORE any adapter call (including the pre-warm `prepareTrack` on
   * the next track) so that provider state events emitted during the handoff
   * cannot flip `currentTrackIndex` to the wrong track.
   */
  expectedTrackIdRef?: React.MutableRefObject<string | null>;
}

export const useProviderPlayback = ({
  setCurrentTrackIndex,
  activeDescriptor,
  mediaTracksRef,
  onAuthExpired,
  expectedTrackIdRef,
}: UseProviderPlaybackProps) => {

  const currentPlaybackProviderRef = useRef<ProviderId | null>(null);

  const resolveTrackProvider = useCallback((mediaTrack?: MediaTrack): ProviderId | undefined => (
    mediaTrack?.provider
    ?? currentPlaybackProviderRef.current
    ?? activeDescriptor?.id
    ?? undefined
  ), [activeDescriptor]);

  const pausePreviousProvider = useCallback((nextProvider: ProviderId): void => {
    const previousProvider = currentPlaybackProviderRef.current;
    if (previousProvider && previousProvider !== nextProvider) {
      providerRegistry.get(previousProvider)?.playback.pause().catch(() => {});
    }
  }, []);

  const playTrack = useCallback(async (index: number, skipOnError = false, options?: { positionMs?: number }) => {
    const tracks = mediaTracksRef.current;
    const mediaTrack = tracks[index];
    const trackProvider = resolveTrackProvider(mediaTrack);

    logQueue(
      'playTrack(%d) — provider=%s, track=%s, mediaLen=%d, skipOnError=%s',
      index,
      trackProvider ?? 'NONE',
      mediaTrack ? `"${mediaTrack.name}" (${mediaTrack.id.slice(0, 8)})` : 'NO_MEDIA_TRACK',
      tracks.length,
      String(skipOnError),
    );

    if (!trackProvider) {
      console.error(`[Playback] playTrack(${index}) — no provider could be resolved`);
      return;
    }

    if (!mediaTrack) {
      if (tracks.length > 0) {
        console.warn(`[Playback] playTrack(${index}) — index out of bounds! mediaTracksRef has ${tracks.length} items`);
      }
      console.error(`[Playback] playTrack(${index}) — no track at index`);
      return;
    }

    // Raise the expected-track guard BEFORE any adapter call so that the
    // subscription layer ignores provider state events emitted during the
    // transition (pausePreviousProvider pause, adapter playTrack start, and
    // the next-track prepareTrack pre-warm below). Must run before all of
    // those to cover every entry point into playTrack — fresh collection
    // load at index 0, empty-queue append, next/previous, etc.
    if (expectedTrackIdRef) {
      expectedTrackIdRef.current = mediaTrack.id;
      logArtRace('playTrack guard set: expected=%s (idx=%d, provider=%s)',
        mediaTrack.id.slice(0, 8), index, trackProvider);
    }

    pausePreviousProvider(trackProvider);
    currentPlaybackProviderRef.current = trackProvider;

    const descriptor = providerRegistry.get(trackProvider);
    if (!descriptor) {
      console.error(`[${trackProvider}] No descriptor registered`);
      return;
    }

    // Sync the queue to the provider synchronously before playTrack so the
    // adapter sees the current track list. The persistent useEffect-based
    // onQueueChanged in usePlayerLogic only fires after React commits new
    // state — too late for the playTrack we're about to await, which would
    // otherwise hand Spotify a stale upcomingUris list (or no list at all
    // on cold start) and let the SDK auto-advance into the wrong tracks.
    descriptor.playback.onQueueChanged?.(tracks, index);

    try {
      await descriptor.playback.playTrack(mediaTrack, options);
      setCurrentTrackIndex(index);

      const nextIndex = (index + 1) % tracks.length;
      const nextTrack = tracks[nextIndex];
      if (nextTrack && nextIndex !== index) {
        const nextDescriptor = providerRegistry.get(nextTrack.provider);
        if (nextDescriptor?.playback.prepareTrack) {
          logArtRace('pre-warm dispatch: next=%s (idx=%d, provider=%s) — guard still=%s',
            nextTrack.id.slice(0, 8), nextIndex, nextTrack.provider,
            expectedTrackIdRef?.current ? expectedTrackIdRef.current.slice(0, 8) : 'null');
          nextDescriptor.playback.prepareTrack(nextTrack);
        }
      }
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        onAuthExpired?.(error.providerId as ProviderId);
        return;
      }

      if (error instanceof UnavailableTrackError) {
        console.warn(`[${trackProvider}] ${error.message}`);
        if (skipOnError && index < tracks.length - 1) {
          setTimeout(() => playTrack(index + 1, skipOnError), SKIP_ON_ERROR_DELAY_MS);
        }
        return;
      }

      console.error(`[${trackProvider}] Failed to play track:`, error);
      if (skipOnError && index < tracks.length - 1) {
        setTimeout(() => playTrack(index + 1, skipOnError), SKIP_ON_ERROR_DELAY_MS);
      }
    }
  }, [setCurrentTrackIndex, pausePreviousProvider, resolveTrackProvider, onAuthExpired, expectedTrackIdRef, mediaTracksRef]);

  const resumePlayback = useCallback(async () => {
    const currentProvider = currentPlaybackProviderRef.current;
    if (currentProvider) {
      const descriptor = providerRegistry.get(currentProvider);
      if (descriptor) {
        try {
          await descriptor.playback.resume();
        } catch (error) {
          console.error(`[${currentProvider}] Failed to resume playback:`, error);
        }
        return;
      }
    }

    if (activeDescriptor) {
      try {
        await activeDescriptor.playback.resume();
      } catch (error) {
        console.error('Failed to resume playback:', error);
      }
    }
  }, [activeDescriptor]);

  return {
    playTrack,
    resumePlayback,
    currentPlaybackProviderRef,
  };
};
