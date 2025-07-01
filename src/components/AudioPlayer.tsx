import { useState, useEffect, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import styled, { keyframes } from 'styled-components';
const Playlist = lazy(() => import('./Playlist'));
const VideoAdmin = lazy(() => import('./admin/VideoAdmin'));
const AdminKeyCombo = lazy(() => import('./admin/AdminKeyCombo'));
const PlaylistSelection = lazy(() => import('./PlaylistSelection'));
import { getPlaylistTracks, spotifyAuth } from '../services/spotify';
import { spotifyPlayer } from '../services/spotifyPlayer';
import type { Track } from '../services/spotify';
import { Card, CardHeader, CardContent } from '../components/styled';
import PlaylistIcon from './PlaylistIcon';
import SettingsIcon from './SettingsIcon';
import SettingsModal from './SettingsModal';
import { Button } from '../components/styled';
import { Skeleton } from '../components/styled';
import { Alert, AlertDescription } from '../components/styled';
import { flexCenter, flexColumn, cardBase } from '../styles/utils';
import VideoPlayer from './VideoPlayer';
import VolumeModal from './VolumeModal';
import { extractDominantColor, getTransparentVariant } from '../utils/colorExtractor';

// Styled components
const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  ${flexCenter};
  padding: ${({ theme }: any) => theme.spacing.sm};
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.sm}) {
    padding: ${({ theme }: any) => theme.spacing.md};
  }
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 48rem; /* 768px - matches playlist and video nicely */
  margin: 0 auto;
  padding-left: 1rem;
  padding-right: 1rem;
  box-sizing: border-box;
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.lg}) {
    max-width: 60rem;
  }
  @media (min-width: ${({ theme }: any) => theme.breakpoints.xl}) {
    max-width: 72rem;
  }
`;


const PlaylistDrawer = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(10px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateX(${props => props.isOpen ? '0' : '100%'});
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow-y: auto;
  padding: 1rem;
  box-sizing: border-box;
  
  @media (max-width: 480px) {
    width: 100vw;
  }
`;

const PlaylistContent = styled.div`
  padding: 0.5rem 0 1rem 0;
  
  /* Ensure playlist cards have proper spacing from top and bottom */
  > div:first-child {
    margin-top: 0;
  }
  
  > div:last-child {
    margin-bottom: 0;
  }
`;

const PlaylistOverlay = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 999;
`;

const PlaylistHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const PlaylistTitle = styled.h3`
  color: white;
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;


const LoadingCard = styled(Card) <{ backgroundImage?: string; standalone?: boolean }>`
  ${cardBase};
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(115, 115, 115, 0.5);
  border-radius: 1.25rem;
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
      border-radius: 1.25rem;
      z-index: 0;
    }
    
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: rgba(38, 38, 38, 0.5);
    backdrop-filter: blur(12px);
  `}
`;


const SkeletonContainer = styled.div`
  ${flexColumn};
  gap: ${({ theme }: any) => theme.spacing.md};
`;

const PlaylistFallback = styled.div`
  width: 100%;
  margin-top: ${({ theme }: any) => theme.spacing.lg};
`;

const PlaylistFallbackCard = styled.div`
  background-color: ${({ theme }: any) => theme.colors.gray[800]};
  border-radius: 1.25rem;
  padding: ${({ theme }: any) => theme.spacing.md};
  border: 1px solid ${({ theme }: any) => theme.colors.gray[700]};
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
  border-bottom: 2px solid ${({ theme }: any) => theme.colors.white};
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
  gap: ${({ theme }: any) => theme.spacing.sm};
  padding: ${({ theme }: any) => theme.spacing.md} ${({ theme }: any) => theme.spacing.md} ${({ theme }: any) => theme.spacing.sm} ${({ theme }: any) => theme.spacing.md};
`;

const PlayerTrackInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PlayerTrackName = styled.div`
  font-weight: ${({ theme }: any) => theme.fontWeight.semibold};
  font-size: ${({ theme }: any) => theme.fontSize.base};
  line-height: 1.25;
  color: ${({ theme }: any) => theme.colors.white};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PlayerTrackArtist = styled.div`
  font-size: ${({ theme }: any) => theme.fontSize.sm};
  margin-top: ${({ theme }: any) => theme.spacing.xs};
  color: ${({ theme }: any) => theme.colors.gray[400]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }: any) => theme.spacing.md};
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.md}) {
    justify-content: flex-start;
  }
`;

const TrackInfoRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: any) => theme.spacing.md};
  
  @media (min-width: ${({ theme }: any) => theme.breakpoints.md}) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

const ControlButtons = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.sm};
  flex-shrink: 0;
`;

const ControlButton = styled.button<{ isPlaying?: boolean; accentColor: string }>`
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0.5rem;
  border-radius: 0.375rem;
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
  
  ${({ isPlaying, accentColor }) => isPlaying ? `
    background: ${getTransparentVariant(accentColor, 0.2)};
    color: ${accentColor};
    
    &:hover {
      background: ${getTransparentVariant(accentColor, 0.3)};
    }
  ` : `
    background: rgba(115, 115, 115, 0.2);
    color: white;
    
    &:hover {
      background: rgba(115, 115, 115, 0.3);
    }
  `}
`;

const VolumeButton = styled.button`

  border: none;
  background: transparent;
  color: ${({ theme }: any) => theme.colors.gray[400]};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(115, 115, 115, 0.2);
    color: ${({ theme }: any) => theme.colors.white};
  }
  
  svg {
    width: 1.5rem;
    height: 1.5rem;
    fill: currentColor;
  }
`;

const TimelineContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme.spacing.sm};
  width: 100%;
  margin: ${({ theme }: any) => theme.spacing.sm} 0;
`;

const TimelineSlider = styled.input<{ accentColor: string }>`
  flex: 1;
  height: 4px;
  background: rgba(115, 115, 115, 0.3);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: ${props => props.accentColor} !important;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: none;
    transition: all 0.2s ease;
    
    &:hover {
      transform: scale(1.2);
    }
  }
  
  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: ${props => props.accentColor} !important;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: none;
    transition: all 0.2s ease;
    
    &:hover {
      transform: scale(1.2);
    }
  }
  
  /* Progress fill effect */
  background: linear-gradient(
    to right,
    ${props => props.accentColor} 0%,
    ${props => props.accentColor} ${props => (props.value / props.max) * 100}%,
    rgba(115, 115, 115, 0.3) ${props => (props.value / props.max) * 100}%,
    rgba(115, 115, 115, 0.3) 100%
  );
`;

const TimeLabel = styled.span`
  color: ${({ theme }: any) => theme.colors.gray[400]};
  font-size: ${({ theme }: any) => theme.fontSize.sm};
  font-family: monospace;
  min-width: 40px;
  text-align: center;
`;

const VideoPlayerContainer = styled.div`
  margin: ${({ theme }: any) => theme.spacing.md} ${({ theme }: any) => theme.spacing.md} ${({ theme }: any) => theme.spacing.lg} ${({ theme }: any) => theme.spacing.md};
  
  /* Handle empty state when no embeddable videos */
  &:empty {
    display: none;
  }
`;


const AudioPlayerComponent = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistName, setSelectedPlaylistName] = useState<string>('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoRefreshKey, setVideoRefreshKey] = useState(0);
  const [accentColor, setAccentColor] = useState<string>('goldenrod');

  const handlePlaylistSelect = async (playlistId: string, playlistName: string) => {
    try {
      setError(null);
      setIsLoading(true);
      setSelectedPlaylistId(playlistId);
      setSelectedPlaylistName(playlistName);

      console.log('🎵 Loading tracks from playlist:', playlistName);

      // Initialize Spotify player
      await spotifyPlayer.initialize();

      // Ensure our device is the active player
      try {
        await spotifyPlayer.transferPlaybackToDevice();
        console.log('🎵 Ensured our device is active for playback');
      } catch (error) {
        console.log('🎵 Could not transfer playback, will attempt during first play:', error);
      }

      // Fetch tracks from the selected playlist
      const fetchedTracks = await getPlaylistTracks(playlistId);

      if (fetchedTracks.length === 0) {
        setError("No tracks found in this playlist.");
        return;
      }

      setTracks(fetchedTracks);
      setCurrentTrackIndex(0);

      console.log(`🎵 Loaded ${fetchedTracks.length} tracks, starting playback...`);

      // Start playing the first track (user interaction has occurred)
      setTimeout(async () => {
        try {
          console.log('🎵 Attempting to start playback after playlist selection...');
          await playTrack(0);
          console.log('🎵 Playback started successfully after playlist selection!');

          // Check playback state after a delay and try to recover
          setTimeout(async () => {
            const state = await spotifyPlayer.getCurrentState();
            console.log('🎵 Post-start playback check:', {
              paused: state?.paused,
              position: state?.position,
              trackName: state?.track_window?.current_track?.name,
              playerReady: spotifyPlayer.getIsReady(),
              deviceId: spotifyPlayer.getDeviceId()
            });

            // If state is undefined, the player might not be active - try to activate it
            if (!state || !state.track_window?.current_track) {
              console.log('🎵 No player state detected, attempting to transfer playback to our device...');
              try {
                const token = await spotifyAuth.ensureValidToken();
                const deviceId = spotifyPlayer.getDeviceId();

                if (deviceId) {
                  // Transfer playback to our device
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

                  console.log('🎵 Transferred playback to our device');

                  // Try playing the track again
                  setTimeout(async () => {
                    try {
                      await playTrack(0);
                      console.log('🎵 Retried playback after device transfer');
                    } catch (error) {
                      console.error('🎵 Failed to retry playback:', error);
                    }
                  }, 1000);
                }
              } catch (error) {
                console.error('🎵 Failed to transfer playback:', error);
              }
            }
          }, 2000);
        } catch (error) {
          console.error('🎵 Failed to start playback:', error);
        }
      }, 1500);

    } catch (err: unknown) {
      console.error('Failed to load playlist tracks:', err);
      if (err instanceof Error && err.message.includes('authenticated')) {
        setError("Authentication expired. Redirecting to Spotify login...");
        spotifyAuth.redirectToAuth();
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred while loading tracks.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Spotify auth redirect when component mounts
  useEffect(() => {
    const handleAuthRedirect = async () => {
      try {
        await spotifyAuth.handleRedirect();
      } catch (error) {
        console.error('Auth redirect error:', error);
        setError(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    handleAuthRedirect();
  }, []);



  const playTrack = useCallback(async (index: number) => {
    if (tracks[index]) {
      try {
        console.log('🎵 Attempting to play track:', {
          index,
          trackName: tracks[index].name,
          uri: tracks[index].uri,
          playerReady: spotifyPlayer.getIsReady(),
          deviceId: spotifyPlayer.getDeviceId()
        });

        // Check if we have valid authentication
        const isAuthenticated = spotifyAuth.isAuthenticated();
        console.log('🎵 Authentication status:', isAuthenticated);

        if (!isAuthenticated) {
          console.error('🎵 Not authenticated with Spotify');
          return;
        }

        await spotifyPlayer.playTrack(tracks[index].uri);
        setCurrentTrackIndex(index);
        console.log('🎵 playTrack call completed');

        // Check if playback actually started after a delay
        setTimeout(async () => {
          const state = await spotifyPlayer.getCurrentState();
          if (state?.paused && state.position === 0) {
            console.log('🎵 Track appears to be paused after play call, attempting resume...');
            try {
              await spotifyPlayer.resume();
              console.log('🎵 Resume attempted');
            } catch (resumeError) {
              console.error('🎵 Failed to resume:', resumeError);
            }
          }
        }, 1000);

      } catch (error) {
        console.error('🎵 Failed to play track:', error);
        console.error('🎵 Error details:', {
          error: error.message,
          playerReady: spotifyPlayer.getIsReady(),
          deviceId: spotifyPlayer.getDeviceId(),
          trackUri: tracks[index].uri
        });
      }
    }
  }, [tracks]);

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

          // Log current state periodically for debugging
          if (Math.random() < 0.2) { // Log 20% of the time
            console.log('🎵 Playback state:', {
              trackName: currentTrack.name,
              position: Math.round(position / 1000) + 's',
              duration: Math.round(duration / 1000) + 's',
              timeRemaining: Math.round(timeRemaining / 1000) + 's',
              paused: state.paused
            });
          }

          // Check if song has ended (within 2 seconds of completion OR position at end)
          if (!hasEnded && duration > 0 && position > 0 && (
            timeRemaining <= 2000 || // Within 2 seconds of end
            position >= duration - 1000 // Within 1 second of end
          )) {
            console.log('🎵 Song ending detected! Auto-advancing...', {
              timeRemaining: timeRemaining + 'ms',
              position: position + 'ms',
              duration: duration + 'ms',
              currentTrack: currentTrack.name
            });

            hasEnded = true; // Prevent multiple triggers

            // Auto-advance to next track
            const nextIndex = (currentTrackIndex + 1) % tracks.length;
            if (tracks[nextIndex]) {
              console.log(`🎵 Playing next track: ${tracks[nextIndex].name}`);
              setTimeout(() => {
                playTrack(nextIndex);
                hasEnded = false; // Reset for next track
              }, 500);
            }
          }
        }
      } catch (error) {
        console.error('Error checking for song end:', error);
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

  // Extract dominant color from album art when track changes
  useEffect(() => {
    const extractColor = async () => {
      if (currentTrack?.image) {
        try {
          const dominantColor = await extractDominantColor(currentTrack.image);
          if (dominantColor) {
            setAccentColor(dominantColor.hex);
          } else {
            setAccentColor('goldenrod'); // Fallback
          }
        } catch (error) {
          console.error('Failed to extract color from album art:', error);
          setAccentColor('goldenrod'); // Fallback
        }
      } else {
        setAccentColor('goldenrod'); // Fallback when no image
      }
    };

    extractColor();
  }, [currentTrack?.image]);

  const renderContent = () => {
    // Show loading state
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

    // Handle authentication errors
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
                style={{ backgroundColor: 'goldenrod' }}
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

    // Show playlist selection when no playlist is selected
    if (!selectedPlaylistId || tracks.length === 0) {
      return (
        <Suspense fallback={
          <LoadingCard standalone>
            <CardContent>
              <SkeletonContainer>
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </SkeletonContainer>
              <p style={{ textAlign: 'center', color: 'white', marginTop: '1rem' }}>Loading playlist selection...</p>
            </CardContent>
          </LoadingCard>
        }>
          <PlaylistSelection onPlaylistSelect={handlePlaylistSelect} />
        </Suspense>
      );
    }


    return (
      <ContentWrapper>
        <div style={{ marginTop: '1.5rem' }}>
          <LoadingCard backgroundImage={currentTrack?.image}>

            <CardContent style={{ padding: '0.5rem', position: 'relative', zIndex: 2 }}>
              <VideoPlayerContainer>
                <Suspense fallback={<div style={{ minHeight: 320 }}>Loading video player...</div>}>
                  <VideoPlayer key={videoRefreshKey} currentTrack={currentTrack} />
                </Suspense>
              </VideoPlayerContainer>

              <SpotifyPlayerControls
                currentTrack={currentTrack}
                accentColor={accentColor}
                onPlay={() => spotifyPlayer.resume()}
                onPause={() => spotifyPlayer.pause()}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onShowPlaylist={() => setShowPlaylist(true)}
                onShowSettings={() => setShowSettings(true)}
                trackCount={tracks.length}
              />
            </CardContent>
          </LoadingCard>
        </div>

        <PlaylistOverlay
          isOpen={showPlaylist}
          onClick={() => setShowPlaylist(false)}
        />

        <PlaylistDrawer isOpen={showPlaylist}>
          <PlaylistHeader>
            <PlaylistTitle>Playlist ({tracks.length} tracks)</PlaylistTitle>
            <CloseButton onClick={() => setShowPlaylist(false)}>×</CloseButton>
          </PlaylistHeader>

          <PlaylistContent>
            <Suspense fallback={<PlaylistFallback><PlaylistFallbackCard><div style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center' }}>Loading playlist...</div></PlaylistFallbackCard></PlaylistFallback>}>
              <Playlist
                tracks={tracks}
                currentTrackIndex={currentTrackIndex}
                accentColor={accentColor}
                onTrackSelect={(index) => {
                  playTrack(index);
                  setShowPlaylist(false); // Close drawer after selecting track
                }}
              />
            </Suspense>
          </PlaylistContent>
        </PlaylistDrawer>

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


      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentTrack={currentTrack}
        accentColor={accentColor}
        onVideoChanged={() => {
          // Force VideoPlayer to refresh by changing its key
          setVideoRefreshKey(prev => prev + 1);
        }}
      />
    </Container>
  );
};

const SpotifyPlayerControls = memo<{
  currentTrack: Track | null;
  accentColor: string;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowPlaylist: () => void;
  onShowSettings: () => void;
  trackCount: number;
}>(({ currentTrack, accentColor, onPlay, onPause, onNext, onPrevious, onShowPlaylist, onShowSettings, trackCount }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [previousVolume, setPreviousVolume] = useState(50);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const checkPlaybackState = async () => {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        setIsPlaying(!state.paused);
        if (!isDragging) {
          setCurrentPosition(state.position);
        }
        if (state.track_window.current_track) {
          setDuration(state.track_window.current_track.duration_ms);
        }
      }
    };

    const interval = setInterval(checkPlaybackState, 1000);
    return () => clearInterval(interval);
  }, [isDragging]);

  useEffect(() => {
    // Set initial volume to 50%
    spotifyPlayer.setVolume(0.5);
    setVolume(50);
    setPreviousVolume(50);
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

    if (newMutedState) {
      // Store current volume before muting
      setPreviousVolume(volume);
      spotifyPlayer.setVolume(0);
    } else {
      // Restore previous volume when unmuting
      const volumeToRestore = previousVolume > 0 ? previousVolume : 50;
      setVolume(volumeToRestore);
      spotifyPlayer.setVolume(volumeToRestore / 100);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    spotifyPlayer.setVolume(newVolume / 100);

    // Auto-unmute if volume is changed from 0
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }

    // Auto-mute if volume is set to 0
    if (newVolume === 0 && !isMuted) {
      setIsMuted(true);
    }
  };

  const handleVolumeButtonClick = () => {
    setShowVolumeModal(true);
  };

  const handleSeek = async (position: number) => {
    try {
      const token = await spotifyAuth.ensureValidToken();
      const deviceId = spotifyPlayer.getDeviceId();

      if (!deviceId) {
        console.error('No device ID available for seeking');
        return;
      }

      await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(position)}&device_id=${deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const position = parseInt(e.target.value);
    setCurrentPosition(position);
  };

  const handleSliderMouseDown = () => {
    setIsDragging(true);
  };

  const handleSliderMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    const position = parseInt((e.target as HTMLInputElement).value);
    setIsDragging(false);
    handleSeek(position);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <PlayerControlsContainer>
      {/* Track Info and Controls Row */}
      <TrackInfoRow>
        <PlayerTrackInfo>
          <PlayerTrackName>{currentTrack?.name || 'No track selected'}</PlayerTrackName>
          <PlayerTrackArtist>{currentTrack?.artists || ''}</PlayerTrackArtist>
        </PlayerTrackInfo>

        {/* Control Buttons and Volume */}
        <ControlsRow>
          {/* Control Buttons */}
          <ControlButtons>
            <ControlButton accentColor={accentColor} onClick={onPrevious}>
              <svg viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </ControlButton>

            <ControlButton accentColor={accentColor} isPlaying={isPlaying} onClick={handlePlayPause}>
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

            <ControlButton accentColor={accentColor} onClick={onNext}>
              <svg viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </ControlButton>

            <ControlButton accentColor={accentColor} onClick={onShowPlaylist}>
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
              </svg>
            </ControlButton>

            <ControlButton accentColor={accentColor} onClick={onShowSettings}>
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.22,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.22,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" />
              </svg>
            </ControlButton>
          </ControlButtons>

          {/* Volume */}
          <VolumeButton onClick={handleVolumeButtonClick}>
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
      </TrackInfoRow>

      {/* Timeline Slider */}
      <TimelineContainer>
        <TimeLabel>{formatTime(currentPosition)}</TimeLabel>
        <TimelineSlider
          type="range"
          min="0"
          max={duration}
          value={currentPosition}
          accentColor={accentColor}
          onChange={handleSliderChange}
          onMouseDown={handleSliderMouseDown}
          onMouseUp={handleSliderMouseUp}
        />
        <TimeLabel>{formatTime(duration)}</TimeLabel>
      </TimelineContainer>

      <VolumeModal
        isOpen={showVolumeModal}
        onClose={() => setShowVolumeModal(false)}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        isMuted={isMuted}
        onMuteToggle={handleMuteToggle}
        accentColor={accentColor}
      />
    </PlayerControlsContainer>
  );
});

SpotifyPlayerControls.displayName = 'SpotifyPlayerControls';

export default AudioPlayerComponent;
