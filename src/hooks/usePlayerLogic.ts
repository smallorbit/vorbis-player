import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useColorContext } from '@/contexts/ColorContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useSpotifyPlaylistManager } from '@/providers/spotify/useSpotifyPlaylistManager';
import { useProviderPlayback } from '@/hooks/useProviderPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { useRadio } from '@/hooks/useRadio';
import type { ProviderId } from '@/types/domain';
import type { MediaTrack } from '@/types/domain';
import type { RadioSeed } from '@/types/radio';
import { providerRegistry } from '@/providers/registry';
import { logQueue, logRadio } from '@/lib/debugLog';
import { shuffleArray } from '@/utils/shuffleArray';
import { useMediaTracksMirror } from '@/hooks/useMediaTracksMirror';
import { useQueueThumbnailLoader } from '@/hooks/useQueueThumbnailLoader';
import { useQueueDurationLoader } from '@/hooks/useQueueDurationLoader';
import { mediaTrackToTrack, trackToMediaTrack, trkSummary, queueSnapshot } from './playerLogicUtils';
import { useQueueManagement } from './useQueueManagement';
import { useCollectionLoader } from './useCollectionLoader';
import { usePlaybackSubscription } from './usePlaybackSubscription';
import { useRadioSession } from './useRadioSession';

export type RadioProgressPhase = 'fetching-catalog' | 'generating' | 'resolving' | 'done';
export interface RadioProgress { phase: RadioProgressPhase; trackCount?: number; }

// Re-export for backward compatibility with existing imports
export { mediaTrackToTrack };

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

  const {
    setShowVisualEffects,
  } = useVisualEffectsContext();

  const {
    accentColorOverrides,
    setAccentColor,
    setAccentColorOverrides,
  } = useColorContext();

  const { activeDescriptor, setActiveProviderId, getDescriptor, connectedProviderIds } = useProviderContext();
  const { isUnifiedLikedActive } = useUnifiedLikedTracks();

  /** MediaTrack[] mirror of `tracks` for index-based playback across all providers. */
  const mediaTracksRef = useMediaTracksMirror(tracks);

  // Refs so the provider subscription handler always sees the latest values
  // without needing them in the effect's dependency array (which would cause
  // the subscription to tear down and recreate on every track change, triggering
  // a getState() call that can briefly reset currentTrackIndex to the old track).
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const currentTrackIndexRef = useRef(currentTrackIndex);
  currentTrackIndexRef.current = currentTrackIndex;
  const expectedTrackIdRef = useRef<string | null>(null);

  // Playback state from provider events (local — not shared via context)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [authExpired, setAuthExpired] = useState<ProviderId | null>(null);

  // Library drawer visibility (local UI state)
  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);

  // Radio generation progress panel state
  const [radioProgress, setRadioProgress] = useState<RadioProgress | null>(null);

  const providerPlayback = useProviderPlayback({
    setCurrentTrackIndex,
    activeDescriptor,
    mediaTracksRef,
    onAuthExpired: (providerId: ProviderId) => setAuthExpired(providerId),
  });
  const { playTrack } = providerPlayback;
  const drivingProviderRef = providerPlayback.currentPlaybackProviderRef;

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
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
    shuffleEnabled,
  });

  // Initialize collection loader
  const { handlePlaylistSelect } = useCollectionLoader({
    activeDescriptor,
    getDescriptor,
    setActiveProviderId,
    connectedProviderIds,
    shuffleEnabled,
    isUnifiedLikedActive,
    mediaTracksRef,
    drivingProviderRef,
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
    playTrack,
    spotifyHandlePlaylistSelect,
    stopRadioBase,
    radioStateIsActive: radioState.isActive,
  });

  useAutoAdvance({ tracks, currentTrackIndex, playTrack, enabled: true, currentPlaybackProviderRef: drivingProviderRef });

  // Notify the driving provider when the queue changes
  useEffect(() => {
    const drivingId = drivingProviderRef.current;
    if (!drivingId || tracks.length === 0) return;
    const descriptor = providerRegistry.get(drivingId);
    descriptor?.playback.onQueueChanged?.(mediaTracksRef.current, currentTrackIndex);
  }, [tracks, currentTrackIndex, drivingProviderRef, mediaTracksRef]);

  // Progressively load missing thumbnails for Dropbox tracks in the queue
  useQueueThumbnailLoader(tracks, mediaTracksRef, setTracks);

  // Progressively discover missing durations for Dropbox tracks in the queue
  useQueueDurationLoader(tracks, mediaTracksRef, setTracks);

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
    mediaTracksRef,
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
  }, [getDrivingProviderId, getDrivingProviderDescriptor]);

  const handlePause = useCallback(() => {
    const drivingId = getDrivingProviderId();
    logQueue('handlePause — drivingProvider=%s, index=%d', drivingId, currentTrackIndexRef.current);
    const drivingDescriptor = getDrivingProviderDescriptor();
    drivingDescriptor?.playback.pause();
  }, [getDrivingProviderId, getDrivingProviderDescriptor]);

  const handleOpenLibraryDrawer = useCallback(() => {
    setShowLibraryDrawer(true);
    setShowQueue(false);
    setShowVisualEffects(false);
  }, [setShowQueue, setShowVisualEffects]);

  const handleCloseLibraryDrawer = useCallback(() => {
    setShowLibraryDrawer(false);
  }, []);

  // Initialize radio session (before handleBackToLibrary, which needs stopRadio)
  const { stopRadio, clearAuthExpired } = useRadioSession({
    activeDescriptor,
    currentTrack,
    currentTrackIndex,
    mediaTracksRef,
    startRadio,
    stopRadioBase,
    setIsLoading,
    setError,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
    setSelectedPlaylistId,
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
  const { handleAddToQueue, handleRemoveFromQueue, handleReorderQueue } = useQueueManagement({
    tracks,
    currentTrackIndex,
    shuffleEnabled,
    mediaTracksRef,
    handlePlaylistSelect,
    handleBackToLibrary,
    activeDescriptor,
    getDescriptor,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
  });

  /**
   * Start a radio session from the currently playing track.
   * Provider-agnostic: fetches catalog from the active provider, generates
   * a radio queue via Last.fm, then resolves unmatched suggestions via Spotify.
   */
  const handleStartRadio = useCallback(async () => {
    if (!activeDescriptor || !currentTrack) return;

    setRadioProgress({ phase: 'fetching-catalog' });

    try {
      // Pre-warm playback SDKs for providers that support track search
      const searchProviders = providerRegistry.getAll().filter(
        d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
      );
      for (const sp of searchProviders) {
        sp.playback.initialize().catch(() => {});
      }

      // Fetch catalog for matching — provider-specific "all tracks" strategy
      // Fetch the widest catalog for radio matching: try all-music folder first,
      // then fall back to liked songs. Folder-based providers (e.g. Dropbox) return
      // their full library from the root folder; others use liked songs as the catalog.
      let catalogTracks: MediaTrack[];
      const folderId = activeDescriptor.id;
      const allMusicRef = { provider: folderId, kind: 'folder' as const, id: '' };
      catalogTracks = await activeDescriptor.catalog.listTracks(allMusicRef);
      if (catalogTracks.length === 0) {
        const likedRef = { provider: folderId, kind: 'liked' as const, id: '' };
        catalogTracks = await activeDescriptor.catalog.listTracks(likedRef);
      }

      const seed: RadioSeed = {
        type: 'track',
        artist: currentTrack.artists,
        track: currentTrack.name,
      };

      setRadioProgress({ phase: 'generating' });
      const result = await startRadio(seed, catalogTracks);

      if (!result) {
        setRadioProgress(null);
        return;
      }

      // Current playing track becomes index 0; playback continues without restart.
      const mediaTracks = mediaTracksRef.current;
      const currentSeedMediaTrack: MediaTrack =
        mediaTracks[currentTrackIndex]?.id === currentTrack?.id
          ? mediaTracks[currentTrackIndex]
          : trackToMediaTrack(currentTrack);

      const seedKey = `${currentSeedMediaTrack.artists.toLowerCase()}||${currentSeedMediaTrack.name.toLowerCase()}`;
      const seedId = currentSeedMediaTrack.id;

      let generatedTracks = [...result.queue];

      // Resolve unmatched suggestions via providers that support track search
      if (result.unmatchedSuggestions.length > 0) {
        setRadioProgress({ phase: 'resolving' });
        const searchCapableProviders = providerRegistry.getAll().filter(
          d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
        );
        if (searchCapableProviders.length > 0) {
          try {
            // Parallelize searches across all suggestions and providers
            const searchPromises = result.unmatchedSuggestions.map(async (suggestion) => {
              for (const provider of searchCapableProviders) {
                const match = await provider.catalog.searchTrack?.(suggestion.artist, suggestion.name);
                if (match) return match;
              }
              return null;
            });
            const resolvedTracks = (await Promise.all(searchPromises)).filter((t): t is MediaTrack => t !== null);
            const existingKeys = new Set(
              generatedTracks.map((t) => `${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
            );
            const newTracks = resolvedTracks.filter(
              (t) => !existingKeys.has(`${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
            );
            generatedTracks = [...generatedTracks, ...newTracks];
            logRadio(
              'resolved tracks via search: %d of %d unmatched suggestions',
              newTracks.length,
              result.unmatchedSuggestions.length,
            );
          } catch (err) {
            console.warn('[Radio] Failed to resolve tracks via search:', err);
          }
        }
      }

      // Dedupe: drop any generated track that is the same as the seed (by id or artist+title).
      const dedupedGenerated = generatedTracks.filter(
        (t) => t.id !== seedId && `${t.artists.toLowerCase()}||${t.name.toLowerCase()}` !== seedKey,
      );

      // Shuffle the generated tracks, keeping the current track pinned at index 0
      // so playback is not interrupted.
      const shuffledGenerated = shuffleArray(dedupedGenerated);
      const combinedQueue = [currentSeedMediaTrack, ...shuffledGenerated];

      if (combinedQueue.length > 0) {
        const trackList = combinedQueue.map(mediaTrackToTrack);
        mediaTracksRef.current = combinedQueue;
        setOriginalTracks(trackList);
        setTracks(trackList);
        setCurrentTrackIndex(0);
        setSelectedPlaylistId('radio');
        setRadioProgress({ phase: 'done', trackCount: combinedQueue.length });
        queueSnapshot('Radio queue built', trackList, mediaTracksRef.current.length, 0);
        // Do not call playTrack(0) — keep current track playing at current position.
      } else {
        setRadioProgress(null);
      }
    } catch (err) {
      console.warn('[Radio] Generation failed:', err);
      setRadioProgress(null);
    }
  }, [activeDescriptor, currentTrack, currentTrackIndex, startRadio, setOriginalTracks, setTracks, setCurrentTrackIndex, setSelectedPlaylistId]);

  const dismissRadioProgress = useCallback(() => setRadioProgress(null), []);

  const handlers = useMemo(
    () => ({
      handlePlaylistSelect,
      handleAddToQueue,
      handlePlay,
      handlePause,
      handleNext,
      handlePrevious,
      playTrack,
      handleOpenLibraryDrawer,
      handleCloseLibraryDrawer,
      handleBackToLibrary,
      handleStartRadio,
      handleRemoveFromQueue,
      handleReorderQueue,
    }),
    [
      handlePlaylistSelect,
      handleAddToQueue,
      handlePlay,
      handlePause,
      handleNext,
      handlePrevious,
      playTrack,
      handleOpenLibraryDrawer,
      handleCloseLibraryDrawer,
      handleBackToLibrary,
      handleStartRadio,
      handleRemoveFromQueue,
      handleReorderQueue,
    ]
  );

  return {
    state: {
      isLoading,
      error,
      selectedPlaylistId,
      tracks,
      showLibraryDrawer,
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
  };
}
