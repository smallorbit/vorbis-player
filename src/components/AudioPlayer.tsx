import { useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import styled from 'styled-components';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { CardContent } from '../components/styled';
import { flexCenter, cardBase } from '../styles/utils';
import AlbumArt from './AlbumArt';
import { extractDominantColor } from '../utils/colorExtractor';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));
const PlaylistDrawer = lazy(() => import('./PlaylistDrawer'));
const SpotifyPlayerControls = lazy(() => import('./SpotifyPlayerControls'));
import PlayerStateRenderer from './PlayerStateRenderer';
import { usePlayerState } from '../hooks/usePlayerState';
import { usePlaylistManager } from '../hooks/usePlaylistManager';
import { theme } from '@/styles/theme';
import { DEFAULT_GLOW_RATE } from './AccentColorGlowOverlay';

const Container = styled.div`
  width: 100%;
  ${flexCenter};
  padding: ${({ theme }: any) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.sm}) {
    padding: ${({ theme }: any) => theme.spacing.sm};
  }
  
  /* PWA-specific styles for window-controls-overlay mode */
  @media (display-mode: standalone) {
    width: 100vw;
    height: 100vh;
    padding: 0;
    margin: 0;
  }
`;

const ContentWrapper = styled.div`
  width: 1024px;
  height: 1126px;

  @media (max-height: ${theme.breakpoints.lg}) {
    width: 768px;
    height: 872px;
  }

  margin: 0 auto;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  box-sizing: border-box;
  position: absolute;
  z-index: 1000;
  
  /* PWA-specific styles for window-controls-overlay mode */
  @media (display-mode: standalone) {
    width: 100vw;
    height: 100vh;
    max-width: 1024px;
    max-height: 1126px;
    padding: 0;
    margin: 0;
    position: relative;
  }
`;


const LoadingCard = styled.div<{
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
    glowEnabled,
    glowIntensity,
    glowRate,
    glowMode,
    perAlbumGlow,
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
    setGlowEnabled,
    setGlowIntensity,
    setGlowRate,
    setGlowMode,
    setPerAlbumGlow,
    setAccentColorOverrides,
    handleFilterChange,
    handleResetFilters,
  } = usePlayerState();

  const playTrack = useCallback(async (index: number) => {
    if (tracks[index]) {
      try {
        const isAuthenticated = spotifyAuth.isAuthenticated();

        if (!isAuthenticated) {
          return;
        }

        await spotifyPlayer.playTrack(tracks[index].uri);
        setCurrentTrackIndex(index);

        setTimeout(async () => {
          const state = await spotifyPlayer.getCurrentState();
          if (state) {
            if (state.paused && state.position === 0) {
              try {
                await spotifyPlayer.resume();
              } catch (resumeError) {
                console.error('Failed to resume after playback attempt:', resumeError);
              }
            }
          } else {
            try {
              const token = await spotifyAuth.ensureValidToken();
              const deviceId = spotifyPlayer.getDeviceId();

              if (deviceId) {
                await fetch('https://api.spotify.com/v1/me/player', {
                  method: 'PUT',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    device_ids: [deviceId],
                    play: true
                  })
                });
              }
            } catch (error) {
              console.error('Failed to activate device:', error);
            }
          }
        }, 1500);

      } catch (error) {
        console.error('Failed to play track:', error);
      }
    }
  }, [tracks, setCurrentTrackIndex]);

  const { handlePlaylistSelect } = usePlaylistManager({
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setCurrentTrackIndex,
    playTrack
  });

  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        await spotifyAuth.handleRedirect();
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    handleAuthRedirect();
  }, []);

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
  }, [tracks, currentTrackIndex]);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let hasEnded = false;

    const checkForSongEnd = async () => {
      try {
        const state = await spotifyPlayer.getCurrentState();
        if (state && state.track_window.current_track && tracks.length > 0) {
          const currentTrack = state.track_window.current_track;
          const duration = currentTrack.duration_ms;
          const position = state.position;
          const timeRemaining = duration - position;

          if (!hasEnded && duration > 0 && position > 0 && (
            timeRemaining <= 2000 ||
            position >= duration - 1000
          )) {

            hasEnded = true;

            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            if (tracks[nextIndex]) {
              setTimeout(() => {
                playTrack(nextIndex);
                hasEnded = false;
              }, 500);
            }
          }
        }
      } catch (error) {
      }
    };

    if (tracks.length > 0) {
      pollInterval = setInterval(checkForSongEnd, 2000);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [tracks, currentTrackIndex, playTrack]);

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

  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);

  useEffect(() => {
    const extractColor = async () => {
      if (currentTrack?.id && accentColorOverrides[currentTrack.id]) {
        setAccentColor(accentColorOverrides[currentTrack.id]);
        return;
      }
      if (currentTrack?.image) {
        try {
          const dominantColor = await extractDominantColor(currentTrack.image);
          if (dominantColor) {
            setAccentColor(dominantColor.hex);
          } else {
            setAccentColor(theme.colors.accent);
          }
        } catch (error) {
          setAccentColor(theme.colors.accent);
        }
      } else {
        setAccentColor(theme.colors.accent);
      }
    };
    extractColor();
  }, [currentTrack?.id, currentTrack?.image, accentColorOverrides, theme.colors.accent]);

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
  }, []);

  const handleShowVisualEffects = useCallback(() => {
    setShowVisualEffects(true);
  }, []);

  const handleCloseVisualEffects = useCallback(() => {
    setShowVisualEffects(false);
  }, []);

  const handleGlowToggle = useCallback(() => {
    setGlowEnabled(!glowEnabled);
  }, [glowEnabled]);

  const handleClosePlaylist = useCallback(() => {
    setShowPlaylist(false);
  }, []);

  const handleAccentColorChange = useCallback((color: string) => {
    if (color === 'RESET_TO_DEFAULT' && currentTrack?.id) {
      setAccentColorOverrides(prev => {
        const newOverrides = { ...prev };
        delete newOverrides[currentTrack.id!];
        return newOverrides;
      });
      if (currentTrack?.image) {
        extractDominantColor(currentTrack.image)
          .then(dominantColor => {
            if (dominantColor) {
              setAccentColor(dominantColor.hex);
            } else {
              setAccentColor(theme.colors.accent);
            }
          })
          .catch(() => {
            setAccentColor(theme.colors.accent);
          });
      } else {
        setAccentColor(theme.colors.accent);
      }
      return;
    }

    if (currentTrack?.id) {
      setAccentColorOverrides(prev => ({ ...prev, [currentTrack.id]: color }));
      setAccentColor(color);
    } else {
      setAccentColor(color);
    }
  }, [currentTrack?.id, currentTrack?.image, setAccentColorOverrides, setAccentColor, theme.colors.accent]);

  const currentAlbumId = currentTrack?.album || '';
  const currentAlbumName = currentTrack?.album || '';
  const effectiveGlow = glowMode === 'per-album' && currentAlbumId && perAlbumGlow[currentAlbumId]
    ? perAlbumGlow[currentAlbumId]
    : { intensity: glowIntensity, rate: glowRate };

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
          glowEnabled={glowEnabled}
          glowIntensity={effectiveGlow.intensity}
          glowRate={effectiveGlow.rate}
        >

          <CardContent style={{ position: 'relative', zIndex: 2, marginTop: '-0.25rem' }}>
            <AlbumArt currentTrack={currentTrack} accentColor={accentColor} glowIntensity={glowEnabled ? effectiveGlow.intensity : 0} glowRate={effectiveGlow.rate} albumFilters={albumFilters} />
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
                glowEnabled={glowEnabled}
                onGlowToggle={handleGlowToggle}
              />
            </Suspense>
          </CardContent>
          <Suspense fallback={<div>Loading effects...</div>}>
            <VisualEffectsMenu
              isOpen={showVisualEffects}
              onClose={handleCloseVisualEffects}
              accentColor={accentColor}
              filters={albumFilters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              glowEnabled={glowEnabled}
              setGlowEnabled={setGlowEnabled}
              glowIntensity={glowIntensity}
              setGlowIntensity={setGlowIntensity}
              glowRate={typeof glowRate === 'number' ? glowRate : DEFAULT_GLOW_RATE}
              setGlowRate={setGlowRate}
              glowMode={glowMode}
              setGlowMode={setGlowMode}
              perAlbumGlow={perAlbumGlow}
              setPerAlbumGlow={setPerAlbumGlow}
              currentAlbumId={currentAlbumId}
              currentAlbumName={currentAlbumName}
              effectiveGlow={effectiveGlow}
            />
          </Suspense>
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
