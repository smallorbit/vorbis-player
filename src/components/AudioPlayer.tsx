import { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import styled, { keyframes } from 'styled-components';
const Playlist = lazy(() => import('./Playlist'));
// import MediaCollage from './MediaCollage';
const VideoAdmin = lazy(() => import('./admin/VideoAdmin'));
const AdminKeyCombo = lazy(() => import('./admin/AdminKeyCombo'));
import { getSpotifyUserPlaylists, spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import { HyperText } from './hyper-text';
import { Card, CardHeader, CardContent } from '../components/styled';
import { Button } from '../components/styled';
import { Skeleton } from '../components/styled';
import { Alert, AlertDescription } from '../components/styled';
import { flexCenter, flexColumn, cardBase } from '../styles/utils';

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
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const LoadingCard = styled(Card)`
  ${cardBase};
  background: rgba(38, 38, 38, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(115, 115, 115, 0.5);
  border-radius: 0 0 ${({ theme }) => theme.borderRadius.lg} ${({ theme }) => theme.borderRadius.lg};
  border-top: none;
  width: 100%;
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
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
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

const ControlButtons = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-shrink: 0;
`;

const ControlButton = styled.button<{ isPlaying?: boolean }>`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  svg {
    width: 1rem;
    height: 1rem;
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

const VolumeSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  flex-shrink: 0;
  min-width: 0;
`;

const VolumeIcon = styled.div`
  color: ${({ theme }) => theme.colors.gray[400]};
  display: flex;
  align-items: center;
  
  svg {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
  }
`;

const VolumeSlider = styled.div`
  position: relative;
  width: 2.5rem;
  height: 0.25rem;
  background: rgba(115, 115, 115, 0.3);
  border-radius: 0.125rem;
  cursor: pointer;
`;

const VolumeProgress = styled.div<{ percentage: number }>`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: ${({ percentage }) => percentage}%;
  background: rgba(34, 197, 94, 0.8);
  border-radius: 0.125rem;
  transition: all 0.1s ease;
`;

const VolumeThumb = styled.div<{ percentage: number }>`
  position: absolute;
  top: 50%;
  left: ${({ percentage }) => percentage}%;
  transform: translate(-50%, -50%);
  width: 0.75rem;
  height: 0.75rem;
  background: #bbf7d0;
  border-radius: 50%;
  opacity: 0;
  transition: all 0.1s ease;
  
  ${VolumeSlider}:hover & {
    opacity: 1;
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
        <LoadingCard>
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
          <LoadingCard>
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
        <LoadingCard style={{ padding: '2rem', textAlign: 'center' }}>
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
        {/* <MediaCollage
          currentTrack={currentTrack}
          shuffleCounter={shuffleCounter}
        /> */}
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
        <LoadingCard>
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
  const [volume, setVolume] = useState(50);

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

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    spotifyPlayer.setVolume(newVolume / 100);
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    const newVolume = Math.max(0, Math.min(100, percentage));
    handleVolumeChange(newVolume);
  };

  return (
    <PlayerControlsContainer>
      {/* Track Info */}
      <PlayerTrackInfo>
        <PlayerTrackName>{currentTrack?.name || 'No track selected'}</PlayerTrackName>
        <PlayerTrackArtist>{currentTrack?.artists || ''}</PlayerTrackArtist>
      </PlayerTrackInfo>

      {/* Control Buttons */}
      <ControlButtons>
        <ControlButton onClick={onPrevious}>
          <svg viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </ControlButton>

        <ControlButton isPlaying={isPlaying} onClick={handlePlayPause}>
          {isPlaying ? (
            <svg viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </ControlButton>

        <ControlButton onClick={onNext}>
          <svg viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </ControlButton>
      </ControlButtons>

      {/* Volume */}
      <VolumeSection>
        <VolumeIcon>
          <svg viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </VolumeIcon>
        <VolumeSlider onClick={handleVolumeClick}>
          <VolumeProgress percentage={volume} />
          <VolumeThumb percentage={volume} />
        </VolumeSlider>
      </VolumeSection>
    </PlayerControlsContainer>
  );
});

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default AudioPlayerComponent;
