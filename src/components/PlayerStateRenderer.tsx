import React, { Suspense, useCallback, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import type { MediaTrack } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';
import { Card, CardHeader, CardContent } from '../components/styled';
import { Button } from '../components/styled';
import { Alert, AlertDescription } from '../components/styled';
import { flexColumn, cardBase } from '../styles/utils';
import { theme } from '@/styles/theme';
import { useProviderContext } from '@/contexts/ProviderContext';
import QuickAccessPanel from './QuickAccessPanel';

const PlaylistSelection = React.lazy(() => import('./PlaylistSelection'));

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

const MusicIcon = styled.div`
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary}, ${({ theme }) => theme.colors.primaryHover});
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  animation: ${pulseWave} 2s ease-in-out infinite;
  box-shadow: 0 8px 32px ${({ theme }) => theme.colors.primary}4d;

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
    background: linear-gradient(90deg, transparent, ${({ theme }) => theme.colors.primary}, transparent);
    animation: ${shimmer} 1.5s infinite linear;
  }
`;

interface PlayerStateRendererProps {
  isLoading: boolean;
  error: string | null;
  selectedPlaylistId: string | null;
  tracks: MediaTrack[];
  onPlaylistSelect: (playlistId: string, playlistName?: string, provider?: import('@/types/domain').ProviderId) => void;
  onAddToQueue: (id: string, name?: string, provider?: import('@/types/domain').ProviderId) => void;
  lastSession: SessionSnapshot | null;
  onResume: () => void;
}

const PlayerStateRenderer: React.FC<PlayerStateRendererProps> = ({
  isLoading,
  error,
  selectedPlaylistId,
  tracks,
  onPlaylistSelect,
  onAddToQueue,
  lastSession,
  onResume,
}) => {
  const { activeDescriptor } = useProviderContext();
  const providerName = activeDescriptor?.name ?? 'Music Service';
  const [showLibrary, setShowLibrary] = useState(false);

  const handleConnectClick = useCallback(() => {
    activeDescriptor?.auth.beginLogin();
  }, [activeDescriptor]);

  const handleBrowseLibrary = useCallback(() => {
    setShowLibrary(true);
  }, []);

  const handlePlaylistSelectWrapped = useCallback(
    (id: string, name?: string, provider?: import('@/types/domain').ProviderId) => {
      setShowLibrary(false);
      onPlaylistSelect(id, name, provider);
    },
    [onPlaylistSelect],
  );

  if (isLoading) {
    return (
      <LoadingCard standalone>
        <LoadingContainer>
          <MusicIcon />
          <LoadingText>
            <LoadingTitle>Loading Your Music</LoadingTitle>
            <LoadingSubtext>Connecting to {providerName} and preparing your tracks</LoadingSubtext>
          </LoadingText>
          <ProgressBar />
        </LoadingContainer>
      </LoadingCard>
    );
  }

  if (error) {
    const isAuthError = error.includes('Redirecting to') ||
      error.includes('No authentication token') ||
      error.includes('Authentication expired');

    if (isAuthError) {
      return (
        <LoadingCard standalone>
          <CardHeader>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', textAlign: 'center' }}>
              Connect to {providerName}
            </h2>
          </CardHeader>
          <CardContent style={{ textAlign: 'center' }}>
            <p style={{ color: theme.colors.gray[300], marginBottom: theme.spacing.lg }}>
              Sign in to your {providerName} account to access your music.
              {activeDescriptor?.subscriptionNote && ` ${activeDescriptor.subscriptionNote}`}
            </p>
            <Button
              onClick={handleConnectClick}
              style={{ backgroundColor: theme.colors.accent }}
            >
              Connect {providerName}
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

  if (selectedPlaylistId === null || tracks.length === 0) {
    if (showLibrary) {
      return (
        <Suspense fallback={
          <LoadingCard standalone>
            <LoadingContainer>
              <MusicIcon />
              <LoadingText>
                <LoadingTitle>Loading Your Library</LoadingTitle>
                <LoadingSubtext>Discovering your playlists and albums</LoadingSubtext>
              </LoadingText>
              <ProgressBar />
            </LoadingContainer>
          </LoadingCard>
        }>
          <PlaylistSelection onPlaylistSelect={handlePlaylistSelectWrapped} />
        </Suspense>
      );
    }

    return (
      <QuickAccessPanel
        onPlaylistSelect={handlePlaylistSelectWrapped}
        onAddToQueue={onAddToQueue}
        onBrowseLibrary={handleBrowseLibrary}
        lastSession={lastSession}
        onResume={onResume}
      />
    );
  }

  return null;
};

export default PlayerStateRenderer;
