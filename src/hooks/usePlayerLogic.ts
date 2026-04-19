import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useVisualEffectsToggle } from '@/contexts/visualEffects';
import { useColorContext } from '@/contexts/ColorContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useSpotifyPlaylistManager } from '@/providers/spotify/useSpotifyPlaylistManager';
import { useProviderPlayback } from '@/hooks/useProviderPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { useRadio } from '@/hooks/useRadio';
import type { ProviderId } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import type { TrackOperations } from '@/types/trackOperations';
import { providerRegistry } from '@/providers/registry';
import { logQueue } from '@/lib/debugLog';
import { useQueueThumbnailLoader } from '@/hooks/useQueueThumbnailLoader';
import { useQueueDurationLoader } from '@/hooks/useQueueDurationLoader';
import { trkSummary } from './playerLogicUtils';
import { useQueueManagement } from './useQueueManagement';
import { useCollectionLoader } from './useCollectionLoader';
import { usePlaybackSubscription } from './usePlaybackSubscription';
import { useRadioSession } from './useRadioSession';
import { useRecentlyPlayedCollections } from './useRecentlyPlayedCollections';
import type { RadioProgress } from '@/types/radio';

export function usePlayerLogic() {
  // Terminology used in this hook:
  // - active provider: selected provider context (library/catalog focus in UI)
  // - driving provider: provider currently controlling audio playback
  // In mixed queues these can differ, so playback controls should prefer the driving provider.
  const {
    tracks,
    isLoading,
    error,
    shuffleEnabled,
    selectedPlaylistId,
    setTracks,
    setOriginalTracks,
    setIsLoading,
    setError,
    setSelectedPlaylistId,
  } = useTrackListContext();

  const {
    currentTrack,
    currentTrackIndex,
    setCurrentTrackIndex,
    setShowQueue,
  } = useCurrentTrackContext();

  const { setShowVisualEffects } = useVisualEffectsToggle();

  const {
    accentColorOverrides,
    setAccentColor,
    setAccentColorOverrides,
  } = useColorContext();

  const { activeDescriptor, setActiveProviderId, getDescriptor, connectedProviderIds } = useProviderContext();
  const { isUnifiedLikedActive } = useUnifiedLikedTracks();

  // MediaTrack[] mirror of `tracks` for index-based playback across all providers
  const mediaTracksRef = useRef(tracks);
  mediaTracksRef.current = tracks;

  const trackOps: TrackOperations = useMemo(() => ({
    setTracks, setOriginalTracks, setCurrentTrackIndex,
    setSelectedPlaylistId, setError, setIsLoading, mediaTracksRef,
  }), [setTracks, setOriginalTracks, setCurrentTrackIndex, setSelectedPlaylistId, setError, setIsLoading]);

  // Refs so the provider subscription handler always sees the latest values
  // without needing them in the effect's dependency array (which would cause
  // the subscription to tear down and recreate on every track change, triggering
  // a getState() call that can briefly reset currentTrackIndex to the old track).
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const currentTrackIndexRef = useRef(currentTrackIndex);
  currentTrackIndexRef.current = currentTrackIndex;
  const expectedTrackIdRef = useRef<string | null>(null);
  // Holds the target index + position when handleHydrate restores a session without autoplay.
  // The next handlePlay consumes this to start playback at the saved offset; other control paths
  // (next/previous/new collection) clear it so a stale hydrate can't hijack a fresh user action.
  const hydratedPendingPlayRef = useRef<{ index: number; positionMs?: number } | null>(null);

  // Playback state from provider events (local — not shared via context)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [authExpired, setAuthExpired] = useState<ProviderId | null>(null);

  // Library full-screen visibility (local UI state)
  const [showLibrary, setShowLibrary] = useState(false);

  // Radio generation progress panel state
  const [radioProgress, setRadioProgress] = useState<RadioProgress | null>(null);

  const providerPlayback = useProviderPlayback({
    setCurrentTrackIndex,
    activeDescriptor,
    mediaTracksRef,
    onAuthExpired: (providerId: ProviderId) => setAuthExpired(providerId),
  });
  const providerPlayTrack = providerPlayback.playTrack;
  const drivingProviderRef = providerPlayback.currentPlaybackProviderRef;

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

  /** Resolve provider currently driving playback; falls back to active provider when unknown. */
  const getDrivingProviderId = useCallback((): ProviderId | null => (
    drivingProviderRef.current ?? activeDescriptor?.id ?? null
  ), [activeDescriptor, drivingProviderRef]);

  const getDrivingProviderDescriptor = useCallback(() => {
    const drivingProviderId = getDrivingProviderId();
    return drivingProviderId ? providerRegistry.get(drivingProviderId) : undefined;
  }, [getDrivingProviderId]);

  const { radioState, startRadio, stopRadio: stopRadioBase, isRadioAvailable } = useRadio();

  const { handlePlaylistSelect: spotifyHandlePlaylistSelect } = useSpotifyPlaylistManager({
    trackOps,
    shuffleEnabled,
  });

  const { record } = useRecentlyPlayedCollections();

  // Initialize collection loader
  const { loadCollection, playTracksDirectly } = useCollectionLoader({
    trackOps,
    activeDescriptor,
    getDescriptor,
    setActiveProviderId,
    connectedProviderIds,
    shuffleEnabled,
    isUnifiedLikedActive,
    drivingProviderRef,
    playTrack,
    spotifyHandlePlaylistSelect,
    stopRadioBase,
    radioStateIsActive: radioState.isActive,
    record,
  });

  useAutoAdvance({ tracks, currentTrackIndex, playTrack, enabled: true, currentPlaybackProviderRef: drivingProviderRef });

  // Notify the driving provider when the queue changes
  useEffect(() => {
    const drivingId = drivingProviderRef.current;
    if (!drivingId || tracks.length === 0) return;
    const descriptor = providerRegistry.get(drivingId);
    descriptor?.playback.onQueueChanged?.(tracks, currentTrackIndex);
  }, [tracks, currentTrackIndex, drivingProviderRef]);

  // Progressively load missing thumbnails for Dropbox tracks in the queue
  useQueueThumbnailLoader(tracks, setTracks);

  // Progressively discover missing durations for Dropbox tracks in the queue
  useQueueDurationLoader(tracks, setTracks);

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

  // Subscribe to playback state from all relevant providers
  usePlaybackSubscription({
    activeDescriptor,
    drivingProviderRef,
    tracksRef,
    currentTrackIndexRef,
    expectedTrackIdRef,
    setIsPlaying,
    setPlaybackPosition,
    setCurrentTrackIndex,
    setTracks,
  });

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndexRef.current + 1) % tracks.length;
    logQueue(
      'handleNext — %d → %d, target=%s, queueLen=%d, mediaLen=%d',
      currentTrackIndexRef.current,
      nextIndex,
      trkSummary(tracksRef.current[nextIndex]),
      tracks.length,
      mediaTracksRef.current.length,
    );
    expectedTrackIdRef.current = tracksRef.current[nextIndex]?.id ?? null;
    setCurrentTrackIndex(nextIndex);
    playTrack(nextIndex, true);
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const newIndex = currentTrackIndexRef.current === 0 ? tracks.length - 1 : currentTrackIndexRef.current - 1;
    logQueue(
      'handlePrevious — %d → %d, target=%s, queueLen=%d, mediaLen=%d',
      currentTrackIndexRef.current,
      newIndex,
      trkSummary(tracksRef.current[newIndex]),
      tracks.length,
      mediaTracksRef.current.length,
    );
    expectedTrackIdRef.current = tracksRef.current[newIndex]?.id ?? null;
    setCurrentTrackIndex(newIndex);
    playTrack(newIndex, true);
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

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
    const drivingId = getDrivingProviderId();
    logQueue(
      'handlePlay — drivingProvider=%s, index=%d, track=%s',
      drivingId,
      currentTrackIndexRef.current,
      trkSummary(tracksRef.current[currentTrackIndexRef.current]),
    );
    try {
      const drivingDescriptor = getDrivingProviderDescriptor();
      if (!drivingDescriptor) return;
      await drivingDescriptor.playback.resume();
    } catch {
      // Autoplay policy or network errors are handled by the playback adapter
    }
  }, [playTrack, getDrivingProviderId, getDrivingProviderDescriptor]);

  const handleHydrate = useCallback(async (session: SessionSnapshot): Promise<void> => {
    if (!session.queueTracks?.length) return;
    const { queueTracks, trackId, trackIndex, collectionId, playbackPosition: savedPositionMs } = session;

    const targetIdx = trackId
      ? queueTracks.findIndex(t => t.id === trackId)
      : Math.min(trackIndex, queueTracks.length - 1);
    const resolvedIdx = targetIdx >= 0 ? targetIdx : Math.min(trackIndex, queueTracks.length - 1);

    setTracks(queueTracks);
    setOriginalTracks(queueTracks);
    setSelectedPlaylistId(collectionId);
    setCurrentTrackIndex(resolvedIdx);
    mediaTracksRef.current = queueTracks;
    expectedTrackIdRef.current = queueTracks[resolvedIdx]?.id ?? null;

    const positionMs = savedPositionMs && savedPositionMs > 0 ? savedPositionMs : undefined;
    setPlaybackPosition(positionMs ?? 0);
    setIsPlaying(false);

    const targetTrack = queueTracks[resolvedIdx];
    const providerId = targetTrack?.provider ?? activeDescriptor?.id;
    if (providerId && targetTrack) {
      drivingProviderRef.current = providerId;
      const descriptor = providerRegistry.get(providerId);
      descriptor?.playback.prepareTrack?.(
        targetTrack,
        positionMs ? { positionMs } : undefined,
      );
    }

    hydratedPendingPlayRef.current = { index: resolvedIdx, positionMs };

    logQueue(
      'handleHydrate — index=%d, track=%s, positionMs=%s, provider=%s',
      resolvedIdx,
      trkSummary(targetTrack),
      positionMs ?? 'NONE',
      providerId ?? 'NONE',
    );
  }, [
    setTracks,
    setOriginalTracks,
    setSelectedPlaylistId,
    setCurrentTrackIndex,
    mediaTracksRef,
    activeDescriptor,
    drivingProviderRef,
  ]);

  const handlePause = useCallback(() => {
    const drivingId = getDrivingProviderId();
    logQueue('handlePause — drivingProvider=%s, index=%d', drivingId, currentTrackIndexRef.current);
    const drivingDescriptor = getDrivingProviderDescriptor();
    drivingDescriptor?.playback.pause();
  }, [getDrivingProviderId, getDrivingProviderDescriptor]);

  const handleOpenLibrary = useCallback(() => {
    setShowLibrary(true);
    setShowQueue(false);
    setShowVisualEffects(false);
  }, [setShowQueue, setShowVisualEffects]);

  const handleCloseLibrary = useCallback(() => {
    setShowLibrary(false);
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
    setSelectedPlaylistId(null);
    setTracks([]);
    setCurrentTrackIndex(0);
    mediaTracksRef.current = [];
    setShowQueue(false);
    setShowVisualEffects(false);
  }, [handlePause, stopRadio, setSelectedPlaylistId, setTracks, setCurrentTrackIndex, setShowQueue, setShowVisualEffects]);

  // Initialize queue management handlers
  const { handleAddToQueue, queueTracksDirectly, handleRemoveFromQueue, handleReorderQueue } = useQueueManagement({
    trackOps,
    tracks,
    currentTrackIndex,
    shuffleEnabled,
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
      handleHydrate,
    }),
    [
      loadCollection,
      playTracksDirectly,
      handleAddToQueue,
      queueTracksDirectly,
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
      handleHydrate,
    ]
  );

  return {
    state: {
      isLoading,
      error,
      selectedPlaylistId,
      tracks,
      showLibrary,
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
    mediaTracksRef,
    setTracks,
    setOriginalTracks,
    currentPlaybackProviderRef: drivingProviderRef,
    expectedTrackIdRef,
  };
}
