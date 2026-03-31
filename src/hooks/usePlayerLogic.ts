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
import type { AddToQueueResult, PlaybackState, ProviderId } from '@/types/domain';
import type { MediaTrack } from '@/types/domain';
import type { RadioSeed } from '@/types/radio';
import { LIKED_SONGS_ID, resolvePlaylistRef } from '@/constants/playlist';
import { shuffleArray } from '@/utils/shuffleArray';
import { providerRegistry } from '@/providers/registry';
import { logQueue, logRadio } from '@/lib/debugLog';
import { useQueueThumbnailLoader } from '@/hooks/useQueueThumbnailLoader';
import { useQueueDurationLoader } from '@/hooks/useQueueDurationLoader';


/** Compact track summary for queue debug logs. */
function trkSummary(t: { id: string; name: string; provider?: string } | null | undefined): string {
  if (!t) return '(none)';
  return `[${t.provider ?? '?'}] "${t.name}" (${t.id.slice(0, 8)})`;
}

function queueSnapshot(label: string, tracks: { id: string; name: string; provider?: string }[], mediaLen: number, idx: number) {
  logQueue(
    '%s — %d tracks, mediaTracksRef=%d, index=%d, current=%s',
    label,
    tracks.length,
    mediaLen,
    idx,
    trkSummary(tracks[idx]),
  );
  if (tracks.length <= 30) {
    logQueue('  trackIds: %s', tracks.map((t, i) => `${i}:${t.id.slice(0, 8)}`).join(' '));
  }
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

  const providerPlayback = useProviderPlayback({
    setCurrentTrackIndex,
    activeDescriptor,
    mediaTracks: tracks,
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

  const handlePlaylistSelect = useCallback(
    async (playlistId: string, _playlistName?: string, provider?: import('@/types/domain').ProviderId): Promise<number> => {
      logQueue('handlePlaylistSelect called — playlistId=%s provider=%s', playlistId, provider ?? 'active');

      // Clear any active radio session since the queue is being replaced
      if (radioState.isActive) {
        stopRadioBase();
      }

      // Unified liked songs: fetch from all connected providers, merge by timestamp
      if (playlistId === LIKED_SONGS_ID && !provider && isUnifiedLikedActive) {
        setError(null);
        setIsLoading(true);
        setSelectedPlaylistId(playlistId);
        try {
          const likedProviderIds = connectedProviderIds.filter(
            id => getDescriptor(id)?.capabilities.hasLikedCollection,
          );
          const results = await Promise.all(
            likedProviderIds.map(async (id) => {
              const catalog = getDescriptor(id)?.catalog;
              if (!catalog) return [];
              return catalog.listTracks({ provider: id, kind: 'liked' }).catch(() => [] as MediaTrack[]);
            }),
          );
          const merged = results.flat();
          merged.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));

          if (merged.length === 0) {
            setError('No liked tracks found.');
            setTracks([]);
            setOriginalTracks([]);
            setCurrentTrackIndex(0);
            setIsLoading(false);
            return 0;
          }

          setOriginalTracks(merged);
          if (shuffleEnabled) {
            const indices = shuffleArray(merged.map((_, i) => i));
            setTracks(indices.map(i => merged[i]));
          } else {
            setTracks(merged);
          }
          setCurrentTrackIndex(0);
          setIsLoading(false);

          const firstTrack = merged[0];
          const firstProvider = getDescriptor(firstTrack.provider);
          if (firstProvider) {
            drivingProviderRef.current = firstTrack.provider;
            if (firstTrack.provider !== activeDescriptor?.id) {
              setActiveProviderId(firstTrack.provider);
            }
            queueSnapshot('Unified Liked loaded', merged, merged.length, 0);
            // Route initial playback through shared playTrack() so Spotify queue sync runs immediately.
            await playTrack(0);
          }
          return merged.length;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load liked tracks.');
          setTracks([]);
          setOriginalTracks([]);
          setCurrentTrackIndex(0);
          setIsLoading(false);
          return 0;
        }
      }

      // Determine which provider descriptor to use for this collection
      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      // If selecting from a different provider, switch active provider for playback
      if (targetProviderId && targetProviderId !== activeDescriptor?.id) {
        setActiveProviderId(targetProviderId);
      }

      if (targetDescriptor) {
        const providerId = targetDescriptor.id;

        // Pause the previous provider before switching (activeDescriptor may still
        // point to the old provider since setActiveProviderId is async via React state)
        if (activeDescriptor && activeDescriptor.id !== providerId) {
          activeDescriptor.playback.pause().catch(() => {});
        }

        setError(null);
        setIsLoading(true);
        setSelectedPlaylistId(playlistId);
        try {
          const catalog = targetDescriptor.catalog;
          const { id: collectionId, kind: collectionKind } = resolvePlaylistRef(playlistId, providerId);
          const collectionRef = { provider: providerId, kind: collectionKind, id: collectionId } as const;
          const list = await catalog.listTracks(collectionRef);

          // If catalog returns no tracks and the provider supports native collection
          // playback (e.g. Spotify context playback for restricted playlists), delegate
          // to the legacy SDK-based playlist handler.
          if (list.length === 0 && targetDescriptor.playback.playCollection) {
            setIsLoading(false);
            const prevProvider = drivingProviderRef.current;
            if (prevProvider && prevProvider !== providerId) {
              providerRegistry.get(prevProvider)?.playback.pause().catch(() => {});
            }
            drivingProviderRef.current = providerId;
            logQueue('Context playback path — delegating to legacy handler for %s on %s', playlistId, providerId);
            const sdkTracks = await spotifyHandlePlaylistSelect(playlistId);
            if (sdkTracks.length > 0) {
              queueSnapshot('Context playback loaded', sdkTracks, sdkTracks.length, 0);
            } else {
              logQueue('Context playback returned 0 tracks');
            }
            return sdkTracks.length;
          }

          if (list.length === 0) {
            setError('No tracks found in this collection.');
            setTracks([]);
            setOriginalTracks([]);
            setCurrentTrackIndex(0);
            setIsLoading(false);
            return 0;
          }
          setOriginalTracks(list);
          if (shuffleEnabled) {
            const indices = shuffleArray(list.map((_, i) => i));
            setTracks(indices.map(i => list[i]));
          } else {
            setTracks(list);
          }
          setCurrentTrackIndex(0);
          setIsLoading(false);
          drivingProviderRef.current = providerId;
          queueSnapshot(`${providerId} playlist loaded`, list, list.length, 0);
          await playTrack(0);
          return list.length;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load collection.');
          setTracks([]);
          setOriginalTracks([]);
          setCurrentTrackIndex(0);
          setIsLoading(false);
          return 0;
        }
      }
      return 0;
    },
    [
      activeDescriptor,
      getDescriptor,
      setActiveProviderId,
      shuffleEnabled,
      setError,
      setIsLoading,
      setSelectedPlaylistId,
      setTracks,
      setOriginalTracks,
      setCurrentTrackIndex,
      spotifyHandlePlaylistSelect,
      isUnifiedLikedActive,
      connectedProviderIds,
      drivingProviderRef,
      playTrack,
      radioState.isActive,
      stopRadioBase,
    ]
  );

  useAutoAdvance({ tracks, currentTrackIndex, playTrack, enabled: true, currentPlaybackProviderRef: drivingProviderRef });

  // Notify the driving provider when the queue changes
  useEffect(() => {
    const drivingId = drivingProviderRef.current;
    if (!drivingId || tracks.length === 0) return;
    const descriptor = providerRegistry.get(drivingId);
    descriptor?.playback.onQueueChanged?.(tracks, currentTrackIndex);
  }, [tracks, currentTrackIndex, drivingProviderRef]);

  // Progressively load missing thumbnails for Dropbox tracks in the queue
  const mediaTracksRef = useRef(tracks);
  useEffect(() => { mediaTracksRef.current = tracks; }, [tracks]);
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

  // Subscribe to playback state from all relevant providers.
  // In cross-provider queues (e.g., Dropbox queue with Spotify tracks),
  // we subscribe to both providers and process events from whichever is currently playing.
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
              setTracks((prev: MediaTrack[]) =>
                prev.map((t, i) =>
                  i === trackIndex
                    ? {
                        ...t,
                        ...(meta.name !== undefined && { name: meta.name }),
                        ...(meta.artists !== undefined && { artists: meta.artists }),
                        ...(meta.album !== undefined && { album: meta.album }),
                        ...(meta.image !== undefined && { image: meta.image }),
                        ...(meta.durationMs !== undefined && { durationMs: meta.durationMs }),
                      }
                    : t
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

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndexRef.current + 1) % tracks.length;
    logQueue(
      'handleNext — %d → %d, target=%s, queueLen=%d',
      currentTrackIndexRef.current,
      nextIndex,
      trkSummary(tracksRef.current[nextIndex]),
      tracks.length,
    );
    expectedTrackIdRef.current = tracksRef.current[nextIndex]?.id ?? null;
    setCurrentTrackIndex(nextIndex);
    playTrack(nextIndex, true);
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const newIndex = currentTrackIndexRef.current === 0 ? tracks.length - 1 : currentTrackIndexRef.current - 1;
    logQueue(
      'handlePrevious — %d → %d, target=%s, queueLen=%d',
      currentTrackIndexRef.current,
      newIndex,
      trkSummary(tracksRef.current[newIndex]),
      tracks.length,
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

  // ── Add to queue ────────────────────────────────────────────────────

  /**
   * Fetch tracks from a collection (album/playlist) and append them to the
   * current queue without interrupting playback. If nothing is playing yet,
   * starts playback of the first added track.
   */
  const handleAddToQueue = useCallback(
    async (playlistId: string, _playlistName?: string, provider?: import('@/types/domain').ProviderId): Promise<AddToQueueResult | null> => {
      const isQueueEmpty = tracks.length === 0;
      logQueue(
        'handleAddToQueue — playlistId=%s, provider=%s, currentQueueLen=%d',
        playlistId,
        provider ?? 'active',
        tracks.length,
      );

      // If nothing is playing, just load normally
      if (isQueueEmpty) {
        logQueue('handleAddToQueue — queue empty, delegating to handlePlaylistSelect');
        const loaded = await handlePlaylistSelect(playlistId, _playlistName, provider);
        if (loaded > 0) {
          return { added: loaded, collectionName: _playlistName };
        }
        return null;
      }

      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (!targetDescriptor || !targetProviderId) return null;

      try {
        const catalog = targetDescriptor.catalog;
        const { id: collectionId, kind: collectionKind } = resolvePlaylistRef(playlistId, targetProviderId);
        const collectionRef = { provider: targetProviderId, kind: collectionKind, id: collectionId } as const;
        const newMediaTracks = await catalog.listTracks(collectionRef);

        if (newMediaTracks.length === 0) return null;

        // Append to existing queue
        logQueue(
          'handleAddToQueue — appending %d tracks. Before: tracks=%d',
          newMediaTracks.length,
          tracksRef.current.length,
        );
        setOriginalTracks([...tracksRef.current, ...newMediaTracks]);
        setTracks((prev: MediaTrack[]) => [...prev, ...newMediaTracks]);
        logQueue(
          'handleAddToQueue — after append: newTracks added: %s',
          newMediaTracks.map(t => trkSummary(t)).join(', '),
        );
        return { added: newMediaTracks.length, collectionName: _playlistName };
      } catch (err) {
        console.error('[Queue] Failed to add to queue:', err);
        return null;
      }
    },
    [tracks.length, handlePlaylistSelect, activeDescriptor, getDescriptor, setTracks, setOriginalTracks]
  );

  // ── Radio feature ───────────────────────────────────────────────────

  const clearAuthExpired = useCallback(() => {
    setAuthExpired(null);
  }, []);

  const stopRadio = useCallback(() => {
    stopRadioBase();
    setAuthExpired(null);
  }, [stopRadioBase]);

  const handleBackToLibrary = useCallback(() => {
    logQueue('handleBackToLibrary — clearing all queue state');
    handlePause();
    stopRadio();
    setSelectedPlaylistId(null);
    setTracks([]);
    setCurrentTrackIndex(0);
    setShowQueue(false);
    setShowVisualEffects(false);
  }, [handlePause, stopRadio, setSelectedPlaylistId, setTracks, setCurrentTrackIndex, setShowQueue, setShowVisualEffects]);

  // ── Remove from queue ──────────────────────────────────────────────

  const handleRemoveFromQueue = useCallback(
    (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      // Cannot remove the currently playing track
      if (index === currentTrackIndex) return;

      const removedTrack = tracks[index];
      logQueue('handleRemoveFromQueue — removing index=%d, track=%s, queueLen=%d', index, trkSummary(removedTrack), tracks.length);

      // If this would empty the queue, go back to library
      if (tracks.length <= 1) {
        handleBackToLibrary();
        return;
      }

      // Remove from originalTracks by ID (order-independent for shuffle)
      setOriginalTracks((prev) => prev.filter((t) => t.id !== removedTrack.id));

      // Adjust currentTrackIndex if removing before current
      if (index < currentTrackIndex) {
        setCurrentTrackIndex(prev => prev - 1);
      }

      // Remove from tracks by index
      setTracks(prev => prev.filter((_, i) => i !== index));

      logQueue('handleRemoveFromQueue — done, new queueLen=%d', tracks.length - 1);
    },
    [tracks, currentTrackIndex, handleBackToLibrary, setTracks, setOriginalTracks, setCurrentTrackIndex]
  );

  // ── Reorder queue ─────────────────────────────────────────────────

  const handleReorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= tracks.length) return;
      if (toIndex < 0 || toIndex >= tracks.length) return;

      logQueue('handleReorderQueue — from=%d to=%d, queueLen=%d', fromIndex, toIndex, tracks.length);

      const currentTrackId = tracks[currentTrackIndex]?.id;

      // Move item in array
      const newTracks = [...tracks];
      const [movedTrack] = newTracks.splice(fromIndex, 1);
      newTracks.splice(toIndex, 0, movedTrack);

      // Update currentTrackIndex to follow the currently playing track
      const newCurrentIndex = currentTrackId
        ? newTracks.findIndex(t => t.id === currentTrackId)
        : currentTrackIndex;

      // Only update originalTracks if shuffle is off
      if (!shuffleEnabled) {
        setOriginalTracks(newTracks);
      }

      setCurrentTrackIndex(newCurrentIndex >= 0 ? newCurrentIndex : 0);
      setTracks(newTracks);

      logQueue('handleReorderQueue — done, currentIndex=%d', newCurrentIndex);
    },
    [tracks, currentTrackIndex, shuffleEnabled, setTracks, setOriginalTracks, setCurrentTrackIndex]
  );

  /**
   * Start a radio session from the currently playing track.
   * Provider-agnostic: fetches catalog from the active provider, generates
   * a radio queue via Last.fm, then resolves unmatched suggestions via Spotify.
   */
  const handleStartRadio = useCallback(async () => {
    if (!activeDescriptor || !currentTrack) return;

    setIsLoading(true);
    setError(null);

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

      const result = await startRadio(seed, catalogTracks);

      if (!result) {
        setIsLoading(false);
        return;
      }

      // Current playing track becomes index 0; playback continues without restart.
      const currentSeedMediaTrack: MediaTrack =
        tracksRef.current[currentTrackIndex]?.id === currentTrack?.id
          ? tracksRef.current[currentTrackIndex]
          : currentTrack;

      const seedKey = `${currentSeedMediaTrack.artists.toLowerCase()}||${currentSeedMediaTrack.name.toLowerCase()}`;
      const seedId = currentSeedMediaTrack.id;

      let generatedTracks = [...result.queue];

      // Resolve unmatched suggestions via providers that support track search
      if (result.unmatchedSuggestions.length > 0) {
        const searchCapableProviders = providerRegistry.getAll().filter(
          d => d.capabilities.hasTrackSearch && d.auth.isAuthenticated(),
        );
        if (searchCapableProviders.length > 0) {
          try {
            const resolvedTracks: MediaTrack[] = [];
            for (const suggestion of result.unmatchedSuggestions) {
              for (const provider of searchCapableProviders) {
                const match = await provider.catalog.searchTrack?.(suggestion.artist, suggestion.name);
                if (match) { resolvedTracks.push(match); break; }
              }
            }
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
        setOriginalTracks(combinedQueue);
        setTracks(combinedQueue);
        setCurrentTrackIndex(0);
        setSelectedPlaylistId('radio');
        setIsLoading(false);
        queueSnapshot('Radio queue built', combinedQueue, combinedQueue.length, 0);
        // Do not call playTrack(0) — keep current track playing at current position.
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start radio.');
      setIsLoading(false);
    }
  }, [activeDescriptor, currentTrack, currentTrackIndex, startRadio, setIsLoading, setError, setOriginalTracks, setTracks, setCurrentTrackIndex, setSelectedPlaylistId]);

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
    },
    setTracks,
    setOriginalTracks,
    currentPlaybackProviderRef: drivingProviderRef,
  };
}
