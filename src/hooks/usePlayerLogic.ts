import { useState, useEffect, useCallback } from 'react';
import { spotifyAuth, checkTrackSaved, saveTrack, unsaveTrack, getAlbumTracks } from '@/services/spotify';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlaylistManager } from '@/hooks/usePlaylistManager';
import { useSpotifyPlayback } from '@/hooks/useSpotifyPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useVisualEffectsState } from '@/hooks/useVisualEffectsState';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useVolume } from '@/hooks/useVolume';
import { useQueueManager } from '@/hooks/useQueueManager';
import type { Track } from '@/services/spotify';

export function usePlayerLogic() {
  const {
    track: { isLoading, error },
    playlist: { selectedId: selectedPlaylistId, isVisible: showPlaylist },
    color: { current: accentColor, overrides: accentColorOverrides },
    visualEffects: {
      enabled: visualEffectsEnabled,
      menuVisible: showVisualEffects,
      filters: albumFilters,
      backgroundVisualizer: {
        enabled: backgroundVisualizerEnabled,
        style: backgroundVisualizerStyle,
        intensity: backgroundVisualizerIntensity
      },
      accentColorBackground: {
        enabled: accentColorBackgroundEnabled,
        preferred: accentColorBackgroundPreferred
      }
    },
    debug: { enabled: debugModeEnabled },
    library: { drawerVisible: showLibraryDrawer },
    actions: {
      track: { setTracks, setCurrentIndex: setCurrentTrackIndex, setLoading: setIsLoading, setError },
      playlist: { setSelectedId: setSelectedPlaylistId, setVisible: setShowPlaylist },
      color: { setCurrent: setAccentColor, setOverrides: setAccentColorOverrides },
      visualEffects: {
        setEnabled: setVisualEffectsEnabled,
        setMenuVisible: setShowVisualEffects,
        handleFilterChange,
        handleResetFilters,
        restoreSavedFilters,
        backgroundVisualizer: {
          setEnabled: setBackgroundVisualizerEnabled,
          setStyle: setBackgroundVisualizerStyle,
          setIntensity: setBackgroundVisualizerIntensity
        },
        accentColorBackground: {
          setPreferred: setAccentColorBackgroundPreferred
        }
      },
      debug: { setEnabled: setDebugModeEnabled },
      library: { setDrawerVisible: setShowLibraryDrawer }
    }
  } = usePlayerState();

  useKeyboardShortcuts(
    {
      onToggleDebugMode: useCallback(() => {
        setDebugModeEnabled(prev => !prev);
      }, [setDebugModeEnabled])
    },
    { enableDebugMode: true }
  );

  // Playback state for visualizer
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  // Like state
  const [isLiked, setIsLiked] = useState(false);
  const [isLikePending, setIsLikePending] = useState(false);

  // Volume/mute controls
  const { handleMuteToggle, isMuted, volume } = useVolume();

  // Visual effects state management
  const {
    effectiveGlow,
    handleGlowIntensityChange,
    handleGlowRateChange,
    restoreGlowSettings
  } = useVisualEffectsState();

  // Queue management - single source of truth for all tracks
  const queueManager = useQueueManager();
  const { queue, currentIndex, currentTrack, setQueueTracks, addToQueue, nextTrack, previousTrack, jumpToTrack, clearQueue } = queueManager;

  // Update the global state to reflect queue state (for compatibility with existing UI)
  useEffect(() => {
    setTracks(queue);
    setCurrentTrackIndex(currentIndex);
  }, [queue, currentIndex, setTracks, setCurrentTrackIndex]);

  const { playTrack } = useSpotifyPlayback({
    tracks: queue,
    setCurrentTrackIndex: (index) => jumpToTrack(index)
  });

  const { handlePlaylistSelect } = usePlaylistManager({
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks: setQueueTracks,
    setCurrentTrackIndex: (index) => jumpToTrack(index)
  });

  // Auto-advance to next track in queue
  useAutoAdvance({
    tracks: queue,
    currentTrackIndex: currentIndex,
    playTrack: async (index: number) => {
      jumpToTrack(index);
      if (queue[index]) {
        await spotifyPlayer.playTrack(queue[index].uri);
      }
    },
    enabled: true
  });

  // currentTrack is already provided by queue manager

  useEffect(() => {
    let isMounted = true;

    async function checkLikeStatus() {
      if (!currentTrack?.id) {
        if (isMounted) setIsLiked(false);
        return;
      }

      try {
        if (isMounted) setIsLikePending(true);
        const liked = await checkTrackSaved(currentTrack.id);
        if (isMounted) setIsLiked(liked);
      } catch (error) {
        console.error('Failed to check like status:', error);
        if (isMounted) setIsLiked(false);
      } finally {
        if (isMounted) setIsLikePending(false);
      }
    }

    checkLikeStatus();

    return () => {
      isMounted = false;
    };
  }, [currentTrack?.id]);

  const handleLikeToggle = useCallback(async () => {
    if (!currentTrack?.id || isLikePending) {
      return;
    }

    const newLikedState = !isLiked;
    setIsLikePending(true);
    setIsLiked(newLikedState);

    try {
      if (newLikedState) {
        await saveTrack(currentTrack.id);
      } else {
        await unsaveTrack(currentTrack.id);
      }
    } catch (error) {
      console.error('Failed to toggle like status:', error);
      setIsLiked(isLiked);
    } finally {
      setIsLikePending(false);
    }
  }, [currentTrack?.id, isLikePending, isLiked]);

  // Extract accent color from album artwork
  const { handleAccentColorChange: handleAccentColorChangeHook } = useAccentColor(
    currentTrack,
    accentColorOverrides,
    setAccentColor,
    setAccentColorOverrides
  );

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

  useEffect(() => {
    function handlePlayerStateChange(state: SpotifyPlaybackState | null) {
      if (state) {
        setIsPlaying(!state.paused);
        setPlaybackPosition(state.position);

        if (state.track_window.current_track) {
          const spotifyTrack = state.track_window.current_track;
          const trackIndex = queue.findIndex((track: Track) => track.id === spotifyTrack.id);

          if (trackIndex !== -1 && trackIndex !== currentIndex) {
            jumpToTrack(trackIndex);
          }
        }
      } else {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    }

    spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);

    async function checkInitialState() {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
        setPlaybackPosition(state.position);
      }
    }

    checkInitialState();
  }, [queue, currentIndex, jumpToTrack]);

  const handleNext = useCallback(async () => {
    if (queue.length === 0) {
      return;
    }

    const success = nextTrack();
    if (success && queue[(currentIndex + 1) % queue.length]) {
      const nextIndex = (currentIndex + 1) % queue.length;
      await spotifyPlayer.playTrack(queue[nextIndex].uri).catch(err => {
        console.error('Failed to play next track:', err);
      });
    }
  }, [queue, currentIndex, nextTrack]);

  const handlePrevious = useCallback(async () => {
    if (queue.length === 0) {
      return;
    }

    const success = previousTrack();
    if (success) {
      const prevIndex = currentIndex === 0 ? queue.length - 1 : currentIndex - 1;
      if (queue[prevIndex]) {
        await spotifyPlayer.playTrack(queue[prevIndex].uri).catch(err => {
          console.error('Failed to play previous track:', err);
        });
      }
    }
  }, [queue, currentIndex, previousTrack]);

  const handlePlay = useCallback(() => {
    spotifyPlayer.resume();
  }, []);

  const handlePause = useCallback(() => {
    spotifyPlayer.pause();
  }, []);

  const handleShowPlaylist = useCallback(() => {
    setShowPlaylist(true);
  }, [setShowPlaylist]);

  const handleTogglePlaylist = useCallback(() => {
    setShowPlaylist(prev => !prev);
  }, [setShowPlaylist]);

  const handleShowVisualEffects = useCallback(() => {
    setShowVisualEffects(true);
  }, [setShowVisualEffects]);

  const handleCloseVisualEffects = useCallback(() => {
    setShowVisualEffects(false);
  }, [setShowVisualEffects]);

  const handleToggleVisualEffectsMenu = useCallback(() => {
    setShowVisualEffects(prev => !prev);
  }, [setShowVisualEffects]);

  const handleVisualEffectsToggle = useCallback(() => {
    if (visualEffectsEnabled) {
      setVisualEffectsEnabled(false);
    } else {
      setVisualEffectsEnabled(true);
      restoreSavedFilters();
      restoreGlowSettings();
    }
  }, [visualEffectsEnabled, restoreSavedFilters, restoreGlowSettings, setVisualEffectsEnabled]);

  const handleClosePlaylist = useCallback(() => {
    setShowPlaylist(false);
  }, [setShowPlaylist]);

  const handleAccentColorChange = useCallback((color: string) => {
    const mappedColor = color === 'RESET_TO_DEFAULT' ? 'auto' : color;
    handleAccentColorChangeHook(mappedColor);
  }, [handleAccentColorChangeHook]);

  const handleBackgroundVisualizerToggle = useCallback(() => {
    setBackgroundVisualizerEnabled(prev => !prev);
  }, [setBackgroundVisualizerEnabled]);

  const handleBackgroundVisualizerIntensityChange = useCallback((intensity: number) => {
    const clampedIntensity = Math.max(0, Math.min(100, intensity));
    setBackgroundVisualizerIntensity(clampedIntensity);
  }, [setBackgroundVisualizerIntensity]);

  const handleBackgroundVisualizerStyleChange = useCallback((style: 'particles' | 'waveform' | 'geometric' | 'gradient-flow') => {
    setBackgroundVisualizerStyle(style);
  }, [setBackgroundVisualizerStyle]);

  const handleAccentColorBackgroundToggle = useCallback(() => {
    setAccentColorBackgroundPreferred(prev => !prev);
  }, [setAccentColorBackgroundPreferred]);

  const handleBackToLibrary = useCallback(() => {
    handlePause();
    setSelectedPlaylistId(null);
    clearQueue();
    setShowPlaylist(false);
    setShowVisualEffects(false);
  }, [handlePause, setSelectedPlaylistId, clearQueue, setShowPlaylist, setShowVisualEffects]);

  const handleShowLibrary = useCallback(() => {
    setShowLibraryDrawer(true);
  }, [setShowLibraryDrawer]);

  const handleCloseLibrary = useCallback(() => {
    setShowLibraryDrawer(false);
  }, [setShowLibraryDrawer]);

  const handleQueueAlbum = useCallback(async (albumId: string) => {
    try {
      setIsLoading(true);
      const albumTracks = await getAlbumTracks(albumId);
      if (albumTracks.length > 0) {
        addToQueue(albumTracks);
        console.log(`🎵 Queued ${albumTracks.length} tracks from album to end of queue`);
        handleCloseLibrary();
      } else {
        console.warn('No tracks found in album');
      }
    } catch (error) {
      console.error('Failed to queue album:', error);
      setError(error instanceof Error ? error.message : 'Failed to queue album');
    } finally {
      setIsLoading(false);
    }
  }, [addToQueue, handleCloseLibrary, setIsLoading, setError]);

  return {
    state: {
      tracks: queue,
      currentTrackIndex: currentIndex,
      isLoading,
      error,
      selectedPlaylistId,
      showPlaylist,
      showLibraryDrawer,
      accentColor,
      showVisualEffects,
      visualEffectsEnabled,
      albumFilters,
      backgroundVisualizerEnabled,
      backgroundVisualizerStyle,
      backgroundVisualizerIntensity,
      accentColorBackgroundEnabled,
      accentColorBackgroundPreferred,
      debugModeEnabled,
      isPlaying,
      playbackPosition,
      effectiveGlow,
      currentTrack,
      isLiked,
      isLikePending,
      isMuted,
      volume,
      queuedTracks: [] // No separate queue anymore - everything is in the main queue
    },
    handlers: {
        handlePlaylistSelect,
        handlePlay,
        handlePause,
        handleNext,
        handlePrevious,
        handleShowPlaylist,
        handleTogglePlaylist,
        handleShowVisualEffects,
        handleCloseVisualEffects,
        handleToggleVisualEffectsMenu,
        handleClosePlaylist,
        playTrack,
        handleAccentColorChange,
        handleVisualEffectsToggle,
        handleFilterChange,
        handleResetFilters,
        handleGlowIntensityChange,
        handleGlowRateChange,
        handleBackgroundVisualizerToggle,
        handleBackgroundVisualizerIntensityChange,
        handleBackgroundVisualizerStyleChange,
        handleAccentColorBackgroundToggle,
        handleLikeToggle,
        handleMuteToggle,
        handleBackToLibrary,
        handleShowLibrary,
        handleCloseLibrary,
        handleQueueAlbum,
        clearQueue
    }
  };
};
