import { useState, useEffect, useCallback, useMemo } from 'react';
import { spotifyAuth, checkTrackSaved, saveTrack, unsaveTrack } from '@/services/spotify';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlaylistManager } from '@/hooks/usePlaylistManager';
import { useSpotifyPlayback } from '@/hooks/useSpotifyPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useVisualEffectsState } from '@/hooks/useVisualEffectsState';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useVolume } from '@/hooks/useVolume';
import type { Track } from '@/services/spotify';

export function usePlayerLogic() {
  const {
    track: { tracks, currentIndex: currentTrackIndex, isLoading, error },
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
      debug: { setEnabled: setDebugModeEnabled }
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

  const { playTrack } = useSpotifyPlayback({
    tracks,
    setCurrentTrackIndex
  });

  const { handlePlaylistSelect } = usePlaylistManager({
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setCurrentTrackIndex
  });

  useAutoAdvance({
    tracks,
    currentTrackIndex,
    playTrack,
    enabled: true
  });

  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);

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
          const currentTrack = state.track_window.current_track;
          const trackIndex = tracks.findIndex((track: Track) => track.id === currentTrack.id);

          if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
            setCurrentTrackIndex(trackIndex);
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
  }, [tracks, currentTrackIndex, setCurrentTrackIndex]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) {
      return;
    }

    setCurrentTrackIndex((prevIndex) => {
      const nextIndex = (prevIndex + 1) % tracks.length;
      playTrack(nextIndex, true);
      return nextIndex;
    });
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) {
      return;
    }

    setCurrentTrackIndex((prevIndex) => {
      const newIndex = prevIndex === 0 ? tracks.length - 1 : prevIndex - 1;
      playTrack(newIndex, true);
      return newIndex;
    });
  }, [tracks.length, playTrack, setCurrentTrackIndex]);

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
    setTracks([]);
    setCurrentTrackIndex(0);
    setShowPlaylist(false);
    setShowVisualEffects(false);
  }, [handlePause, setSelectedPlaylistId, setTracks, setCurrentTrackIndex, setShowPlaylist, setShowVisualEffects]);

  return {
    state: {
      tracks,
      currentTrackIndex,
      isLoading,
      error,
      selectedPlaylistId,
      showPlaylist,
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
      volume
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
        handleBackToLibrary
    }
  };
};
