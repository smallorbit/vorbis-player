import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { spotifyAuth } from '@/services/spotify';
import { useTrackContext } from '@/contexts/TrackContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useColorContext } from '@/contexts/ColorContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { usePlaylistManager } from '@/hooks/usePlaylistManager';
import { useSpotifyPlayback } from '@/hooks/useSpotifyPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useRadio } from '@/hooks/useRadio';
import type { Track } from '@/services/spotify';
import type { PlaybackState } from '@/types/domain';
import type { MediaTrack } from '@/types/domain';
import type { RadioSeed } from '@/types/radio';
import { isAlbumId, extractAlbumId, LIKED_SONGS_ID } from '@/constants/playlist';
import { shuffleArray } from '@/utils/shuffleArray';
import { providerRegistry } from '@/providers/registry';
import { resolveViaSpotify } from '@/services/spotifyResolver';

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
    currentTrackIndex,
    isLoading,
    error,
    shuffleEnabled,
    selectedPlaylistId,
    currentTrack,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
    setIsLoading,
    setError,
    setSelectedPlaylistId,
    setShowPlaylist,
  } = useTrackContext();

  const {
    setShowVisualEffects,
  } = useVisualEffectsContext();

  const {
    accentColorOverrides,
    setAccentColor,
    setAccentColorOverrides,
  } = useColorContext();

  const { activeDescriptor } = useProviderContext();

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
    if (!activeDescriptor || activeDescriptor.id === 'spotify') return;
    const mediaTracks = mediaTracksRef.current;
    if (mediaTracks.length === 0 || mediaTracks.length !== tracks.length) return;
    const idToMedia = new Map(mediaTracks.map(m => [m.id, m]));
    const reordered = tracks.map(t => idToMedia.get(t.id)).filter((m): m is MediaTrack => m !== undefined);
    if (reordered.length === tracks.length) {
      mediaTracksRef.current = reordered;
    }
  }, [tracks, activeDescriptor?.id]);

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
    async (playlistId: string) => {
      if (activeDescriptor && activeDescriptor.id !== 'spotify') {
        const providerId = activeDescriptor.id;
        setError(null);
        setIsLoading(true);
        setSelectedPlaylistId(playlistId);
        mediaTracksRef.current = [];
        try {
          const catalog = activeDescriptor.catalog;
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
      await spotifyHandlePlaylistSelect(playlistId);
    },
    [
      activeDescriptor,
      shuffleEnabled,
      setError,
      setIsLoading,
      setSelectedPlaylistId,
      setTracks,
      setOriginalTracks,
      setCurrentTrackIndex,
      playTrack,
      spotifyHandlePlaylistSelect,
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
  // In cross-provider queues (e.g., Dropbox radio with Spotify tracks),
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
    stopRadio();
    setSelectedPlaylistId(null);
    setTracks([]);
    setCurrentTrackIndex(0);
    mediaTracksRef.current = [];
    setShowPlaylist(false);
    setShowVisualEffects(false);
  }, [handlePause, setSelectedPlaylistId, setTracks, setCurrentTrackIndex, setShowPlaylist, setShowVisualEffects]);

  // ── Radio feature ───────────────────────────────────────────────────

  const { radioState, startRadio, stopRadio, isRadioAvailable } = useRadio();

  /**
   * Start a radio session from the currently playing track.
   * Fetches the full Dropbox catalog, generates a radio queue via Last.fm,
   * then resolves unmatched suggestions via Spotify to build a cross-provider queue.
   */
  const handleStartRadio = useCallback(async () => {
    if (!activeDescriptor || activeDescriptor.id !== 'dropbox') return;
    if (!currentTrack) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all catalog tracks for matching
      const allMusicRef = { provider: 'dropbox' as const, kind: 'folder' as const, id: '' };
      const allTracks = await activeDescriptor.catalog.listTracks(allMusicRef);

      const seed: RadioSeed = {
        type: 'track',
        artist: currentTrack.artists,
        track: currentTrack.name,
      };

      const result = await startRadio(seed, allTracks);

      if (!result) {
        setIsLoading(false);
        return;
      }

      // Start with matched Dropbox tracks
      let combinedQueue = [...result.queue];

      // Resolve unmatched suggestions via Spotify if user is authenticated
      if (result.unmatchedSuggestions.length > 0 && spotifyAuth.isAuthenticated()) {
        try {
          const spotifyTracks = await resolveViaSpotify(result.unmatchedSuggestions);
          // Filter out any Spotify tracks that duplicate already-matched tracks (by normalized name)
          const existingKeys = new Set(
            combinedQueue.map((t) => `${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
          );
          const newSpotifyTracks = spotifyTracks.filter(
            (t) => !existingKeys.has(`${t.artists.toLowerCase()}||${t.name.toLowerCase()}`),
          );
          combinedQueue = [...combinedQueue, ...newSpotifyTracks];
          console.debug('[Radio] Resolved Spotify tracks:', newSpotifyTracks.length, 'of', result.unmatchedSuggestions.length, 'unmatched suggestions');
        } catch (err) {
          // Spotify resolution is best-effort; continue with local matches only
          console.warn('[Radio] Failed to resolve Spotify tracks:', err);
        }
      }

      if (combinedQueue.length > 0) {
        const trackList = combinedQueue.map(mediaTrackToTrack);
        mediaTracksRef.current = combinedQueue;
        setOriginalTracks(trackList);
        setTracks(trackList);
        setCurrentTrackIndex(0);
        setSelectedPlaylistId('radio');
        setIsLoading(false);
        await playTrack(0);
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start radio.');
      setIsLoading(false);
    }
  }, [activeDescriptor, currentTrack, startRadio, setIsLoading, setError, setOriginalTracks, setTracks, setCurrentTrackIndex, setSelectedPlaylistId, playTrack]);

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
      handleStartRadio,
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
      handleStartRadio,
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
    },
  };
}
