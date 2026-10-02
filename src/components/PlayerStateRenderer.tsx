import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { AddToQueueResult, CollectionSelection, MediaTrack, PlaybackSelection } from '@/types/domain';
import { isSessionStale, type SessionSnapshot } from '@/services/sessionPersistence';
import type { RestoreSessionResult } from '@/hooks/usePlayerLogic';
import { theme } from '@/styles/theme';
import { useProviderContext } from '@/contexts/ProviderContext';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { useWelcomeSeen } from '@/hooks/useWelcomeSeen';
import QuickAccessPanel from './QuickAccessPanel';
import SettingsGearButton from './SettingsGearButton';
import WelcomeScreen from './WelcomeScreen';
import { PlaybackActionsProvider, noopPlaybackActions } from '@/contexts/PlaybackActionsContext';
import { PlayerStateIdleCardShell, PlayerStateIdleLoadingCard } from './PlayerStateIdleLoadingCard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LibraryRouteLazy = React.lazy(() => import('./LibraryRoute'));

const ConnectCard = styled(PlayerStateIdleCardShell)`
  display: flex;
  flex-direction: column;
`;

interface PlayerStateRendererProps {
  isLoading: boolean;
  error: string | null;
  selection: PlaybackSelection | null;
  tracks: MediaTrack[];
  onSelectCollection: (selection: CollectionSelection) => void;
  onAddToQueue: (selection: CollectionSelection) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: ((tracks: MediaTrack[], selection: CollectionSelection) => Promise<void>) | undefined;
  onQueueLikedTracks?: ((tracks: MediaTrack[], collectionName?: string) => void) | undefined;
  lastSession: SessionSnapshot | null;
  onResume: () => void;
  onOpenSettings: () => void;
  onHydrate: (session: SessionSnapshot) => Promise<RestoreSessionResult>;
  onHydrateFired?: ((track: MediaTrack, skipped: boolean) => void) | undefined;
  onHydrateFailed?: (() => void) | undefined;
}

type IdleRoute = 'welcome' | 'qap' | 'hydrate' | 'library';

function resolveIdleRoute(
  welcomeSeen: boolean,
  qapEnabled: boolean,
  hasValidSession: boolean,
): IdleRoute {
  if (!welcomeSeen) return 'welcome';
  if (qapEnabled) return 'qap';
  if (hasValidSession) return 'hydrate';
  return 'library';
}

const PlayerStateRenderer: React.FC<PlayerStateRendererProps> = ({
  isLoading,
  error,
  selection,
  tracks,
  onSelectCollection,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
  lastSession,
  onResume,
  onOpenSettings,
  onHydrate,
  onHydrateFired,
  onHydrateFailed,
}) => {
  const { activeDescriptor } = useProviderContext();
  const providerName = activeDescriptor?.name ?? 'Music Service';
  const [qapEnabled] = useQapEnabled();
  const [welcomeSeen, setWelcomeSeen] = useWelcomeSeen();
  const hasValidSession = !isSessionStale(lastSession);
  const route = resolveIdleRoute(welcomeSeen, qapEnabled, hasValidSession);
  // "Browse Library" is a one-way door: once engaged, the idle view stays on
  // Library even if routing inputs would otherwise pick QAP.
  const [libraryOverride, setLibraryOverride] = useState(false);

  const hydrateFiredRef = useRef(false);
  useEffect(() => {
    if (hydrateFiredRef.current) return;
    if (route !== 'hydrate') return;
    if (!lastSession) return;
    hydrateFiredRef.current = true;
    void onHydrate(lastSession)
      .then((result) => {
        if (result.totalFailure) {
          // Route past the hydrate spinner immediately — the resolved lastSession
          // prop may still read as valid for a tick until the caller resets it,
          // and the override wins over the idle-route check.
          setLibraryOverride(true);
          onHydrateFailed?.();
          return;
        }
        if (result.track) onHydrateFired?.(result.track, result.skipped);
      })
      .catch(() => {
        // Hydrate errors are surfaced inside restoreSession; swallow here so
        // a rejected promise doesn't bubble up as an unhandled rejection.
      });
  }, [route, lastSession, onHydrate, onHydrateFired, onHydrateFailed]);

  const handleConnectClick = useCallback(() => {
    void activeDescriptor?.auth.beginLogin();
  }, [activeDescriptor]);

  const handleBrowseLibrary = useCallback(() => {
    setLibraryOverride(true);
  }, []);

  const handleSelectCollectionWrapped = useCallback(
    (collectionSelection: CollectionSelection) => {
      setLibraryOverride(false);
      onSelectCollection(collectionSelection);
    },
    [onSelectCollection],
  );


  if (isLoading) {
    return (
      <PlayerStateIdleLoadingCard
        title="Loading Your Music"
        subtext={`Connecting to ${providerName} and preparing your tracks`}
      />
    );
  }

  if (error) {
    const isAuthError = error.includes('Redirecting to') ||
      error.includes('No authentication token') ||
      error.includes('Authentication expired');

    if (isAuthError) {
      return (
        <ConnectCard>
          <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="text-center">
              <CardTitle className="text-white">Connect to {providerName}</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p style={{ color: theme.colors.gray[300], marginBottom: theme.spacing.lg }}>
                Sign in to your {providerName} account to access your music.
                {activeDescriptor?.subscriptionNote && ` ${activeDescriptor.subscriptionNote}`}
              </p>
              <Button
                type="button"
                onClick={handleConnectClick}
                style={{
                  backgroundColor: theme.colors.cta,
                  color: theme.colors.foregroundDark,
                }}
              >
                Connect {providerName}
              </Button>
            </CardContent>
          </Card>
        </ConnectCard>
      );
    }

    return (
      <Alert
        variant="destructive"
        className="w-full border-destructive/80 bg-destructive/15"
      >
        <AlertDescription style={{ color: theme.colors.errorText }}>
          Error: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (selection === null || tracks.length === 0) {
    const libraryView = (
      <>
        <SettingsGearButton onClick={onOpenSettings} />
        <Suspense fallback={
          <PlayerStateIdleLoadingCard
            title="Loading Your Library"
            subtext="Discovering your playlists and albums"
          />
        }>
          <PlaybackActionsProvider value={noopPlaybackActions}>
            <LibraryRouteLazy
              onSelectCollection={handleSelectCollectionWrapped}
              onAddToQueue={onAddToQueue}
              onPlayLikedTracks={onPlayLikedTracks}
              onQueueLikedTracks={onQueueLikedTracks}
              onResume={onResume}
              lastSession={lastSession}
              isPlaying={false}
            />
          </PlaybackActionsProvider>
        </Suspense>
      </>
    );

    if (libraryOverride) return libraryView;

    if (route === 'welcome') {
      return (
        <>
          <SettingsGearButton onClick={onOpenSettings} />
          <WelcomeScreen
            onConnectProvider={handleConnectClick}
            onBrowseLibrary={handleBrowseLibrary}
            onDismiss={() => setWelcomeSeen(true)}
          />
        </>
      );
    }

    if (route === 'hydrate') {
      return (
        <PlayerStateIdleLoadingCard
          title="Restoring Your Session"
          subtext="Loading your last queue"
        />
      );
    }

    if (route === 'qap') {
      return (
        <>
          <SettingsGearButton onClick={onOpenSettings} />
          <QuickAccessPanel
            onSelectCollection={handleSelectCollectionWrapped}
            onAddToQueue={onAddToQueue}
            onBrowseLibrary={handleBrowseLibrary}
            lastSession={hasValidSession ? lastSession : null}
            onResume={onResume}
          />
        </>
      );
    }

    return libraryView;
  }

  return null;
};

export default PlayerStateRenderer;
