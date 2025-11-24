import { useState, useEffect, useCallback, useMemo } from 'react';
import { spotifyAuth } from '@/services/spotify';
import { spotifyPlayer } from '@/services/spotifyPlayer';
import { usePlayerState } from '@/hooks/usePlayerState';
import { usePlaylistManager } from '@/hooks/usePlaylistManager';
import { useSpotifyPlayback } from '@/hooks/useSpotifyPlayback';
import { useAutoAdvance } from '@/hooks/useAutoAdvance';
import { useAccentColor } from '@/hooks/useAccentColor';
import { useVisualEffectsState } from '@/hooks/useVisualEffectsState';

// Debug mode keyboard shortcut handler
const useDebugModeShortcut = (debugModeEnabled: boolean, setDebugModeEnabled: (enabled: boolean) => void) => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Press 'D' key to toggle debug mode (only when not typing in an input)
      if (event.key === 'd' || event.key === 'D') {
        const target = event.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (!isInput) {
          event.preventDefault();
          setDebugModeEnabled(!debugModeEnabled);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [debugModeEnabled, setDebugModeEnabled]);
};

export const usePlayerLogic = () => {
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
          setPreferred: setAccentColorBackgroundEnabled
        }
      },
      debug: { setEnabled: setDebugModeEnabled }
    }
  } = usePlayerState();

  // Enable debug mode keyboard shortcut (press 'D' to toggle)
  useDebugModeShortcut(debugModeEnabled, setDebugModeEnabled);

  // Playback state for visualizer
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

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
    setCurrentTrackIndex,
    playTrack
  });

  useAutoAdvance({
    tracks,
    currentTrackIndex,
    playTrack,
    enabled: true
  });

  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);

  // Extract accent color from album artwork
  const { handleAccentColorChange: handleAccentColorChangeHook } = useAccentColor(
    currentTrack,
    accentColorOverrides,
    setAccentColor,
    setAccentColorOverrides
  );

  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        await spotifyAuth.handleRedirect();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    handleAuthRedirect();
  }, [setError]);

  useEffect(() => {
    const handlePlayerStateChange = (state: SpotifyPlaybackState | null) => {
      if (state) {
        // Update playback state for visualizer
        setIsPlaying(!state.paused);
        setPlaybackPosition(state.position);

        // Update track index if track changed
        if (state.track_window.current_track) {
          const currentTrack = state.track_window.current_track;
          const trackIndex = tracks.findIndex(track => track.id === currentTrack.id);

          if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
            setCurrentTrackIndex(trackIndex);
          }
        }
      } else {
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    };

    spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);

    // Also check initial state
    const checkInitialState = async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
        setPlaybackPosition(state.position);
      }
    };
    checkInitialState();
  }, [tracks, currentTrackIndex, setCurrentTrackIndex]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(nextIndex);
  }, [currentTrackIndex, tracks.length, playTrack]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const prevIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
  }, [currentTrackIndex, tracks.length, playTrack]);

  const handlePlay = useCallback(() => {
    if (currentTrack) {
      playTrack(currentTrackIndex);
    } else {
      spotifyPlayer.resume();
    }
  }, [currentTrack, playTrack, currentTrackIndex]);

  const handlePause = useCallback(() => {
    spotifyPlayer.pause();
  }, []);

  const handleShowPlaylist = useCallback(() => {
    setShowPlaylist(true);
  }, [setShowPlaylist]);

  const handleShowVisualEffects = useCallback(() => {
    setShowVisualEffects(true);
  }, [setShowVisualEffects]);

  const handleCloseVisualEffects = useCallback(() => {
    setShowVisualEffects(false);
  }, [setShowVisualEffects]);

  const handleVisualEffectsToggle = useCallback(() => {
    if (visualEffectsEnabled) {
      setVisualEffectsEnabled(false);
      // Accent color background will be disabled by the sync effect in usePlayerState
    } else {
      setVisualEffectsEnabled(true);
      // Don't automatically enable accent color background - honor the VFX menu setting
      // If it's enabled in the menu, it will show when glow is enabled
      restoreSavedFilters();
      restoreGlowSettings();
    }
  }, [visualEffectsEnabled, restoreSavedFilters, restoreGlowSettings, setVisualEffectsEnabled]);

  const handleClosePlaylist = useCallback(() => {
    setShowPlaylist(false);
  }, [setShowPlaylist]);

  const handleAccentColorChange = useCallback((color: string) => {
    // Map legacy 'RESET_TO_DEFAULT' to 'auto' for the hook
    const mappedColor = color === 'RESET_TO_DEFAULT' ? 'auto' : color;
    handleAccentColorChangeHook(mappedColor);
  }, [handleAccentColorChangeHook]);

  const handleBackgroundVisualizerToggle = useCallback(() => {
    setBackgroundVisualizerEnabled(prev => !prev);
  }, [setBackgroundVisualizerEnabled]);

  const handleBackgroundVisualizerIntensityChange = useCallback((intensity: number) => {
    setBackgroundVisualizerIntensity(Math.max(0, Math.min(100, intensity)));
  }, [setBackgroundVisualizerIntensity]);

  const handleBackgroundVisualizerStyleChange = useCallback((style: 'particles' | 'waveform' | 'geometric' | 'gradient-flow') => {
    setBackgroundVisualizerStyle(style);
  }, [setBackgroundVisualizerStyle]);

  const handleAccentColorBackgroundToggle = useCallback(() => {
     // Update preferred state (which will sync to enabled state via useEffect)
     setAccentColorBackgroundEnabled(prev => !prev);
  }, [setAccentColorBackgroundEnabled]);

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
      currentTrack
    },
    handlers: {
        handlePlaylistSelect,
        handlePlay,
        handlePause,
        handleNext,
        handlePrevious,
        handleShowPlaylist,
        handleShowVisualEffects,
        handleCloseVisualEffects,
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
        handleAccentColorBackgroundToggle
    }
  };
};
