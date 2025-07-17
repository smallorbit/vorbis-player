import React, { Suspense } from 'react';
import styled from 'styled-components';
import { spotifyAuth } from '../services/spotify';
import { Card, CardHeader, CardContent } from '../components/styled';
import { Button } from '../components/styled';
import { Skeleton } from '../components/styled';
import { Alert, AlertDescription } from '../components/styled';
import { flexColumn, cardBase } from '../styles/utils';
import { theme } from '@/styles/theme';

const PlaylistSelection = React.lazy(() => import('./PlaylistSelection'));

const LoadingCard = styled(Card)<{ backgroundImage?: string; standalone?: boolean }>`
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

const SkeletonContainer = styled.div`
  ${flexColumn};
  gap: ${({ theme }: any) => theme.spacing.md};
`;

interface PlayerStateRendererProps {
  isLoading: boolean;
  error: string | null;
  selectedPlaylistId: string | null;
  tracks: any[];
  onPlaylistSelect: (playlistId: string, playlistName?: string) => void;
}

export const PlayerStateRenderer: React.FC<PlayerStateRendererProps> = ({
  isLoading,
  error,
  selectedPlaylistId,
  tracks,
  onPlaylistSelect
}) => {
  const handlePlaylistSelect = (playlistId: string, playlistName: string) => {
    onPlaylistSelect(playlistId, playlistName);
  };
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
          <p style={{ textAlign: 'center', color: 'white', marginTop: '1rem' }}>
            Loading music from Spotify...
          </p>
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
              Connect to Spotify
            </h2>
          </CardHeader>
          <CardContent style={{ textAlign: 'center' }}>
            <p style={{ color: '#d1d5db', marginBottom: '1.5rem' }}>
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
            <p style={{ textAlign: 'center', color: 'white', marginTop: '1rem' }}>
              Loading playlist selection...
            </p>
          </CardContent>
        </LoadingCard>
      }>
        <PlaylistSelection onPlaylistSelect={handlePlaylistSelect} />
      </Suspense>
    );
  }

  // Return null when ready to show main player
  return null;
};

export default PlayerStateRenderer;