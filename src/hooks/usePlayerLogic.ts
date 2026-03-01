import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // Playback state from provider events (local — not shared via context)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  // Library drawer visibility (local UI state)
  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);

  const { playTrack } = useSpotifyPlayback({ tracks, setCurrentTrackIndex });

  const { handlePlaylistSelect } = usePlaylistManager({
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setOriginalTracks,
    setCurrentTrackIndex,
    shuffleEnabled,
  });

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
          const trackIndex = tracks.findIndex((t: Track) => t.id === trackId);
          if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
            setCurrentTrackIndex(trackIndex);
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
  }, [activeDescriptor, tracks, currentTrackIndex, setCurrentTrackIndex]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex(prevIndex => {
      const nextIndex = (prevIndex + 1) % tracks.length;
      playTrack(nextIndex, true);
      return nextIndex;
    });
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex(prevIndex => {
      const newIndex = prevIndex === 0 ? tracks.length - 1 : prevIndex - 1;
      playTrack(newIndex, true);
      return newIndex;
    });
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

  const handlePlay = useCallback(() => {
    activeDescriptor?.playback.resume();
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
