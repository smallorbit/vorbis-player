import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
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
import type { Track } from '@/services/spotify';
import type { PlaybackState } from '@/types/domain';
import type { MediaTrack } from '@/types/domain';
import { isAlbumId, extractAlbumId, LIKED_SONGS_ID } from '@/constants/playlist';
import { shuffleArray } from '@/utils/shuffleArray';
import { providerRegistry } from '@/providers/registry';

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

export function usePlayerLogic() {
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
    setShowPlaylist,
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

  /** For non-Spotify providers, holds the MediaTrack[] for playback; otherwise empty. */
  const mediaTracksRef = useRef<MediaTrack[]>([]);

  // Refs so the provider subscription handler always sees the latest values
  // without needing them in the effect's dependency array (which would cause
  // the subscription to tear down and recreate on every track change, triggering
  // a getState() call that can briefly reset currentTrackIndex to the old track).
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const currentTrackIndexRef = useRef(currentTrackIndex);
  currentTrackIndexRef.current = currentTrackIndex;
  const expectedTrackIdRef = useRef<string | null>(null);

  // Keep mediaTracksRef.current in the same order as `tracks` so index-based
  // playback is always correct, even after shuffle is toggled.
  useLayoutEffect(() => {
    const mediaTracks = mediaTracksRef.current;
    if (mediaTracks.length === 0 || mediaTracks.length !== tracks.length) return;
    const idToMedia = new Map(mediaTracks.map(m => [m.id, m]));
    const reordered = tracks.map(t => idToMedia.get(t.id)).filter((m): m is MediaTrack => m !== undefined);
    if (reordered.length === tracks.length) {
      mediaTracksRef.current = reordered;
    }
  }, [tracks]);

  // Playback state from provider events (local — not shared via context)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  // Library drawer visibility (local UI state)
  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);

  const { playTrack, currentPlaybackProviderRef } = useSpotifyPlayback({
    tracks,
    setCurrentTrackIndex,
    activeDescriptor,
    mediaTracksRef,
  });

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
            currentPlaybackProviderRef.current = firstTrack.provider;
            if (firstTrack.provider !== activeDescriptor?.id) {
              setActiveProviderId(firstTrack.provider);
            }
            await firstProvider.playback.playTrack(firstTrack);
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
          const isLiked = playlistId === LIKED_SONGS_ID;
          const collectionId = isLiked ? '' : isAlbumId(playlistId) ? extractAlbumId(playlistId) : playlistId;
          const collectionKind: 'liked' | 'album' | 'playlist' | 'folder' = isLiked
            ? 'liked'
            : isAlbumId(playlistId)
              ? 'album'
              : providerId === 'dropbox' ? 'folder' : 'playlist';
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

          // Update the playback provider ref so controls route to the correct provider
          // (can't use playTrack() here because activeDescriptor may still be stale)
          currentPlaybackProviderRef.current = providerId;
          await targetDescriptor.playback.playTrack(mediaTracksRef.current[0]);
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
      const prevProvider = currentPlaybackProviderRef.current;
      if (prevProvider && prevProvider !== 'spotify') {
        providerRegistry.get(prevProvider)?.playback.pause().catch(() => {});
      }
      currentPlaybackProviderRef.current = 'spotify';
      mediaTracksRef.current = [];
      await spotifyHandlePlaylistSelect(playlistId);
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
      playTrack,
      spotifyHandlePlaylistSelect,
      isUnifiedLikedActive,
      connectedProviderIds,
    ]
  );

  useAutoAdvance({ tracks, currentTrackIndex, playTrack, enabled: true });

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

    function handleProviderStateChange(state: PlaybackState | null) {
      if (state) {
        setIsPlaying(state.isPlaying);
        setPlaybackPosition(state.positionMs);

        if (state.currentTrackId) {
          const trackId = state.currentTrackId;
          const currentTracks = tracksRef.current;
          const trackIndex = currentTracks.findIndex((t: Track) => t.id === trackId);
          if (expectedTrackIdRef.current !== null) {
            if (trackId === expectedTrackIdRef.current) {
              expectedTrackIdRef.current = null;
            }
            // while waiting for the expected track, ignore provider index updates
          } else if (trackIndex !== -1 && trackIndex !== currentTrackIndexRef.current) {
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
    unsubscribes.push(playback.subscribe(handleProviderStateChange));

    // Also subscribe to other registered providers for cross-provider queue support.
    // Only process events when that provider is the one currently playing.
    for (const descriptor of providerRegistry.getAll()) {
      if (descriptor.id !== activeDescriptor.id) {
        const otherUnsubscribe = descriptor.playback.subscribe((state) => {
          // Only handle events from the provider that's currently playing
          if (currentPlaybackProviderRef.current === descriptor.id) {
            handleProviderStateChange(state);
          }
        });
        unsubscribes.push(otherUnsubscribe);
      }
    }

    // Check initial state
    playback.getState().then((state) => {
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
    expectedTrackIdRef.current = tracksRef.current[nextIndex]?.id ?? null;
    setCurrentTrackIndex(nextIndex);
    playTrack(nextIndex, true);
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const newIndex = currentTrackIndexRef.current === 0 ? tracks.length - 1 : currentTrackIndexRef.current - 1;
    expectedTrackIdRef.current = tracksRef.current[newIndex]?.id ?? null;
    setCurrentTrackIndex(newIndex);
    playTrack(newIndex, true);
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

  const handlePlay = useCallback(async () => {
    try {
      // Resume the provider that's currently playing (may differ from active in cross-provider queues)
      const currentProvider = currentPlaybackProviderRef.current;
      if (currentProvider && currentProvider !== activeDescriptor?.id) {
        const descriptor = providerRegistry.get(currentProvider);
        if (descriptor) {
          await descriptor.playback.resume();
          return;
        }
      }
      await activeDescriptor?.playback.resume();
    } catch {
      // Autoplay policy or network errors are handled by the playback adapter
    }
  }, [activeDescriptor]);

  const handlePause = useCallback(() => {
    // Pause the provider that's currently playing
    const currentProvider = currentPlaybackProviderRef.current;
    if (currentProvider && currentProvider !== activeDescriptor?.id) {
      const descriptor = providerRegistry.get(currentProvider);
      if (descriptor) {
        descriptor.playback.pause();
        return;
      }
    }
    activeDescriptor?.playback.pause();
  }, [activeDescriptor]);

  const handleOpenLibraryDrawer = useCallback(() => {
    setShowLibraryDrawer(true);
    setShowPlaylist(false);
    setShowVisualEffects(false);
  }, [setShowPlaylist, setShowVisualEffects]);

  const handleCloseLibraryDrawer = useCallback(() => {
    setShowLibraryDrawer(false);
  }, []);

  const handleBackToLibrary = useCallback(() => {
    handlePause();
    setSelectedPlaylistId(null);
    setTracks([]);
    setCurrentTrackIndex(0);
    mediaTracksRef.current = [];
    setShowPlaylist(false);
    setShowVisualEffects(false);
  }, [handlePause, setSelectedPlaylistId, setTracks, setCurrentTrackIndex, setShowPlaylist, setShowVisualEffects]);

  const handlers = useMemo(
    () => ({
      handlePlaylistSelect,
      handlePlay,
      handlePause,
      handleNext,
      handlePrevious,
      playTrack,
      handleOpenLibraryDrawer,
      handleCloseLibraryDrawer,
      handleBackToLibrary,
    }),
    [
      handlePlaylistSelect,
      handlePlay,
      handlePause,
      handleNext,
      handlePrevious,
      playTrack,
      handleOpenLibraryDrawer,
      handleCloseLibraryDrawer,
      handleBackToLibrary,
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
    currentPlaybackProviderRef,
  };
}
