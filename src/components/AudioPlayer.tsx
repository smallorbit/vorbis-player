import { useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import styled from 'styled-components';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { CardContent } from '../components/styled';
import { flexCenter, cardBase } from '../styles/utils';
import AlbumArt from './AlbumArt';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));
const PlaylistDrawer = lazy(() => import('./PlaylistDrawer'));
const SpotifyPlayerControls = lazy(() => import('./SpotifyPlayerControls'));
import PlayerStateRenderer from './PlayerStateRenderer';
import { usePlayerState } from '../hooks/usePlayerState';
import { usePlaylistManager } from '../hooks/usePlaylistManager';
import { useSpotifyPlayback } from '../hooks/useSpotifyPlayback';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { useAccentColor } from '../hooks/useAccentColor';
import { useVisualEffectsState } from '../hooks/useVisualEffectsState';
import { theme } from '@/styles/theme';


const Container = styled.div`
  width: 100%;
  ${flexCenter};
  padding: ${({ theme }) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.sm};
  }
`;

const ContentWrapper = styled.div`
  width: 1024px;
  height: 1186px;

  @media (max-height: ${theme.breakpoints.lg}) {
    width: 768px;
    height: 922px;
  }

  margin: 0 auto;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  box-sizing: border-box;
  position: absolute;
  z-index: 1000;
`;


const LoadingCard = styled.div.withConfig({
  shouldForwardProp: (prop) => !['backgroundImage', 'standalone', 'accentColor', 'glowEnabled', 'glowIntensity', 'glowRate'].includes(prop),
}) <{
  backgroundImage?: string;
  standalone?: boolean;
  accentColor?: string;
  glowEnabled?: boolean;
  glowIntensity?: number;
  glowRate?: number;
}>`
  ${cardBase};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(34, 36, 36, 0.68);
  box-shadow: 0 8px 24px rgba(38, 36, 37, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6);
  ${({ backgroundImage }) => backgroundImage ? `
    &::after {
      content: '';
      position: absolute;
      inset: 0.1rem;
      background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 1.25rem;
      z-index: 0;
    }
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(32, 30, 30, 0.7);
      backdrop-filter: blur(40px);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: rgba(38, 38, 38, 0.5);
    backdrop-filter: blur(12px);
  `}
`;


const AudioPlayerComponent = () => {
  const {
    tracks,
    currentTrackIndex,
    isLoading,
    error,
    selectedPlaylistId,
    showPlaylist,
    accentColor,
    showVisualEffects,
    visualEffectsEnabled,
    setVisualEffectsEnabled,




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



    setAccentColorOverrides,
    handleFilterChange,
    handleResetFilters,
    restoreSavedFilters,
  } = usePlayerState();

  // Visual effects state management
  const {
    glowIntensity,
    glowRate,
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
      <ContentWrapper>
        <LoadingCard
          backgroundImage={currentTrack?.image}
          accentColor={accentColor}
          glowEnabled={visualEffectsEnabled}
          glowIntensity={effectiveGlow.intensity}
          glowRate={effectiveGlow.rate}
        >

          <CardContent style={{ position: 'relative', zIndex: 2, marginTop: '-0.25rem' }}>
            <AlbumArt currentTrack={currentTrack} accentColor={accentColor} glowIntensity={visualEffectsEnabled ? effectiveGlow.intensity : 0} glowRate={effectiveGlow.rate} albumFilters={visualEffectsEnabled ? albumFilters : {
              brightness: 110,
              contrast: 100,
              saturation: 100,
              hue: 0,
              blur: 0,
              sepia: 0
            }} />
          </CardContent>
          <CardContent style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}>
            <Suspense fallback={<div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading controls...</div>}>
              <SpotifyPlayerControls
                currentTrack={currentTrack}
                accentColor={accentColor}
                onPlay={handlePlay}
                onPause={handlePause}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onShowPlaylist={handleShowPlaylist}
                trackCount={tracks.length}
                onAccentColorChange={handleAccentColorChange}
                onShowVisualEffects={handleShowVisualEffects}
                glowEnabled={visualEffectsEnabled}
                onGlowToggle={handleVisualEffectsToggle}
              />
            </Suspense>
          </CardContent>
          {visualEffectsEnabled && <Suspense fallback={<div>Loading effects...</div>}>
            <VisualEffectsMenu
              isOpen={showVisualEffects}
              onClose={handleCloseVisualEffects}
              accentColor={accentColor}
              filters={albumFilters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              glowIntensity={glowIntensity}
              setGlowIntensity={handleGlowIntensityChange}
              glowRate={glowRate}
              setGlowRate={handleGlowRateChange}
              effectiveGlow={effectiveGlow}
            />
          </Suspense>}
        </LoadingCard>

        <Suspense fallback={<div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>Loading playlist...</div>}>
          <PlaylistDrawer
            isOpen={showPlaylist}
            onClose={handleClosePlaylist}
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            accentColor={accentColor}
            onTrackSelect={playTrack}
          />
        </Suspense>

      </ContentWrapper>
    );
  };

  return (
    <Container>
      {renderContent()}
    </Container>
  );
};

export default AudioPlayerComponent;
