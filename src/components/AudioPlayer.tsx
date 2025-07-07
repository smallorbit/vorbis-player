import { useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import styled from 'styled-components';
import { spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import { CardContent } from '../components/styled';
import { flexCenter, cardBase } from '../styles/utils';
import AlbumArt from './AlbumArt';
import { extractDominantColor } from '../utils/colorExtractor';
import SpotifyPlayerControls from './SpotifyPlayerControls';
import PlaylistDrawer from './PlaylistDrawer';

// Lazy load heavy components for better performance
const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu'));
import PlayerStateRenderer from './PlayerStateRenderer';
import { usePlayerState } from '../hooks/usePlayerState';
import { usePlaylistManager } from '../hooks/usePlaylistManager';
import { theme } from '@/styles/theme';
import { DEFAULT_GLOW_RATE } from './AccentColorGlowOverlay';

// Styled components
const Container = styled.div`
  width: 100%;
  ${flexCenter};
  padding: ${({ theme }: any) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.sm}) {
    padding: ${({ theme }: any) => theme.spacing.sm};
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
`;


const LoadingCard = styled.div<{ backgroundImage?: string; standalone?: boolean }>`
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
      backdrop-filter: blur(24px);
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
    setGlowIntensity,
    setGlowRate,
    setGlowMode,
    setPerAlbumGlow,
    setAccentColorOverrides,
    handleFilterChange,
    handleResetFilters,
  } = usePlayerState();

  // Define playTrack function
  const playTrack = useCallback(async (index: number) => {
    if (tracks[index]) {
      try {
        // Check if we have valid authentication
        const isAuthenticated = spotifyAuth.isAuthenticated();

        if (!isAuthenticated) {
          return;
        }

        await spotifyPlayer.playTrack(tracks[index].uri);
        setCurrentTrackIndex(index);

        // Check if playback actually started after a delay
        setTimeout(async () => {
          const state = await spotifyPlayer.getCurrentState();
          if (state?.paused && state.position === 0) {
            try {
              await spotifyPlayer.resume();
            } catch (resumeError) {
              // Silent fail
            }
          }
        }, 1000);

      } catch (error) {
        // Silent fail
      }
    }
  }, [tracks, setCurrentTrackIndex]);

  // Use playlist manager hook
  const { handlePlaylistSelect } = usePlaylistManager({
    setError,
    setIsLoading,
    setSelectedPlaylistId,
    setTracks,
    setCurrentTrackIndex,
    playTrack
  });

  // Handle Spotify auth redirect when component mounts
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

  // Simple player state monitoring (removed complex auto-play logic)
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

  // Auto-advance to next track when current track ends
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let hasEnded = false; // Prevent multiple triggers

    const checkForSongEnd = async () => {
      try {
        const state = await spotifyPlayer.getCurrentState();
        if (state && state.track_window.current_track && tracks.length > 0) {
          const currentTrack = state.track_window.current_track;
          const duration = currentTrack.duration_ms;
          const position = state.position;
          const timeRemaining = duration - position;


          // Check if song has ended (within 2 seconds of completion OR position at end)
          if (!hasEnded && duration > 0 && position > 0 && (
            timeRemaining <= 2000 || // Within 2 seconds of end
            position >= duration - 1000 // Within 1 second of end
          )) {

            hasEnded = true; // Prevent multiple triggers

            // Auto-advance to next track
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            if (tracks[nextIndex]) {
              setTimeout(() => {
                playTrack(nextIndex);
                hasEnded = false; // Reset for next track
              }, 500);
            }
          }
        }
      } catch (error) {
      }
    };

    // Poll every 2 seconds to check for song endings (more frequent)
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

  // Memoize the current track to prevent unnecessary re-renders
  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);

  // On track change: use override if present, else extract
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
            setAccentColor(theme.colors.accent); // Fallback
          }
        } catch (error) {
          setAccentColor(theme.colors.accent); // Fallback
        }
      } else {
        setAccentColor(theme.colors.accent); // Fallback
      }
    };
    extractColor();
  }, [currentTrack?.id, currentTrack?.image, accentColorOverrides, theme.colors.accent]);

  // Handler for user accent color change (from SpotifyPlayerControls)
  const handleAccentColorChange = (color: string) => {
    if (currentTrack?.id) {
      setAccentColorOverrides(prev => ({ ...prev, [currentTrack.id]: color }));
      setAccentColor(color);
    } else {
      setAccentColor(color);
    }
  };


  // Determine current album ID (if available)
  const currentAlbumId = currentTrack?.album || '';
  const currentAlbumName = currentTrack?.album || '';
  // Compute effective glow settings
  const effectiveGlow = glowMode === 'per-album' && currentAlbumId && perAlbumGlow[currentAlbumId]
    ? perAlbumGlow[currentAlbumId]
    : { intensity: glowIntensity, rate: glowRate };

  const renderContent = () => {
    // Use PlayerStateRenderer for loading, error, and playlist selection states
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
        <LoadingCard backgroundImage={currentTrack?.image}>

          <CardContent style={{ position: 'relative', zIndex: 2 }}>
            <AlbumArt currentTrack={currentTrack} accentColor={accentColor} glowIntensity={effectiveGlow.intensity} glowRate={effectiveGlow.rate} albumFilters={albumFilters} />
          </CardContent>
          <CardContent style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}>
            <SpotifyPlayerControls
              currentTrack={currentTrack}
              accentColor={accentColor}
              onPlay={() => spotifyPlayer.resume()}
              onPause={() => spotifyPlayer.pause()}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onShowPlaylist={() => setShowPlaylist(true)}
              trackCount={tracks.length}
              onAccentColorChange={handleAccentColorChange}
              onShowVisualEffects={() => setShowVisualEffects(true)}
            />
          </CardContent>
          <Suspense fallback={<div>Loading effects...</div>}>
            <VisualEffectsMenu
              isOpen={showVisualEffects}
              onClose={() => setShowVisualEffects(false)}
              accentColor={accentColor}
              filters={albumFilters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
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

        <PlaylistDrawer
          isOpen={showPlaylist}
          onClose={() => setShowPlaylist(false)}
          tracks={tracks}
          currentTrackIndex={currentTrackIndex}
          accentColor={accentColor}
          onTrackSelect={playTrack}
        />

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
