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
import type { Track } from '@/services/spotify';
import type { PlaybackState } from '@/types/domain';
import type { MediaTrack } from '@/types/domain';
import { isAlbumId, extractAlbumId, LIKED_SONGS_ID } from '@/constants/playlist';

/** Convert MediaTrack to Track for UI; Dropbox tracks use empty uri (playback via ref). */
export function mediaTrackToTrack(m: MediaTrack): Track {
  return {
    id: m.id,
    name: m.name,
    artists: m.artists,
    album: m.album,
    album_id: m.albumId,
    track_number: m.trackNumber,
    duration_ms: m.durationMs,
    uri: m.provider === 'dropbox' ? '' : m.playbackRef.ref,
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

  /** When provider is Dropbox, holds the MediaTrack[] for playback; otherwise empty. */
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
    if (activeDescriptor?.id !== 'dropbox') return;
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

  const { playTrack } = useSpotifyPlayback({
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
      if (activeDescriptor?.id === 'dropbox') {
        setError(null);
        setIsLoading(true);
        setSelectedPlaylistId(playlistId);
        mediaTracksRef.current = [];
        try {
          const catalog = activeDescriptor.catalog;
          const isLiked = playlistId === LIKED_SONGS_ID;
          const collectionId = isLiked ? '' : isAlbumId(playlistId) ? extractAlbumId(playlistId) : playlistId;
          const collectionKind = isLiked ? 'liked' as const : isAlbumId(playlistId) ? 'album' as const : 'folder' as const;
          const collectionRef = { provider: 'dropbox' as const, kind: collectionKind, id: collectionId };
          const list = await catalog.listTracks(collectionRef);
          if (list.length === 0) {
            setError('No tracks found in this folder.');
            setTracks([]);
            setOriginalTracks([]);
            setCurrentTrackIndex(0);
            setIsLoading(false);
            return;
          }
          const trackList = list.map(mediaTrackToTrack);
          setOriginalTracks(trackList);
          if (shuffleEnabled) {
            // Shuffle both the Track[] and MediaTrack[] together so indices stay aligned.
            const indices = list.map((_, i) => i);
            for (let i = indices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [indices[i], indices[j]] = [indices[j], indices[i]];
            }
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
          setError(err instanceof Error ? err.message : 'Failed to load folder.');
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

  // Subscribe to the active provider's playback state
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
            if (meta.name !== undefined || meta.artists !== undefined || meta.album !== undefined || meta.image !== undefined) {
              setTracks((prev: Track[]) =>
                prev.map((t, i) =>
                  i === trackIndex
                    ? {
                        ...t,
                        ...(meta.name !== undefined && { name: meta.name }),
                        ...(meta.artists !== undefined && { artists: meta.artists }),
                        ...(meta.album !== undefined && { album: meta.album }),
                        ...(meta.image !== undefined && { image: meta.image }),
                      }
                    : t
                )
              );
              const mediaIdx = mediaTracksRef.current.findIndex((m) => m.id === trackId);
              if (mediaIdx !== -1) {
                mediaTracksRef.current = mediaTracksRef.current.map((m, i) =>
                  i === mediaIdx ? { ...m, ...meta } : m
                );
              }
            }
          }
        }
      } else {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }

    const unsubscribe = playback.subscribe(handleProviderStateChange);

    // Check initial state
    playback.getState().then((state) => {
      if (state) {
        setIsPlaying(state.isPlaying);
        setPlaybackPosition(state.positionMs);
      }
    });

    return unsubscribe;
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
      await activeDescriptor?.playback.resume();
    } catch {
      // Autoplay policy or network errors are handled by the playback adapter
    }
  }, [activeDescriptor]);

  const handlePause = useCallback(() => {
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
  };
}
