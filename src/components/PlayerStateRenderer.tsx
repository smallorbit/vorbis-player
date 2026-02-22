import React, { Suspense } from 'react';
import styled, { keyframes } from 'styled-components';
import { spotifyAuth, type Track } from '../services/spotify';
import { Card, CardHeader, CardContent } from '../components/styled';
import { Button } from '../components/styled';
import { Alert, AlertDescription } from '../components/styled';
import { flexColumn, cardBase } from '../styles/utils';
import { theme } from '@/styles/theme';

const PlaylistSelection = React.lazy(() => import('./PlaylistSelection'));

// Improved loading animations
const pulseWave = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

const LoadingCard = styled(Card)<{ backgroundImage?: string; standalone?: boolean }>`
  ${cardBase};
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.shadows.albumArt};
  
  ${({ theme, backgroundImage }) => backgroundImage ? `
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
      background: ${theme.colors.card.overlay};
      backdrop-filter: blur(24px);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: ${theme.colors.muted.background};
    backdrop-filter: blur(12px);
  `}
`;

const LoadingContainer = styled.div`
  ${flexColumn};
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  z-index: 2;
  position: relative;
`;

const SpotifyIcon = styled.div`
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.spotify}, ${({ theme }) => theme.colors.spotifyLight});
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  animation: ${pulseWave} 2s ease-in-out infinite;
  box-shadow: ${({ theme }) => theme.shadows.spotify};
  
  &::before {
    content: '♪';
    color: ${({ theme }) => theme.colors.white};
    font-size: ${({ theme }) => theme.fontSize['2xl']};
    font-weight: ${({ theme }) => theme.fontWeight.bold};
  }
`;

const LoadingText = styled.div`
  text-align: center;
  animation: ${fadeInUp} 0.6s ease-out;
`;

const LoadingTitle = styled.h3`
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSize.xl};
  font-weight: ${({ theme }) => theme.fontWeight.semibold};
  margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.muted.foreground},
    ${({ theme }) => theme.colors.white},
    ${({ theme }) => theme.colors.muted.foreground}
  );
  background-size: 200px 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${shimmer} 2s infinite linear;
`;

const LoadingSubtext = styled.p`
  color: ${({ theme }) => theme.colors.muted.foreground};
  font-size: ${({ theme }) => theme.fontSize.sm};
  margin: 0;
  line-height: 1.4;
`;

const ProgressBar = styled.div`
  width: 200px;
  height: 3px;
  background: ${({ theme }) => theme.colors.control.background};
  border-radius: 1.5px;
  margin-top: 1.5rem;
  position: relative;
  overflow: hidden;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, #1db954, transparent);
    animation: ${shimmer} 1.5s infinite linear;
  }
`;

interface PlayerStateRendererProps {
  isLoading: boolean;
  error: string | null;
  selectedPlaylistId: string | null;
  tracks: Track[];
  onPlaylistSelect: (playlistId: string) => void;
}

const PlayerStateRenderer: React.FC<PlayerStateRendererProps> = ({
  isLoading,
  error,
  selectedPlaylistId,
  tracks,
  onPlaylistSelect
}) => {
  // Show loading state
  if (isLoading) {
    return (
      <LoadingCard standalone>
        <LoadingContainer>
          <SpotifyIcon />
          <LoadingText>
            <LoadingTitle>Loading Your Music</LoadingTitle>
            <LoadingSubtext>Connecting to Spotify and preparing your tracks</LoadingSubtext>
          </LoadingText>
          <ProgressBar />
        </LoadingContainer>
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
              Connect to Spotify
            </h2>
          </CardHeader>
          <CardContent style={{ textAlign: 'center' }}>
            <p style={{ color: theme.colors.gray[300], marginBottom: theme.spacing.lg }}>
              Sign in to your Spotify account to access your music. Requires Spotify Premium.
            </p>
            <Button
              onClick={() => spotifyAuth.redirectToAuth()}
              style={{ backgroundColor: theme.colors.accent }}
            >
              Connect Spotify
            </Button>
          </CardContent>
        </LoadingCard>
      );
    }

    return (
      <Alert variant="destructive" style={{ width: '100%' }}>
        <AlertDescription style={{ color: theme.colors.errorText }}>
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
          <LoadingContainer>
            <SpotifyIcon />
            <LoadingText>
              <LoadingTitle>Loading Your Library</LoadingTitle>
              <LoadingSubtext>Discovering your playlists and albums</LoadingSubtext>
            </LoadingText>
            <ProgressBar />
          </LoadingContainer>
        </LoadingCard>
      }>
        <PlaylistSelection onPlaylistSelect={onPlaylistSelect} />
      </Suspense>
    );
  }

  // Return null when ready to show main player
  return null;
};

export default PlayerStateRenderer;