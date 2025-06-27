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
import { Slider } from '../components/styled';
import { flexCenter, flexBetween, flexColumn, cardBase } from '../styles/utils';

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
  max-width: 32rem; /* max-w-2xl */
  
  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    max-width: 56rem; /* max-w-4xl */
  }
  
  @media (min-width: ${({ theme }) => theme.breakpoints.xl}) {
    max-width: 64rem; /* max-w-5xl */
  }
`;

const PlaylistSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.md};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    margin-bottom: ${({ theme }) => theme.spacing.lg};
  }
  
  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    margin-bottom: ${({ theme }) => theme.spacing.xl};
  }
`;

const LoadingCard = styled(Card)`
  ${cardBase};
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 28rem;
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
  max-width: 56rem;
  margin: 0 auto;
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
  ${flexColumn};
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
`;

const TrackInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const TrackName = styled.p`
  color: ${({ theme }) => theme.colors.white};
  font-weight: ${({ theme }) => theme.fontWeight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TrackArtist = styled.p`
  color: ${({ theme }) => theme.colors.gray[400]};
  font-size: ${({ theme }) => theme.fontSize.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ControlsRow = styled.div`
  ${flexBetween};
`;

const ControlsLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const VolumeControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const VolumeIcon = styled.span`
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.sm};
`;

const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shuffleCounter, setShuffleCounter] = useState(0);
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
          setShuffleCounter(0);
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
    setShuffleCounter(0);
  }, [currentTrackIndex, tracks.length, playTrack]);

  const handlePrevious = useCallback(() => {
    if (tracks.length === 0) return;
    const prevIndex = currentTrackIndex === 0 ? tracks.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
    setShuffleCounter(0);
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
        <Alert variant="destructive" style={{ maxWidth: '28rem', width: '100%' }}>
          <AlertDescription style={{ color: '#fecaca' }}>
            Error: {error}
          </AlertDescription>
        </Alert>
      );
    }

    if (tracks.length === 0) {
      return (
        <Alert style={{ maxWidth: '28rem', width: '100%' }}>
          <AlertDescription style={{ color: 'white', textAlign: 'center' }}>
            No tracks to play.
          </AlertDescription>
        </Alert>
      );
    }

    if (isInitialLoad) {
      return (
        <LoadingCard style={{ padding: '2rem', textAlign: 'center', maxWidth: '28rem', margin: '0 1rem' }}>
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
          <CardContent style={{ padding: '0.5rem' }}>
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

  return (
    <PlayerControlsContainer>
      {/* Track Info */}
      <TrackInfo>
        <TrackName>{currentTrack?.name || 'No track selected'}</TrackName>
        <TrackArtist>{currentTrack?.artists || ''}</TrackArtist>
      </TrackInfo>

      {/* Controls */}
      <ControlsRow>
        <ControlsLeft>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrevious}
            style={{ color: 'white' }}
          >
            ⏮️
          </Button>

          <Button
            onClick={handlePlayPause}
            style={{ backgroundColor: '#16a34a', color: 'white', borderRadius: '50%', padding: '0.5rem' }}
            size="sm"
          >
            {isPlaying ? '⏸️' : '▶️'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onNext}
            style={{ color: 'white' }}
          >
            ⏭️
          </Button>
        </ControlsLeft>

        <VolumeControls>
          <VolumeIcon>🔊</VolumeIcon>
          <Slider
            value={[volume]}
            onValueChange={(value) => handleVolumeChange(value[0])}
            max={100}
            min={0}
            step={1}
            style={{ width: '5rem' }}
          />
        </VolumeControls>
      </ControlsRow>
    </PlayerControlsContainer>
  );
});

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default AudioPlayerComponent;
