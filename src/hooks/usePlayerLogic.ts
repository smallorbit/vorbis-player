import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useVisualEffectsToggle } from '@/contexts/visualEffects';
import { useColorContext } from '@/contexts/ColorContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useSpotifyPlaylistManager } from '@/providers/spotify/useSpotifyPlaylistManager';
import { useNewestWins } from '@/hooks/useNewestWins';
import { useProviderPlayback } from '@/hooks/useProviderPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { useRadio } from '@/hooks/useRadio';
import type { MediaTrack, ProviderId } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import type { TrackOperations } from '@/types/trackOperations';
import { providerRegistry } from '@/providers/registry';
import { AuthExpiredError, UnavailableTrackError } from '@/providers/errors';
import { playbackStore } from '@/stores/playbackStore';
import { queueStore } from '@/stores/queueStore';
import { usePlaybackState } from '@/hooks/usePlaybackState';
import { logQueue } from '@/lib/debugLog';
import { logCaughtError } from '@/utils/logCaughtError';
import { useQueueThumbnailLoader } from '@/hooks/useQueueThumbnailLoader';
import { useQueueDurationLoader } from '@/hooks/useQueueDurationLoader';
import { trkSummary } from './playerLogicUtils';
import { useQueueManagement } from './useQueueManagement';
import { useCollectionLoader } from './useCollectionLoader';
import { useQueueBundlePrefetch } from './useQueueBundlePrefetch';
import { useRadioSession } from './useRadioSession';
import { useRecentlyPlayedCollections } from './useRecentlyPlayedCollections';
import type { RadioProgress } from '@/types/radio';

export interface RestoreSessionResult {
  /** Track the player landed on, or null when the whole queue was unplayable. */
  track: MediaTrack | null;
  /** True when the saved track was unplayable and a later track in the queue was used instead. */
  skipped: boolean;
  /** True when no track in the queue could be restored; the player was reset to the library. */
  totalFailure: boolean;
}

export interface RestoreSessionOptions {
  /**
   * true — start playback of the restored track immediately (Resume card).
   * false — prime the player paused at the saved position; the next
   * handlePlay starts it (landing-page hydrate).
   */
  autoplay: boolean;
}

export function usePlayerLogic() {
  // Terminology used in this hook:
  // - active provider: selected provider context (library/catalog focus in UI)
  // - driving provider: provider currently controlling audio playback
  // In mixed queues these can differ, so playback controls should prefer the driving provider.
  const {
    tracks,
    isLoading,
    error,
    selection,
    setIsLoading,
    setError,
    setSelection,
  } = useTrackListContext();

  const {
    currentTrack,
    currentTrackIndex,
    setShowQueue,
  } = useCurrentTrackContext();

  const { setIsSettingsOpen } = useVisualEffectsToggle();

  const {
    accentColorOverrides,
    setAccentColor,
    setAccentColorOverrides,
  } = useColorContext();

  const { activeDescriptor, setActiveProviderId, getDescriptor, connectedProviderIds } = useProviderContext();
  const { isUnifiedLikedActive } = useUnifiedLikedTracks();

  const trackOps: TrackOperations = useMemo(() => ({
    setSelection, setError, setIsLoading,
  }), [setSelection, setError, setIsLoading]);

  // Holds the target index + position when restoreSession hydrates without autoplay.
  // The next handlePlay consumes this to start playback at the saved offset; other control paths
  // (next/previous/new collection) clear it so a stale hydrate can't hijack a fresh user action.
  const hydratedPendingPlayRef = useRef<{ index: number; positionMs?: number } | null>(null);

  // Playback state lives in playbackStore, fed by the single provider fan-out.
  const { isPlaying, positionMs: playbackPosition } = usePlaybackState();
  const [authExpired, setAuthExpired] = useState<ProviderId | null>(null);

  // Keep the resolver's last-resort fallback in sync with the active provider,
  // and (re)attach the store's fan-out subscription — reattaching on active
  // provider change re-primes state from whichever provider now drives.
  useEffect(() => {
    playbackStore.setActiveProviderFallback(activeDescriptor?.id ?? null);
  }, [activeDescriptor]);
  useEffect(() => playbackStore.attach(), [activeDescriptor]);

  // Library full-screen visibility (local UI state) — currentView is canonical.
  type PlayerView = 'player' | 'library';
  const [currentView, setCurrentView] = useState<PlayerView>('player');

  // Radio generation progress panel state
  const [radioProgress, setRadioProgress] = useState<RadioProgress | null>(null);

  const handleAuthExpired = useCallback((providerId: ProviderId) => {
    providerRegistry.get(providerId)?.auth.reportUnauthorized?.();
    setAuthExpired(providerId);
  }, []);

  const providerPlayback = useProviderPlayback({
    onAuthExpired: handleAuthExpired,
  });
  const providerPlayTrack = providerPlayback.playTrack;

  // Any call into playTrack represents a concrete playback action, which supersedes
  // a pending hydrate. Wrap the underlying playTrack so downstream consumers don't
  // each have to clear the pending-hydrate ref individually.
  const playTrack = useCallback(async (
    index: number,
    skipOnError = false,
    options?: { positionMs?: number },
  ) => {
    hydratedPendingPlayRef.current = null;
    return providerPlayTrack(index, skipOnError, options);
  }, [providerPlayTrack]);

  const { radioState, startRadio, stopRadio: stopRadioBase, isRadioAvailable } = useRadio();

  const { handlePlaylistSelect: spotifyHandlePlaylistSelect } = useSpotifyPlaylistManager({
    trackOps,
  });

  const { record } = useRecentlyPlayedCollections();

  // Initialize collection loader
  const { loadCollection, playTracksDirectly } = useCollectionLoader({
    trackOps,
    activeDescriptor,
    getDescriptor,
    setActiveProviderId,
    connectedProviderIds,
    isUnifiedLikedActive,
    playTrack,
    spotifyHandlePlaylistSelect,
    stopRadioBase,
    radioStateIsActive: radioState.isActive,
    record,
  });

  useAutoAdvance({ playTrack, enabled: true });

  // Progressively load missing thumbnails for Dropbox tracks in the queue
  useQueueThumbnailLoader(tracks);

  // Progressively discover missing durations for Dropbox tracks in the queue
  useQueueDurationLoader(tracks);

  // Auto-extract accent color from album artwork; respects overrides in ColorContext
  useAccentColor(currentTrack, accentColorOverrides, setAccentColor, setAccentColorOverrides);

  useEffect(() => {
    async function handleAuthRedirect() {
      const currentUrl = new URL(window.location.href);
      try {
        for (const desc of providerRegistry.getAll()) {
          const handled = await desc.auth.handleCallback(currentUrl);
          if (handled) break;
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Authentication failed');
      }
    }
    handleAuthRedirect();
  }, [setError]);

  // Warm the lazy QueueDrawer/QueueBottomSheet bundles on first playback so the
  // user-initiated "Up Next" open is instant. Fires once per session.
  useQueueBundlePrefetch(isPlaying);

  // Skip-while-paused is almost always "play this instead", not "queue and stay
  // paused" — match Spotify/Apple Music by auto-resuming after a manual skip,
  // even when playTrack's adapter call lands during a transition that would
  // otherwise leave the driving provider in its prior paused state.
  const ensurePlaybackResumed = useCallback(async () => {
    const drivingDescriptor = playbackStore.getDrivingDescriptor();
    if (!drivingDescriptor) return;
    try {
      await drivingDescriptor.playback.resume();
    } catch (err) {
      // Autoplay policy or network errors are handled by the playback adapter
      logCaughtError('usePlayerLogic.ensurePlaybackResumed', err);
    }
  }, []);

  const handleNext = useCallback(async () => {
    const queueTracks = queueStore.getTracks();
    const queueIndex = queueStore.getCurrentIndex();
    if (queueTracks.length === 0) return;
    if (queueIndex >= queueTracks.length - 1) {
      logQueue('handleNext — at end of queue (%d/%d), stopping', queueIndex, queueTracks.length);
      return;
    }
    const nextIndex = queueIndex + 1;
    logQueue(
      'handleNext — %d → %d, target=%s, queueLen=%d',
      queueIndex,
      nextIndex,
      trkSummary(queueTracks[nextIndex]),
      queueTracks.length,
    );
    queueStore.setCurrentIndex(nextIndex);
    await playTrack(nextIndex, true);
    await ensurePlaybackResumed();
  }, [playTrack, ensurePlaybackResumed]);

  const handlePrevious = useCallback(async () => {
    const queueTracks = queueStore.getTracks();
    const queueIndex = queueStore.getCurrentIndex();
    if (queueTracks.length === 0) return;
    const newIndex = Math.max(0, queueIndex - 1);
    logQueue(
      'handlePrevious — %d → %d, target=%s, queueLen=%d',
      queueIndex,
      newIndex,
      trkSummary(queueTracks[newIndex]),
      queueTracks.length,
    );
    queueStore.setCurrentIndex(newIndex);
    await playTrack(newIndex, true);
    await ensurePlaybackResumed();
  }, [playTrack, ensurePlaybackResumed]);

  const handlePlay = useCallback(async () => {
    const pending = hydratedPendingPlayRef.current;
    if (pending) {
      hydratedPendingPlayRef.current = null;
      logQueue(
        'handlePlay — hydrated start index=%d, positionMs=%s',
        pending.index,
        pending.positionMs ?? 'NONE',
      );
      await playTrack(
        pending.index,
        false,
        pending.positionMs ? { positionMs: pending.positionMs } : undefined,
      );
      return;
    }
    logQueue(
      'handlePlay — drivingProvider=%s, index=%d, track=%s',
      playbackStore.resolveDrivingProviderId(),
      queueStore.getCurrentIndex(),
      trkSummary(queueStore.getCurrentTrack()),
    );
    try {
      const drivingDescriptor = playbackStore.getDrivingDescriptor();
      if (!drivingDescriptor) return;
      await drivingDescriptor.playback.resume();
    } catch (err) {
      // Autoplay policy or network errors are handled by the playback adapter
      logCaughtError('usePlayerLogic.handlePlay', err);
    }
  }, [playTrack]);

  const handlePause = useCallback(() => {
    logQueue('handlePause — drivingProvider=%s, index=%d', playbackStore.resolveDrivingProviderId(), queueStore.getCurrentIndex());
    playbackStore.getDrivingDescriptor()?.playback.pause();
  }, []);

  const handleOpenLibrary = useCallback(() => {
    setCurrentView('library');
    setShowQueue(false);
    setIsSettingsOpen(false);
  }, [setShowQueue, setIsSettingsOpen]);

  const handleCloseLibrary = useCallback(() => {
    setCurrentView('player');
  }, []);

  // Initialize radio session (before handleBackToLibrary, which needs stopRadio)
  const { handleStartRadio, stopRadio, clearAuthExpired } = useRadioSession({
    trackOps,
    activeDescriptor,
    currentTrack,
    currentTrackIndex,
    startRadio,
    stopRadioBase,
    onProgress: setRadioProgress,
    authExpired,
    setAuthExpired,
  });

  const handleBackToLibrary = useCallback(() => {
    logQueue('handleBackToLibrary — clearing all queue state');
    handlePause();
    stopRadio();
    setSelection(null);
    queueStore.clear();
    playbackStore.clearTransition();
    setShowQueue(false);
    setIsSettingsOpen(false);
  }, [handlePause, stopRadio, setSelection, setShowQueue, setIsSettingsOpen]);

  // Newest-wins guard for session restore: overlapping invocations (a
  // double-clicked Resume card, or Resume racing the idle auto-hydrate)
  // iterate playability candidates asynchronously and write to the shared
  // queue/playback stores — only the newest call may commit.
  const restoreGuard = useNewestWins();

  /**
   * The single session-restore path, shared by the landing page's hydrate
   * flow (autoplay: false — prime the player, wait for the user's play
   * press) and the Resume card (autoplay: true — start playing now). Both
   * get the same candidate-iteration playability fallback: starting at the
   * saved track, skip candidates whose provider is missing/unauthenticated
   * or that fail the playability probe, bounded by one full pass over the
   * queue. Only the first candidate gets the saved position; fallbacks
   * start at zero.
   *
   * A superseded invocation resolves to the no-op result ({ track: null,
   * totalFailure: false }) — callers surface nothing for it.
   */
  const restoreSession = useCallback(async (
    session: SessionSnapshot,
    { autoplay }: RestoreSessionOptions,
  ): Promise<RestoreSessionResult> => {
    if (!session.queueTracks?.length) {
      return { track: null, skipped: false, totalFailure: false };
    }
    const token = restoreGuard.begin();
    const { queueTracks, trackId, trackIndex, selection: savedSelection, playbackPosition: savedPositionMs } = session;

    const fallbackIdx = Math.max(0, Math.min(trackIndex, queueTracks.length - 1));
    const matchedIdx = trackId ? queueTracks.findIndex(t => t.id === trackId) : -1;
    const startIdx = matchedIdx >= 0 ? matchedIdx : fallbackIdx;

    queueStore.replaceQueue(queueTracks);
    setSelection(savedSelection);

    const savedPositionIsValid = savedPositionMs !== undefined && savedPositionMs > 0;

    for (let offset = 0; offset < queueTracks.length; offset += 1) {
      const candidateIdx = (startIdx + offset) % queueTracks.length;
      const candidateTrack = queueTracks[candidateIdx];
      if (!candidateTrack) continue;

      const providerId = candidateTrack.provider ?? activeDescriptor?.id;
      const descriptor = providerId ? providerRegistry.get(providerId) : undefined;
      const providerAuthed = descriptor?.auth.isAuthenticated() ?? false;

      if (!providerId || !descriptor || !providerAuthed) {
        logQueue(
          'restoreSession skip — index=%d, track=%s, reason=%s',
          candidateIdx,
          trkSummary(candidateTrack),
          !providerId ? 'no-provider' : !descriptor ? 'no-descriptor' : 'unauthenticated',
        );
        continue;
      }

      const positionMs = offset === 0 && savedPositionIsValid ? savedPositionMs : undefined;

      // Probe playability before we commit to this candidate. `prepareTrack`
      // on both real adapters is fire-and-forget (internal promise; its errors
      // don't surface to the caller), so without a probe the iterator would
      // never advance against real provider failures like a market-restricted
      // Spotify track or a moved Dropbox file.
      if (descriptor.playback.probePlayable) {
        let playable: boolean;
        try {
          playable = await descriptor.playback.probePlayable(candidateTrack);
        } catch (error) {
          if (error instanceof AuthExpiredError) {
            logQueue('restoreSession probePlayable AuthExpiredError on index=%d, provider=%s', candidateIdx, providerId);
          } else {
            logQueue('restoreSession probePlayable threw on index=%d: %o', candidateIdx, error);
          }
          if (token.isStale()) break;
          continue;
        }
        // A newer restoreSession began while the probe was in flight — this
        // invocation must not touch the stores.
        if (token.isStale()) {
          logQueue('restoreSession superseded during probePlayable on index=%d', candidateIdx);
          return { track: null, skipped: false, totalFailure: false };
        }
        if (!playable) {
          logQueue(
            'restoreSession probePlayable=false on index=%d, track=%s',
            candidateIdx,
            trkSummary(candidateTrack),
          );
          continue;
        }
      }

      if (autoplay) {
        // Resume: start playback of the restored candidate now. playTrack
        // owns the transition guard, driving-provider handoff, and index
        // commit; the guard is raised here too so a stale provider event
        // cannot flip the just-restored index before playTrack runs.
        queueStore.setCurrentIndex(candidateIdx);
        playbackStore.beginTransition(candidateTrack.id);

        logQueue(
          'restoreSession(autoplay) — index=%d, track=%s, positionMs=%s, provider=%s, skipped=%s',
          candidateIdx,
          trkSummary(candidateTrack),
          positionMs ?? 'NONE',
          providerId,
          offset > 0 ? 'YES' : 'NO',
        );

        await playTrack(candidateIdx, false, positionMs ? { positionMs } : undefined);
        return { track: candidateTrack, skipped: offset > 0, totalFailure: false };
      }

      // Hydrate: prime the player paused at the saved position; the next
      // handlePlay consumes the stashed pending play.
      try {
        descriptor.playback.prepareTrack?.(
          candidateTrack,
          positionMs ? { positionMs } : undefined,
        );
      } catch (error) {
        if (error instanceof AuthExpiredError) {
          logQueue('restoreSession AuthExpiredError on index=%d, provider=%s', candidateIdx, providerId);
        } else if (error instanceof UnavailableTrackError) {
          logQueue('restoreSession UnavailableTrackError on index=%d: %s', candidateIdx, error.message);
        } else {
          logQueue('restoreSession prepareTrack threw on index=%d: %o', candidateIdx, error);
        }
        continue;
      }

      queueStore.setCurrentIndex(candidateIdx);
      playbackStore.beginTransition(candidateTrack.id);
      playbackStore.setDrivingProvider(providerId);
      playbackStore.primeRestoredPlayback(positionMs ?? 0);
      hydratedPendingPlayRef.current = {
        index: candidateIdx,
        ...(positionMs !== undefined && { positionMs }),
      };

      logQueue(
        'restoreSession(hydrate) — index=%d, track=%s, positionMs=%s, provider=%s, skipped=%s',
        candidateIdx,
        trkSummary(candidateTrack),
        positionMs ?? 'NONE',
        providerId,
        offset > 0 ? 'YES' : 'NO',
      );

      return { track: candidateTrack, skipped: offset > 0, totalFailure: false };
    }

    // Superseded mid-iteration — the newer invocation owns the outcome.
    if (token.isStale()) {
      return { track: null, skipped: false, totalFailure: false };
    }

    // No track could be restored — drop the queue and let the caller clear the
    // saved session (AudioPlayer owns the session state).
    logQueue('restoreSession — total failure, resetting to library');
    hydratedPendingPlayRef.current = null;
    handleBackToLibrary();
    return { track: null, skipped: false, totalFailure: true };
  }, [
    restoreGuard,
    setSelection,
    activeDescriptor,
    playTrack,
    handleBackToLibrary,
  ]);

  // Initialize queue management handlers
  const { handleAddToQueue, queueTracksDirectly, insertTracksNext, insertCollectionNext, handleRemoveFromQueue, handleReorderQueue } = useQueueManagement({
    loadCollection,
    handleBackToLibrary,
    activeDescriptor,
    getDescriptor,
  });

  const dismissRadioProgress = useCallback(() => setRadioProgress(null), []);

  const handlers = useMemo(
    () => ({
      loadCollection,
      playTracksDirectly,
      handleAddToQueue,
      queueTracksDirectly,
      insertTracksNext,
      insertCollectionNext,
      handlePlay,
      handlePause,
      handleNext,
      handlePrevious,
      playTrack,
      handleOpenLibrary,
      handleCloseLibrary,
      handleBackToLibrary,
      handleStartRadio,
      handleRemoveFromQueue,
      handleReorderQueue,
      restoreSession,
      setCurrentView,
    }),
    [
      loadCollection,
      playTracksDirectly,
      handleAddToQueue,
      queueTracksDirectly,
      insertTracksNext,
      insertCollectionNext,
      handlePlay,
      handlePause,
      handleNext,
      handlePrevious,
      playTrack,
      handleOpenLibrary,
      handleCloseLibrary,
      handleBackToLibrary,
      handleStartRadio,
      handleRemoveFromQueue,
      handleReorderQueue,
      restoreSession,
      setCurrentView,
    ]
  );

  return {
    state: {
      isLoading,
      error,
      selection,
      tracks,
      currentView,
      isPlaying,
      playbackPosition,
    },
    handlers,
    radio: {
      radioState,
      isRadioAvailable,
      stopRadio,
      authExpired,
      clearAuthExpired,
      isActive: radioState.isActive,
      radioProgress,
      dismissRadioProgress,
    },
  };
}
