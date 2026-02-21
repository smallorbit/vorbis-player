import { useState, useEffect, useCallback, useMemo } from 'react';
import { spotifyAuth } from '@/services/spotify';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlaylistManager } from '@/hooks/usePlaylistManager';
import { useSpotifyPlayback } from '@/hooks/useSpotifyPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useVisualEffectsState } from '@/hooks/useVisualEffectsState';
import { useVolume } from '@/hooks/useVolume';
import { useLikeTrack } from '@/hooks/useLikeTrack';
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
    zenMode: { enabled: zenModeEnabled },
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
      zenMode: { setEnabled: setZenModeEnabled }
    }
  } = usePlayerState();

  // Playback state for visualizer
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  // Mobile library drawer (full-screen playlist/album selection)
  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);

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

  // Like/save track management
  const { isLiked, isLikePending, handleLikeToggle } = useLikeTrack(currentTrack?.id);

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

    const unsubscribe = spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);

    async function checkInitialState() {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
        setPlaybackPosition(state.position);
      }
    }

    checkInitialState();

    return unsubscribe;
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

  const handleOpenLibraryDrawer = useCallback(() => {
    setShowLibraryDrawer(true);
    setShowPlaylist(false);
    setShowVisualEffects(false);
  }, [setShowPlaylist, setShowVisualEffects]);

  const handleCloseLibraryDrawer = useCallback(() => {
    setShowLibraryDrawer(false);
  }, []);

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

  const handleBackgroundVisualizerStyleChange = useCallback((style: 'particles' | 'geometric') => {
    setBackgroundVisualizerStyle(style);
  }, [setBackgroundVisualizerStyle]);

  const handleAccentColorBackgroundToggle = useCallback(() => {
    setAccentColorBackgroundPreferred(prev => !prev);
  }, [setAccentColorBackgroundPreferred]);

  const handleZenModeToggle = useCallback(() => {
    setZenModeEnabled(prev => !prev);
  }, [setZenModeEnabled]);

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
      isPlaying,
      playbackPosition,
      effectiveGlow,
      currentTrack,
      isLiked,
      isLikePending,
      isMuted,
      volume,
      zenModeEnabled
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
        handleOpenLibraryDrawer,
        handleCloseLibraryDrawer,
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
        handleZenModeToggle
    }
  };
};
