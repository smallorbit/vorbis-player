import { useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { flexCenter } from '../styles/utils';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import { usePlayerState } from '../hooks/usePlayerState';
import { usePlaylistManager } from '../hooks/usePlaylistManager';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { useAccentColor } from '../hooks/useAccentColor';
import { useVisualEffectsState } from '../hooks/useVisualEffectsState';


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
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
  } = usePlayerState();

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
      if (state && state.track_window.current_track) {
        const currentTrack = state.track_window.current_track;
        const trackIndex = tracks.findIndex(track => track.id === currentTrack.id);

        if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
          setCurrentTrackIndex(trackIndex);
        }
      }
    };

    spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);
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
    // Map legacy 'RESET_TO_DEFAULT' to 'auto' for the hook
    const mappedColor = color === 'RESET_TO_DEFAULT' ? 'auto' : color;
    handleAccentColorChangeHook(mappedColor);
  }, [handleAccentColorChangeHook]);

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
          onGlowRateChange: handleGlowRateChange
        }}
      />
    );
  };

  return (
    <Container>
      {renderContent()}
    </Container>
  );
};

export default AudioPlayerComponent;
