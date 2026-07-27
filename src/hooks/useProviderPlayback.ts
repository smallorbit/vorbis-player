import { useCallback, useEffect } from 'react';
import type { ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { AuthExpiredError, UnavailableTrackError } from '@/providers/errors';
import { playbackStore } from '@/stores/playbackStore';
import { queueStore } from '@/stores/queueStore';
import { useNewestWins } from '@/hooks/useNewestWins';
import { logQueue, logArtRace } from '@/lib/debugLog';
import { SKIP_ON_ERROR_DELAY_MS } from '@/constants/timing';
import { PROVIDER_RECONNECTED_EVENT } from '@/constants/events';
import { loadSession } from '@/services/sessionPersistence';

interface UseProviderPlaybackProps {
  onAuthExpired?: ((providerId: ProviderId) => void) | undefined;
}

export const useProviderPlayback = ({
  onAuthExpired,
}: UseProviderPlaybackProps) => {

  // Newest-wins guard. `playTrack` awaits the provider adapter (a network
  // round-trip for Spotify transfer/play); overlapping invocations — e.g.
  // mashing next — can resolve out of order. A later invocation supersedes an
  // earlier one, so the earlier one's late resolution must not commit its
  // (now-stale) index or fire its pre-warm.
  const playGuard = useNewestWins();

  // Re-prime the current track when its provider re-authenticates after a
  // session expiry. The dispatcher (ProviderContext) skips the initial mount,
  // so this only fires on genuine `not authenticated → authenticated`
  // transitions. The handler is silent — no auto-play, no queue mutation.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ providerId: ProviderId }>).detail;
      const providerId = detail?.providerId;
      if (!providerId) return;

      const currentTrack = queueStore.getCurrentTrack();
      if (!currentTrack) return;
      if (currentTrack.provider !== providerId) return;

      const descriptor = providerRegistry.get(providerId);
      if (!descriptor?.playback.prepareTrack) return;

      const snapshot = loadSession();
      const resolvedPosition =
        snapshot?.trackId === currentTrack.id &&
        typeof snapshot.playbackPosition === 'number'
          ? snapshot.playbackPosition
          : 0;

      try {
        descriptor.playback.prepareTrack(currentTrack, { positionMs: resolvedPosition });
      } catch (error) {
        logQueue('PROVIDER_RECONNECTED re-prime failed: %o', error);
      }
    };

    window.addEventListener(PROVIDER_RECONNECTED_EVENT, handler);
    return () => window.removeEventListener(PROVIDER_RECONNECTED_EVENT, handler);
  }, []);

  const pausePreviousProvider = useCallback((nextProvider: ProviderId): void => {
    const previousProvider = playbackStore.getSnapshot().drivingProviderId;
    if (previousProvider && previousProvider !== nextProvider) {
      providerRegistry.get(previousProvider)?.playback.pause().catch(() => {});
    }
  }, []);

  const playTrack = useCallback(async (index: number, skipOnError = false, options?: { positionMs?: number }) => {
    const tracks = queueStore.getTracks();
    const mediaTrack = tracks[index];
    const trackProvider = playbackStore.resolveDrivingProviderId(mediaTrack?.provider);

    logQueue(
      'playTrack(%d) — provider=%s, track=%s, queueLen=%d, skipOnError=%s',
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
        console.warn(`[Playback] playTrack(${index}) — index out of bounds! queue has ${tracks.length} items`);
      }
      console.error(`[Playback] playTrack(${index}) — no track at index`);
      return;
    }

    // Raise the transition guard BEFORE any adapter call so that the playback
    // store's pipeline ignores provider state events emitted during the
    // transition (pausePreviousProvider pause, adapter playTrack start, and
    // the next-track prepareTrack pre-warm below). Must run before all of
    // those to cover every entry point into playTrack — fresh collection
    // load at index 0, empty-queue append, next/previous, etc.
    playbackStore.beginTransition(mediaTrack.id);

    // Claim this as the newest intended playback. A concurrent later call
    // supersedes this token; when our awaited adapter call resolves we drop
    // the result if we're no longer the newest.
    const token = playGuard.begin();

    pausePreviousProvider(trackProvider);
    playbackStore.setDrivingProvider(trackProvider);

    const descriptor = providerRegistry.get(trackProvider);
    if (!descriptor) {
      console.error(`[${trackProvider}] No descriptor registered`);
      return;
    }

    // Push the latest queue snapshot before invoking playTrack, but only for
    // providers that declare hasNativeQueueSync. Spotify builds upcomingUris
    // from this signal; providers without the capability must not receive it
    // (spec Req 8). User-driven mutations go through useQueueManagement.ts;
    // this covers track transitions (next/previous/hydrate/auto-advance).
    if (descriptor.capabilities.hasNativeQueueSync) {
      descriptor.playback.onQueueChanged?.(tracks, index);
    }

    try {
      await descriptor.playback.playTrack(mediaTrack, options);

      // Superseded by a newer playTrack while the adapter was starting — drop
      // this stale result rather than commit its index or pre-warm its next.
      if (token.isStale()) return;

      queueStore.setCurrentIndex(index);

      const nextIndex = (index + 1) % tracks.length;
      const nextTrack = tracks[nextIndex];
      if (nextTrack && nextIndex !== index) {
        const nextDescriptor = providerRegistry.get(nextTrack.provider);
        if (nextDescriptor?.playback.prepareTrack) {
          logArtRace('pre-warm dispatch: next=%s (idx=%d, provider=%s)',
            nextTrack.id.slice(0, 8), nextIndex, nextTrack.provider);
          nextDescriptor.playback.prepareTrack(nextTrack);
        }
      }
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        onAuthExpired?.(error.providerId);
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
  }, [playGuard, pausePreviousProvider, onAuthExpired]);

  const resumePlayback = useCallback(async () => {
    const descriptor = playbackStore.getDrivingDescriptor();
    if (!descriptor) return;
    try {
      await descriptor.playback.resume();
    } catch (error) {
      console.error(`[${descriptor.id}] Failed to resume playback:`, error);
    }
  }, []);

  return {
    playTrack,
    resumePlayback,
  };
};
