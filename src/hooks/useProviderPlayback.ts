import { useCallback, useEffect, useRef } from 'react';
import type { ProviderDescriptor } from '@/types/providers';
import type { MediaTrack, ProviderId } from '@/types/domain';
import { providerRegistry } from '@/providers/registry';
import { AuthExpiredError, UnavailableTrackError } from '@/providers/errors';
import { logQueue, logArtRace } from '@/lib/debugLog';
import { SKIP_ON_ERROR_DELAY_MS } from '@/constants/timing';
import { PROVIDER_RECONNECTED_EVENT } from '@/constants/events';
import { loadSession } from '@/services/sessionPersistence';

interface UseProviderPlaybackProps {
  setCurrentTrackIndex: (index: number) => void;
  activeDescriptor?: ProviderDescriptor | null | undefined;
  mediaTracksRef: React.MutableRefObject<MediaTrack[]>;
  /**
   * Ref tracking the current track index. Used by the re-prime listener so
   * the handler reads the live index without re-binding on every change.
   */
  currentTrackIndexRef?: React.MutableRefObject<number> | undefined;
  onAuthExpired?: ((providerId: ProviderId) => void) | undefined;
  /**
   * Shared guard ref used by `usePlaybackSubscription` to ignore stale provider
   * index updates during a transition. `playTrack` sets this to the target
   * track id BEFORE any adapter call (including the pre-warm `prepareTrack` on
   * the next track) so that provider state events emitted during the handoff
   * cannot flip `currentTrackIndex` to the wrong track.
   */
  expectedTrackIdRef?: React.MutableRefObject<string | null> | undefined;
}

export const useProviderPlayback = ({
  setCurrentTrackIndex,
  activeDescriptor,
  mediaTracksRef,
  currentTrackIndexRef,
  onAuthExpired,
  expectedTrackIdRef,
}: UseProviderPlaybackProps) => {

  const currentPlaybackProviderRef = useRef<ProviderId | null>(null);

  // Re-prime the current track when its provider re-authenticates after a
  // session expiry. The dispatcher (ProviderContext) skips the initial mount,
  // so this only fires on genuine `not authenticated → authenticated`
  // transitions. The handler is silent — no auto-play, no queue mutation.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ providerId: ProviderId }>).detail;
      const providerId = detail?.providerId;
      if (!providerId) return;

      const tracks = mediaTracksRef.current;
      const index = currentTrackIndexRef?.current ?? -1;
      const currentTrack = index >= 0 ? tracks[index] : undefined;
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
  }, [mediaTracksRef, currentTrackIndexRef]);

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

    // Push the latest queue snapshot to the driving provider before invoking
    // playTrack so adapters that build their native queue from this signal
    // (Spotify's upcomingUris) see the current list for the imminent
    // playback call. User-driven queue mutations notify separately via
    // useQueueManagement.ts; this call covers track transitions
    // (next/previous/hydrate/auto-advance) that bypass that hook.
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
    // mediaTracksRef included for exhaustive-deps; ref identity is stable so it does not cause callback re-creation.
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
