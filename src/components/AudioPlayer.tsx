import { useEffect, useMemo, useCallback, useState } from 'react';
import styled from 'styled-components';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { flexCenter } from '../styles/utils';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import { usePlayerState } from '../hooks/usePlayerState';
import { usePlaylistManager } from '../hooks/usePlaylistManager';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { useAccentColor } from '../hooks/useAccentColor';
import { useVisualEffectsState } from '../hooks/useVisualEffectsState';

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

const Container = styled.div`
  width: 100%;
  ${flexCenter};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.sm};
  }
`;


const AudioPlayerComponent = () => {
  const {
    // Legacy individual state (for backward compatibility)
    tracks,
    currentTrackIndex,
    isLoading,
    error,
    selectedPlaylistId,
    showPlaylist,
    accentColor,
    showVisualEffects,
    visualEffectsEnabled,
    accentColorOverrides,
    albumFilters,
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundEnabled,
    accentColorBackgroundPreferred,
    debugModeEnabled,
    setTracks,
    setCurrentTrackIndex,
    setIsLoading,
    setError,
    setSelectedPlaylistId,
    setShowPlaylist,
    setAccentColor,
    setShowVisualEffects,
    setVisualEffectsEnabled,
    setAccentColorOverrides,
    setBackgroundVisualizerEnabled,
    setBackgroundVisualizerStyle,
    setBackgroundVisualizerIntensity,
    setAccentColorBackgroundEnabled,
    setDebugModeEnabled,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
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

  // Temporary test handlers for background visualizer
  const handleBackgroundVisualizerToggle = useCallback(() => {
    setBackgroundVisualizerEnabled(prev => !prev);
  }, [setBackgroundVisualizerEnabled]);

  const handleBackgroundVisualizerIntensityChange = useCallback((intensity: number) => {
    setBackgroundVisualizerIntensity(Math.max(0, Math.min(100, intensity)));
  }, [setBackgroundVisualizerIntensity]);

  const handleBackgroundVisualizerStyleChange = useCallback((style: 'particles' | 'waveform' | 'geometric' | 'gradient-flow') => {
    setBackgroundVisualizerStyle(style);
  }, [setBackgroundVisualizerStyle]);

  const renderContent = () => {
    const stateRenderer = (
      <PlayerStateRenderer
        isLoading={isLoading}
        error={error}
        selectedPlaylistId={selectedPlaylistId}
        tracks={tracks}
        onPlaylistSelect={handlePlaylistSelect}
      />
    );

    if (stateRenderer.props.isLoading || stateRenderer.props.error || !stateRenderer.props.selectedPlaylistId || stateRenderer.props.tracks.length === 0) {
      return stateRenderer;
    }

    return (
      <PlayerContent
        track={{
          current: currentTrack,
          list: tracks,
          currentIndex: currentTrackIndex
        }}
        ui={{
          accentColor,
          showVisualEffects,
          showPlaylist
        }}
        effects={{
          enabled: visualEffectsEnabled,
          glow: effectiveGlow,
          filters: albumFilters
        }}
        handlers={{
          onPlay: handlePlay,
          onPause: handlePause,
          onNext: handleNext,
          onPrevious: handlePrevious,
          onShowPlaylist: handleShowPlaylist,
          onShowVisualEffects: handleShowVisualEffects,
          onCloseVisualEffects: handleCloseVisualEffects,
          onClosePlaylist: handleClosePlaylist,
          onTrackSelect: playTrack,
          onAccentColorChange: handleAccentColorChange,
          onGlowToggle: handleVisualEffectsToggle,
          onFilterChange: handleFilterChange,
          onResetFilters: handleResetFilters,
          onGlowIntensityChange: handleGlowIntensityChange,
          onGlowRateChange: handleGlowRateChange,
          onBackgroundVisualizerToggle: handleBackgroundVisualizerToggle,
          onBackgroundVisualizerIntensityChange: handleBackgroundVisualizerIntensityChange,
          onBackgroundVisualizerStyleChange: handleBackgroundVisualizerStyleChange,
          backgroundVisualizerEnabled,
          backgroundVisualizerStyle,
          backgroundVisualizerIntensity,
          accentColorBackgroundEnabled: accentColorBackgroundPreferred, // Pass preferred state to VFX menu
          onAccentColorBackgroundToggle: () => {
            // Update preferred state (which will sync to enabled state via useEffect)
            setAccentColorBackgroundEnabled(prev => !prev);
          },
          debugModeEnabled
        }}
      />
    );
  };

  return (
    <Container>
      <AccentColorBackground
        enabled={accentColorBackgroundEnabled}
        accentColor={accentColor}
      />
      <BackgroundVisualizer
        enabled={backgroundVisualizerEnabled}
        style={backgroundVisualizerStyle}
        intensity={backgroundVisualizerIntensity}
        accentColor={accentColor}
        isPlaying={isPlaying}
        playbackPosition={playbackPosition}
      />
      {renderContent()}
    </Container>
  );
};

export default AudioPlayerComponent;
