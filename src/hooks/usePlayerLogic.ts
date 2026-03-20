import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { spotifyAuth } from '@/services/spotify';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useColorContext } from '@/contexts/ColorContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { usePlaylistManager } from '@/hooks/usePlaylistManager';
import { useSpotifyPlayback } from '@/hooks/useSpotifyPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useUnifiedLikedTracks } from '@/hooks/useUnifiedLikedTracks';
import { useRadio } from '@/hooks/useRadio';
import { useSpotifyQueueSync } from '@/hooks/useSpotifyQueueSync';
import type { Track } from '@/services/spotify';
import type { PlaybackState, ProviderId } from '@/types/domain';
import type { MediaTrack } from '@/types/domain';
import type { RadioSeed } from '@/types/radio';
import { isAlbumId, extractAlbumId, LIKED_SONGS_ID, resolvePlaylistRef } from '@/constants/playlist';
import { shuffleArray } from '@/utils/shuffleArray';
import { providerRegistry } from '@/providers/registry';
import { resolveViaSpotify } from '@/services/spotifyResolver';
import { logQueue, logRadio } from '@/lib/debugLog';
import { useMediaTracksMirror } from '@/hooks/useMediaTracksMirror';
import { useQueueThumbnailLoader } from '@/hooks/useQueueThumbnailLoader';
import {
  appendMediaTracks,
  moveItemInArray,
  removeMediaTrackById,
  reorderMediaTracksToMatchTracks,
} from '@/utils/queueTrackMirror';

/** Convert MediaTrack to Track for UI; Dropbox tracks use empty uri (playback via ref). */
export function mediaTrackToTrack(m: MediaTrack): Track {
  return {
    id: m.id,
    provider: m.provider,
    name: m.name,
    artists: m.artists,
    artistsData: m.artistsData?.map((a) => ({ name: a.name, url: a.url ?? '' })),
    album: m.album,
    album_id: m.albumId,
    track_number: m.trackNumber,
    duration_ms: m.durationMs,
    uri: m.provider === 'spotify' ? m.playbackRef.ref : '',
    image: m.image,
  };
}

/** Build MediaTrack from Track (e.g. when only UI track is available, e.g. Spotify context playback). */
function trackToMediaTrack(t: Track): MediaTrack {
  const provider = (t.provider ?? 'spotify') as ProviderId;
  return {
    id: t.id,
    provider,
    playbackRef: { provider, ref: t.uri },
    name: t.name,
    artists: t.artists,
    artistsData: t.artistsData?.map((a) => ({ name: a.name, url: a.url })),
    album: t.album,
    albumId: t.album_id,
    trackNumber: t.track_number,
    durationMs: t.duration_ms,
    image: t.image,
  };
}

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
  const [spotifyAuthExpired, setSpotifyAuthExpired] = useState(false);

  // Library drawer visibility (local UI state)
  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);

  const fallbackDrivingProviderRef = useRef<ProviderId | null>(null);
  const spotifyPlayback = useSpotifyPlayback({
    tracks,
    setCurrentTrackIndex,
    activeDescriptor,
    mediaTracksRef,
    onSpotifyAuthExpired: () => setSpotifyAuthExpired(true),
  });
  const { playTrack } = spotifyPlayback;
  const drivingProviderRef = spotifyPlayback.currentPlaybackProviderRef ?? fallbackDrivingProviderRef;

  /** Resolve provider currently driving playback; falls back to active provider when unknown. */
  const getDrivingProviderId = useCallback((): ProviderId | null => (
    drivingProviderRef.current ?? activeDescriptor?.id ?? null
  ), [activeDescriptor, drivingProviderRef]);

  const getDrivingProviderDescriptor = useCallback(() => {
    const drivingProviderId = getDrivingProviderId();
    return drivingProviderId ? providerRegistry.get(drivingProviderId) : undefined;
  }, [getDrivingProviderId]);

  const { handlePlaylistSelect: spotifyHandlePlaylistSelect } = usePlaylistManager({
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
    shuffleEnabled,
  });

  const handlePlaylistSelect = useCallback(
    async (playlistId: string, _playlistName?: string, provider?: import('@/types/domain').ProviderId) => {
      logQueue('handlePlaylistSelect called — playlistId=%s provider=%s', playlistId, provider ?? 'active');

      // Unified liked songs: fetch from all connected providers, merge by timestamp
      if (playlistId === LIKED_SONGS_ID && !provider && isUnifiedLikedActive) {
        setError(null);
        setIsLoading(true);
        setSelectedPlaylistId(playlistId);
        mediaTracksRef.current = [];
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
            return;
          }

          const trackList = merged.map(mediaTrackToTrack);
          setOriginalTracks(trackList);
          if (shuffleEnabled) {
            const indices = shuffleArray(merged.map((_, i) => i));
            mediaTracksRef.current = indices.map(i => merged[i]);
            setTracks(indices.map(i => trackList[i]));
          } else {
            mediaTracksRef.current = merged;
            setTracks(trackList);
          }
          setCurrentTrackIndex(0);
          setIsLoading(false);

          const firstTrack = mediaTracksRef.current[0];
          const firstProvider = getDescriptor(firstTrack.provider);
          if (firstProvider) {
            drivingProviderRef.current = firstTrack.provider;
            if (firstTrack.provider !== activeDescriptor?.id) {
              setActiveProviderId(firstTrack.provider);
            }
            queueSnapshot('Unified Liked loaded', trackList, mediaTracksRef.current.length, 0);
            // Route initial playback through shared playTrack() so Spotify queue sync runs immediately.
            await playTrack(0);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load liked tracks.');
          setTracks([]);
          setOriginalTracks([]);
          setCurrentTrackIndex(0);
          setIsLoading(false);
        }
        return;
      }

      // Determine which provider descriptor to use for this collection
      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      // If selecting from a different provider, switch active provider for playback
      if (targetProviderId && targetProviderId !== activeDescriptor?.id) {
        setActiveProviderId(targetProviderId);
      }

      if (targetDescriptor && targetProviderId !== 'spotify') {
        const providerId = targetDescriptor.id;

        // Pause the previous provider before switching (activeDescriptor may still
        // point to the old provider since setActiveProviderId is async via React state)
        if (activeDescriptor && activeDescriptor.id !== providerId) {
          activeDescriptor.playback.pause().catch(() => {});
        }

        setError(null);
        setIsLoading(true);
        setSelectedPlaylistId(playlistId);
        mediaTracksRef.current = [];
        try {
          const catalog = targetDescriptor.catalog;
          const { id: collectionId, kind: collectionKind } = resolvePlaylistRef(playlistId, providerId);
          const collectionRef = { provider: providerId, kind: collectionKind, id: collectionId } as const;
          const list = await catalog.listTracks(collectionRef);
          if (list.length === 0) {
            setError('No tracks found in this collection.');
            setTracks([]);
            setOriginalTracks([]);
            setCurrentTrackIndex(0);
            setIsLoading(false);
            return;
          }
          const trackList = list.map(mediaTrackToTrack);
          setOriginalTracks(trackList);
          if (shuffleEnabled) {
            const indices = shuffleArray(list.map((_, i) => i));
            mediaTracksRef.current = indices.map(i => list[i]);
            setTracks(indices.map(i => trackList[i]));
          } else {
            mediaTracksRef.current = list;
            setTracks(trackList);
          }
          setCurrentTrackIndex(0);
          setIsLoading(false);

          // Update the playback provider ref so controls route to the correct provider.
          // Initial playback still goes through shared playTrack(), which resolves provider
          // from mediaTracksRef first (not activeDescriptor), so stale provider context is safe.
          drivingProviderRef.current = providerId;
          queueSnapshot(`Non-Spotify (${providerId}) playlist loaded`, trackList, mediaTracksRef.current.length, 0);
          await playTrack(0);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load collection.');
          setTracks([]);
          setOriginalTracks([]);
          setCurrentTrackIndex(0);
          setIsLoading(false);
        }
        return;
      }
      // Pause any non-Spotify provider before handing off to the Spotify playlist manager
      // (which plays via the SDK directly, bypassing the cross-provider pause in playTrack).
      const prevProvider = drivingProviderRef.current;
      if (prevProvider && prevProvider !== 'spotify') {
        providerRegistry.get(prevProvider)?.playback.pause().catch(() => {});
      }
      drivingProviderRef.current = 'spotify';
      mediaTracksRef.current = [];
      logQueue('Spotify path — delegating to usePlaylistManager for %s', playlistId);
      const spotifyTracks = await spotifyHandlePlaylistSelect(playlistId);
      if (spotifyTracks.length > 0) {
        mediaTracksRef.current = spotifyTracks.map(trackToMediaTrack);
        queueSnapshot('Spotify playlist loaded', spotifyTracks, mediaTracksRef.current.length, 0);
      } else {
        logQueue('Spotify playlist returned 0 tracks');
      }
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
    ]
  );

  useAutoAdvance({ tracks, currentTrackIndex, playTrack, enabled: true, currentPlaybackProviderRef: drivingProviderRef });

  // Background-resolve non-Spotify tracks to Spotify URIs for queue sync
  useSpotifyQueueSync({ tracks });

  // Progressively load missing thumbnails for Dropbox tracks in the queue
  useQueueThumbnailLoader(tracks, mediaTracksRef, setTracks);

  // Auto-extract accent color from album artwork; respects overrides in ColorContext
  useAccentColor(currentTrack, accentColorOverrides, setAccentColor, setAccentColorOverrides);

  useEffect(() => {
    async function handleAuthRedirect() {
      try {
        await spotifyAuth.handleRedirect();
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

  // ── Add to queue ────────────────────────────────────────────────────

  /**
   * Fetch tracks from a collection (album/playlist) and append them to the
   * current queue without interrupting playback. If nothing is playing yet,
   * starts playback of the first added track.
   */
  const handleAddToQueue = useCallback(
    async (playlistId: string, _playlistName?: string, provider?: import('@/types/domain').ProviderId) => {
      const isQueueEmpty = tracks.length === 0;
      logQueue(
        'handleAddToQueue — playlistId=%s, provider=%s, currentQueueLen=%d, mediaLen=%d',
        playlistId,
        provider ?? 'active',
        tracks.length,
        mediaTracksRef.current.length,
      );

      // If nothing is playing, just load normally
      if (isQueueEmpty) {
        logQueue('handleAddToQueue — queue empty, delegating to handlePlaylistSelect');
        return handlePlaylistSelect(playlistId, _playlistName, provider);
      }

      const targetDescriptor = provider ? getDescriptor(provider) : activeDescriptor;
      const targetProviderId = provider ?? activeDescriptor?.id;

      if (!targetDescriptor || !targetProviderId) return;

      try {
        let newMediaTracks: MediaTrack[];

        if (targetProviderId === 'spotify') {
          // Fetch Spotify tracks via the API helpers
          let fetchedTracks: Track[];
          if (isAlbumId(playlistId)) {
            const { getAlbumTracks } = await import('@/services/spotify');
            fetchedTracks = await getAlbumTracks(extractAlbumId(playlistId));
          } else if (playlistId === LIKED_SONGS_ID) {
            const { getLikedSongs } = await import('@/services/spotify');
            fetchedTracks = await getLikedSongs();
          } else {
            const { getPlaylistTracks } = await import('@/services/spotify');
            fetchedTracks = await getPlaylistTracks(playlistId);
          }
          newMediaTracks = fetchedTracks.map(trackToMediaTrack);
        } else {
          // Non-Spotify provider: use catalog
          const catalog = targetDescriptor.catalog;
          const { id: collectionId, kind: collectionKind } = resolvePlaylistRef(playlistId, targetProviderId);
          const collectionRef = { provider: targetProviderId, kind: collectionKind, id: collectionId } as const;
          newMediaTracks = await catalog.listTracks(collectionRef);
        }

        if (newMediaTracks.length === 0) return;

        const newTracks = newMediaTracks.map(mediaTrackToTrack);

        // Append to existing queue
        logQueue(
          'handleAddToQueue — appending %d tracks. Before: tracks=%d, mediaRef=%d',
          newMediaTracks.length,
          tracksRef.current.length,
          mediaTracksRef.current.length,
        );
        mediaTracksRef.current = appendMediaTracks(mediaTracksRef.current, newMediaTracks);
        setOriginalTracks([...tracksRef.current, ...newTracks]);
        setTracks((prev: Track[]) => [...prev, ...newTracks]);
        logQueue(
          'handleAddToQueue — after append: mediaRef=%d, newTracks added: %s',
          mediaTracksRef.current.length,
          newTracks.map(t => trkSummary(t)).join(', '),
        );
      } catch (err) {
        console.error('[Queue] Failed to add to queue:', err);
      }
    },
    [tracks.length, handlePlaylistSelect, activeDescriptor, getDescriptor, setTracks, setOriginalTracks]
  );

  // ── Radio feature ───────────────────────────────────────────────────

  const { radioState, startRadio, stopRadio: stopRadioBase, isRadioAvailable } = useRadio();

  const clearSpotifyAuthExpired = useCallback(() => {
    setSpotifyAuthExpired(false);
  }, []);

  const stopRadio = useCallback(() => {
    stopRadioBase();
    setSpotifyAuthExpired(false);
  }, [stopRadioBase]);

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

      mediaTracksRef.current = removeMediaTrackById(mediaTracksRef.current, removedTrack.id);

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

      const newTracks = moveItemInArray(tracks, fromIndex, toIndex);

      // Update currentTrackIndex to follow the currently playing track
      const newCurrentIndex = currentTrackId
        ? newTracks.findIndex(t => t.id === currentTrackId)
        : currentTrackIndex;

      // Explicitly sync mediaTracksRef before setTracks triggers a re-render, so
      // index-based playback reads the correct track even during the render cycle.
      // useMediaTracksMirror will also re-sync afterward, but this ensures the ref
      // is correct synchronously.
      const reorderedMedia = reorderMediaTracksToMatchTracks(newTracks, mediaTracksRef.current);
      if (reorderedMedia) {
        mediaTracksRef.current = reorderedMedia;
      } else {
        logQueue('handleReorderQueue — mediaTracksRef out of sync (len %d vs tracks len %d); layout effect will recover', mediaTracksRef.current.length, newTracks.length);
      }

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
      // Pre-warm Spotify SDK concurrently with queue generation
      const spotifyDescriptor = providerRegistry.get('spotify');
      if (spotifyAuth.isAuthenticated() && spotifyDescriptor) {
        spotifyDescriptor.playback.initialize().catch(() => {});
      }

      // Fetch catalog for matching — provider-specific "all tracks" strategy
      let catalogTracks: MediaTrack[];
      if (activeDescriptor.id === 'dropbox') {
        const allMusicRef = { provider: 'dropbox' as const, kind: 'folder' as const, id: '' };
        catalogTracks = await activeDescriptor.catalog.listTracks(allMusicRef);
      } else {
        const likedRef = { provider: activeDescriptor.id, kind: 'liked' as const, id: '' };
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
      const mediaTracks = mediaTracksRef.current;
      const currentSeedMediaTrack: MediaTrack =
        mediaTracks[currentTrackIndex]?.id === currentTrack?.id
          ? mediaTracks[currentTrackIndex]
          : trackToMediaTrack(currentTrack);

      const seedKey = `${currentSeedMediaTrack.artists.toLowerCase()}||${currentSeedMediaTrack.name.toLowerCase()}`;
      const seedId = currentSeedMediaTrack.id;

      let generatedTracks = [...result.queue];

      // Resolve unmatched suggestions via Spotify if user is authenticated
      if (result.unmatchedSuggestions.length > 0 && spotifyAuth.isAuthenticated()) {
        try {
          const spotifyTracks = await resolveViaSpotify(result.unmatchedSuggestions);
          const existingKeys = new Set(
            generatedTracks.map((t) => `${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
          );
          const newSpotifyTracks = spotifyTracks.filter(
            (t) => !existingKeys.has(`${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
          );
          generatedTracks = [...generatedTracks, ...newSpotifyTracks];
          logRadio(
            'resolved Spotify tracks: %d of %d unmatched suggestions',
            newSpotifyTracks.length,
            result.unmatchedSuggestions.length,
          );
        } catch (err) {
          console.warn('[Radio] Failed to resolve Spotify tracks:', err);
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
        setIsLoading(false);
        queueSnapshot('Radio queue built', trackList, mediaTracksRef.current.length, 0);
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
      spotifyAuthExpired,
      clearSpotifyAuthExpired,
      isActive: radioState.isActive,
    },
    mediaTracksRef,
    setTracks,
    setOriginalTracks,
    currentPlaybackProviderRef: drivingProviderRef,
  };
}
