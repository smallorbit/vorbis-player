import { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import styled, { keyframes } from 'styled-components';
const Playlist = lazy(() => import('./Playlist'));
// import MediaCollage from './MediaCollage';
const VideoAdmin = lazy(() => import('./admin/VideoAdmin'));
const AdminKeyCombo = lazy(() => import('./admin/AdminKeyCombo'));
const VisualizerCanvas = lazy(() => import('./visualizer/VisualizerCanvas'));
const SpotifyAudioBridge = lazy(() => import('./visualizer/SpotifyAudioBridge').then(module => ({ default: module.default || module.SpotifyAudioBridge })));
import { getSpotifyUserPlaylists, spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import { HyperText } from './hyper-text';
import { Card, CardHeader, CardContent } from '../components/styled';
import { Button } from '../components/styled';
import { Skeleton } from '../components/styled';
import { Alert, AlertDescription } from '../components/styled';
import { flexCenter, flexColumn, cardBase } from '../styles/utils';
import { ViewToggle } from './ViewToggle';
import { VisualizerSelector } from './VisualizerSelector';
import { useVisualizerStore } from '../lib/visualizer/state';

// Styled components
const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  ${flexCenter};
  padding: ${({ theme }) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 32rem; /* 512px - mobile/small tablet */
  
  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    max-width: 48rem; /* 768px - larger tablet */
  }
  
  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    max-width: 60rem; /* 960px - desktop */
  }
  
  @media (min-width: ${({ theme }) => theme.breakpoints.xl}) {
    max-width: 72rem; /* 1152px - large desktop */
  }
`;

const PlaylistSection = styled.div`
  margin-bottom: 0;
`;

const VisualizerSection = styled.div`
  width: 100%;
  height: 60vh;
  min-height: 400px;
  margin-bottom: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  overflow: hidden;
  background: rgba(38, 38, 38, 0.5);
  border: 1px solid rgba(115, 115, 115, 0.3);
  
  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    height: 70vh;
    min-height: 500px;
  }
`;

const ControlsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

const LoadingCard = styled(Card) <{ backgroundImage?: string; standalone?: boolean }>`
  ${cardBase};
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(115, 115, 115, 0.5);
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  border-top: 1px solid rgba(115, 115, 115, 0.5);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
  
  ${({ backgroundImage }) => backgroundImage ? `
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url(${backgroundImage});
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: ${({ theme }) => theme.borderRadius.lg};
      z-index: 0;
    }
    
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      border-radius: ${({ theme }) => theme.borderRadius.lg};
      z-index: 1;
    }
  ` : `
    background: rgba(38, 38, 38, 0.5);
    backdrop-filter: blur(12px);
  `}
`;

const SpinIcon = styled.div`
  width: 4rem;
  height: 4rem;
  background-color: ${({ theme }) => theme.colors.primary};
  border-radius: 50%;
  ${flexCenter};
  margin: 0 auto ${({ theme }) => theme.spacing.lg};
`;

const SkeletonContainer = styled.div`
  ${flexColumn};
  gap: ${({ theme }) => theme.spacing.md};
`;

const PlaylistFallback = styled.div`
  width: 100%;
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

const PlaylistFallbackCard = styled.div`
  background-color: ${({ theme }) => theme.colors.gray[800]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.gray[700]};
`;

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const AdminSpinner = styled.div`
  animation: ${spin} 1s linear infinite;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  border: 2px solid transparent;
  border-bottom: 2px solid ${({ theme }) => theme.colors.white};
`;

const AdminOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  ${flexCenter};
  z-index: 50;
`;

const PlayerControlsContainer = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: row;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  }
`;

const PlayerTrackInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PlayerTrackName = styled.div`
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  font-size: ${({ theme }) => theme.fontSize.base};
  line-height: 1.25;
  color: ${({ theme }) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PlayerTrackArtist = styled.div`
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.colors.gray[400]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    justify-content: flex-start;
  }
`;

const ControlButtons = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;
`;

const ControlButton = styled.button.withConfig({
  shouldForwardProp: (prop) => prop !== 'isPlaying'
})<{ isPlaying?: boolean }>`
  
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
  
  ${({ isPlaying }) => isPlaying ? `
    background: rgba(34, 197, 94, 0.2);
    color: #bbf7d0;
    
    &:hover {
      background: rgba(34, 197, 94, 0.3);
    }
  ` : `
    background: rgba(115, 115, 115, 0.2);
    color: ${({ theme }) => theme.colors.white};
    
    &:hover {
      background: rgba(115, 115, 115, 0.3);
    }
  `}
`;

const VolumeButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.colors.gray[400]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(115, 115, 115, 0.2);
    color: ${({ theme }) => theme.colors.white};
  }
  
  svg {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
  }
`;

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // const [shuffleCounter, setShuffleCounter] = useState(0);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  
  const { viewMode, setVisualizerActive } = useVisualizerStore();

  const fetchTracks = async () => {
    if (window.location.pathname === '/auth/spotify/callback') {
      setIsLoading(false);
      return;
    }

    // Check if user is authenticated first
    if (!spotifyAuth.isAuthenticated()) {
      setIsLoading(false);
      setError("Redirecting to Spotify login...");
      spotifyAuth.redirectToAuth();
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      await spotifyPlayer.initialize();

      const fetchedTracks = await getSpotifyUserPlaylists();
      if (fetchedTracks.length === 0) {
        setError("No tracks found in your Spotify account. Please add music to playlists or like some songs in Spotify, then refresh this page.");
      }

      setTracks(fetchedTracks);

      if (fetchedTracks.length > 0) {
        setCurrentTrackIndex(0);
      }
    } catch (err: unknown) {
      console.error('Failed to initialize Spotify player:', err);
      if (err instanceof Error && err.message.includes('authenticated')) {
        setError("Redirecting to Spotify login...");
        spotifyAuth.redirectToAuth();
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred while fetching tracks.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      if (window.location.pathname !== '/auth/spotify/callback' && tracks.length === 0 && !isLoading) {
        fetchTracks();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [tracks.length, isLoading]);


  useEffect(() => {
    const handlePlayerStateChange = (state: SpotifyPlaybackState | null) => {
      if (state && state.track_window.current_track) {
        const currentTrack = state.track_window.current_track;
        const trackIndex = tracks.findIndex(track => track.id === currentTrack.id);

        if (trackIndex !== -1 && trackIndex !== currentTrackIndex) {
          setCurrentTrackIndex(trackIndex);
          // setShuffleCounter(0);
        }
      }
    };

    spotifyPlayer.onPlayerStateChanged(handlePlayerStateChange);
  }, [tracks, currentTrackIndex]);

  // Update visualizer active state based on view mode
  useEffect(() => {
    setVisualizerActive(viewMode === 'visualizer');
  }, [viewMode, setVisualizerActive]);

  const playTrack = useCallback(async (index: number) => {
    if (tracks[index]) {
      try {
        await spotifyPlayer.playTrack(tracks[index].uri);
        setCurrentTrackIndex(index);
      } catch (error) {
        console.error('Failed to play track:', error);
      }
    }
  }, [tracks]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(nextIndex);
    // setShuffleCounter(0);
  }, [currentTrackIndex, tracks.length, playTrack]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const prevIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
    // setShuffleCounter(0);
  }, [currentTrackIndex, tracks.length, playTrack]);

  // Memoize the current track to prevent unnecessary re-renders
  const currentTrack = useMemo(() => tracks[currentTrackIndex] || null, [tracks, currentTrackIndex]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <LoadingCard standalone>
          <CardContent>
            <SkeletonContainer>
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </SkeletonContainer>
            <p style={{ textAlign: 'center', color: 'white', marginTop: '1rem' }}>Loading music from Spotify...</p>
          </CardContent>
        </LoadingCard>
      );
    }

    if (error) {
      const isAuthError = error.includes('Redirecting to Spotify login') ||
        error.includes('No authentication token') ||
        error.includes('Authentication expired');

      if (isAuthError) {
        return (
          <LoadingCard standalone>
            <CardHeader>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', textAlign: 'center' }}>Connect to Spotify</h2>
            </CardHeader>
            <CardContent style={{ textAlign: 'center' }}>
              <p style={{ color: '#d1d5db', marginBottom: '1.5rem' }}>
                Sign in to your Spotify account to access your music. Requires Spotify Premium.
              </p>
              <Button
                onClick={() => spotifyAuth.redirectToAuth()}
                style={{ backgroundColor: '#16a34a' }}
              >
                Connect Spotify
              </Button>
            </CardContent>
          </LoadingCard>
        );
      }

      return (
        <Alert variant="destructive" style={{ width: '100%' }}>
          <AlertDescription style={{ color: '#fecaca' }}>
            Error: {error}
          </AlertDescription>
        </Alert>
      );
    }

    if (tracks.length === 0) {
      return (
        <Alert style={{ width: '100%' }}>
          <AlertDescription style={{ color: 'white', textAlign: 'center' }}>
            No tracks to play.
          </AlertDescription>
        </Alert>
      );
    }

    if (isInitialLoad) {
      return (
        <LoadingCard standalone style={{ padding: '2rem', textAlign: 'center' }}>
          <CardContent>
            <SpinIcon>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </SpinIcon>
            <HyperText duration={800} style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '1.5rem' }} as="h2">
              Vorbis Player
            </HyperText>
            <Button
              onClick={() => setIsInitialLoad(false)}
              style={{ width: '100%', backgroundColor: '#2563eb', fontSize: '1.125rem', padding: '1rem' }}
              size="lg"
            >
              Click to start
            </Button>
          </CardContent>
        </LoadingCard>
      );
    }

    return (
      <ContentWrapper>
        {/* Controls Section - Always visible */}
        <ControlsSection>
          <ViewToggle />
          {viewMode === 'visualizer' && <VisualizerSelector />}
        </ControlsSection>
        
        {/* Conditional Content Section */}
        {viewMode === 'playlist' ? (
          <PlaylistSection>
            <Suspense fallback={
              <PlaylistFallback>
                <PlaylistFallbackCard>
                  <div style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>Loading playlist...</div>
                </PlaylistFallbackCard>
              </PlaylistFallback>
            }>
              <Playlist
                tracks={tracks}
                currentTrackIndex={currentTrackIndex}
                onTrackSelect={playTrack}
              />
            </Suspense>
          </PlaylistSection>
        ) : (
          <VisualizerSection>
            <Suspense fallback={
              <div style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'rgba(255, 255, 255, 0.6)' 
              }}>
                Loading visualizer...
              </div>
            }>
              <VisualizerCanvas />
              <SpotifyAudioBridge />
            </Suspense>
          </VisualizerSection>
        )}
        
        {/* Audio Player Controls - Always visible at bottom */}
        <LoadingCard backgroundImage={currentTrack?.image}>
          <CardContent style={{ padding: '1rem' }}>
            <SpotifyPlayerControls
              currentTrack={currentTrack}
              onPlay={() => spotifyPlayer.resume()}
              onPause={() => spotifyPlayer.pause()}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          </CardContent>
        </LoadingCard>
      </ContentWrapper>
    );
  };

  return (
    <Container>
      <Suspense fallback={null}>
        <AdminKeyCombo onActivate={() => setShowAdminPanel(true)} />
      </Suspense>

      {renderContent()}

      {showAdminPanel && (
        <Suspense fallback={
          <AdminOverlay>
            <AdminSpinner></AdminSpinner>
          </AdminOverlay>
        }>
          <VideoAdmin onClose={() => setShowAdminPanel(false)} />
        </Suspense>
      )}
    </Container>
  );
};

const SpotifyPlayerControls = memo<{
  currentTrack: Track | null;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}>(({ currentTrack, onPlay, onPause, onNext, onPrevious }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const checkPlaybackState = async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
      }
    };

    const interval = setInterval(checkPlaybackState, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Set volume to 100% on initialization
    spotifyPlayer.setVolume(1.0);
  }, []);

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    spotifyPlayer.setVolume(newMutedState ? 0 : 1.0);
  };

  return (
    <PlayerControlsContainer>
      {/* Track Info */}
      <PlayerTrackInfo>
        <PlayerTrackName>{currentTrack?.name || 'No track selected'}</PlayerTrackName>
        <PlayerTrackArtist>{currentTrack?.artists || ''}</PlayerTrackArtist>
      </PlayerTrackInfo>

      {/* Controls Row */}
      <ControlsRow>
        {/* Control Buttons */}
        <ControlButtons>
          <ControlButton onClick={onPrevious}>
            <svg viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </ControlButton>

          <ControlButton isPlaying={isPlaying} onClick={handlePlayPause}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </ControlButton>

          <ControlButton onClick={onNext}>
            <svg viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </ControlButton>
        </ControlButtons>

        {/* Volume */}
        <VolumeButton onClick={handleMuteToggle}>
          {isMuted ? (
            <svg viewBox="0 0 24 24">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </VolumeButton>
      </ControlsRow>
    </PlayerControlsContainer>
  );
});

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default AudioPlayerComponent;
