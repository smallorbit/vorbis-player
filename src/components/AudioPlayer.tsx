import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { flexCenter, srOnly } from '@/styles/utils';
import { theme } from '@/styles/theme';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import DebugOverlay, { useDebugActivator } from './DebugOverlay';
import ProviderSetupScreen from './ProviderSetupScreen';
import Toast from './Toast';
import ResumeCard from './QuickAccessPanel/ResumeCard';
import { ProfilingProvider } from '@/contexts/ProfilingContext';
import { ProfilingOverlay } from '@/components/ProfilingOverlay';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { usePlayerLogic } from '@/hooks/usePlayerLogic';
import { useColorContext } from '@/contexts/ColorContext';
import {
  useAccentColorBackground,
  useVisualEffectsToggle,
  useVisualizer,
} from '@/contexts/visualEffects';
import { PlayerSizingProvider } from '@/contexts/PlayerSizingContext';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { toAlbumPlaylistId } from '@/constants/playlist';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ClearCacheOptions } from '@/components/AppSettingsMenu';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import QuickAccessPanel from './QuickAccessPanel';

const VisualEffectsMenu = lazy(() => import('./AppSettingsMenu/index'));
const LibraryPage = lazy(() => import('./PlaylistSelection'));

const Container = styled.div`
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  ${flexCenter};
`;

const QuickAccessOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.banner};
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 60px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
`;

const ScreenReaderAnnouncement = styled.div`
  ${srOnly}
`;

const AudioPlayerComponent = () => {
  const { state, handlers, radio, currentPlaybackProviderRef: playbackProviderRef, mediaTracksRef, expectedTrackIdRef } = usePlayerLogic();
  const { debugActive, handleActivatorTap } = useDebugActivator();
  const { accentColor } = useColorContext();
  const {
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    backgroundVisualizerSpeed,
  } = useVisualizer();
  const { accentColorBackgroundEnabled } = useAccentColorBackground();
  const { showVisualEffects, setShowVisualEffects } = useVisualEffectsToggle();
  const { tracks, selectedPlaylistId, setTracks, setOriginalTracks, setSelectedPlaylistId } = useTrackListContext();
  const { currentTrack, currentTrackIndex, setCurrentTrackIndex, showQueue, setShowQueue } = useCurrentTrackContext();

  const resolveDisplayProvider = useCallback((): import('@/types/domain').ProviderId | undefined => (
    (currentTrack?.provider as import('@/types/domain').ProviderId | undefined)
    ?? playbackProviderRef.current
    ?? undefined
  ), [currentTrack, playbackProviderRef]);

  // Track the current playback provider — derives from the ref but as React state for re-renders
  const [displayProviderId, setDisplayProviderId] = useState<import('@/types/domain').ProviderId | undefined>(
    resolveDisplayProvider()
  );
  useEffect(() => {
    setDisplayProviderId(resolveDisplayProvider());
  }, [resolveDisplayProvider]);

  const collectionNameRef = useRef<string>('');
  const collectionProviderRef = useRef<import('@/types/domain').ProviderId | undefined>(undefined);

  const getLivePosition = useCallback(async (): Promise<number | null> => {
    const drivingId = playbackProviderRef.current;
    if (!drivingId) return null;
    const { providerRegistry } = await import('@/providers/registry');
    const descriptor = providerRegistry.get(drivingId);
    const ps = await descriptor?.playback.getState();
    return ps?.positionMs ?? null;
  }, [playbackProviderRef]);

  const { lastSession } = useSessionPersistence(
    selectedPlaylistId,
    collectionNameRef.current,
    collectionProviderRef.current,
    tracks,
    currentTrackIndex,
    currentTrack?.id,
    currentTrack?.name,
    currentTrack?.artists,
    currentTrack?.image,
    state.playbackPosition,
    getLivePosition,
  );

  const handleAlbumPlay = useCallback((albumId: string) => {
    collectionProviderRef.current = currentTrack?.provider as import('@/types/domain').ProviderId | undefined;
    handlers.loadCollection(
      toAlbumPlaylistId(albumId),
      currentTrack?.provider,
    );
  }, [handlers, currentTrack?.provider]);

  const handlePlaylistSelect = useCallback(
    (id: string, name?: string, provider?: import('@/types/domain').ProviderId) => {
      if (name) collectionNameRef.current = name;
      collectionProviderRef.current = provider;
      handlers.loadCollection(id, provider, name);
    },
    [handlers]
  );

  const [showQuickAccessPanel, setShowQuickAccessPanel] = useState(false);
  const handleOpenQuickAccessPanel = useCallback(() => setShowQuickAccessPanel(true), []);
  const handleCloseQuickAccessPanel = useCallback(() => setShowQuickAccessPanel(false), []);

  const [qapToast, setQapToast] = useState<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null);
  const handleQapToastDismiss = useCallback(() => setQapToast(null), []);

  const [resumeToast, setResumeToast] = useState<{ message: string } | null>(null);
  const dismissResumeToast = useCallback(() => setResumeToast(null), []);
  const handleHydrateFired = useCallback((track: import('@/types/domain').MediaTrack) => {
    setResumeToast({ message: `Resuming '${track.name}' — press play to continue.` });
  }, []);
  const handlePlayWithResumeDismiss = useCallback(() => {
    setResumeToast(null);
    handlers.handlePlay();
  }, [handlers]);
  const handlePauseWithResumeDismiss = useCallback(() => {
    setResumeToast(null);
    handlers.handlePause();
  }, [handlers]);
  const handleOpenLibraryWithResumeDismiss = useCallback(() => {
    setResumeToast(null);
    handlers.handleOpenLibrary();
  }, [handlers]);
  useEffect(() => {
    if (resumeToast && showQueue) setResumeToast(null);
  }, [resumeToast, showQueue]);
  const handleAddToQueueFromPanel = useCallback(
    async (id: string, name?: string, provider?: import('@/types/domain').ProviderId) => {
      const result = await handlers.handleAddToQueue(id, name, provider);
      if (result && result.added > 0) {
        const title = result.collectionName?.trim();
        const label = title ? `"${title}"` : 'this collection';
        setQapToast({
          message: `Added ${result.added} ${result.added === 1 ? 'track' : 'tracks'} from ${label} to your`,
          actionLabel: 'queue',
          onAction: () => { setShowQueue(true); setQapToast(null); },
        });
      }
      return result;
    },
    [handlers, setShowQueue],
  );

  const handlePlayLikedTracks = useCallback(
    async (likedTracks: import('@/types/domain').MediaTrack[], collectionId: string, collectionName: string, provider?: import('@/types/domain').ProviderId) => {
      collectionNameRef.current = collectionName;
      collectionProviderRef.current = provider;
      await handlers.playTracksDirectly(likedTracks, collectionId, provider);
    },
    [handlers],
  );

  const handleQueueLikedTracks = useCallback(
    (likedTracks: import('@/types/domain').MediaTrack[], collectionName?: string) => {
      const result = handlers.queueTracksDirectly(likedTracks, collectionName);
      if (result && result.added > 0) {
        const title = result.collectionName?.trim();
        const label = title ? `"${title}"` : 'this collection';
        setQapToast({
          message: `Added ${result.added} liked ${result.added === 1 ? 'track' : 'tracks'} from ${label} to your`,
          actionLabel: 'queue',
          onAction: () => { setShowQueue(true); setQapToast(null); },
        });
      }
    },
    [handlers, setShowQueue],
  );

  const playbackHandlers = useMemo(() => ({
    onPlay: handlePlayWithResumeDismiss,
    onPause: handlePauseWithResumeDismiss,
    onNext: handlers.handleNext,
    onPrevious: handlers.handlePrevious,
    onTrackSelect: handlers.playTrack,
    onOpenLibrary: handleOpenLibraryWithResumeDismiss,
    onCloseLibrary: handlers.handleCloseLibrary,
    onOpenQuickAccessPanel: handleOpenQuickAccessPanel,
    onPlaylistSelect: handlePlaylistSelect,
    onAddToQueue: handlers.handleAddToQueue,
    onPlayLikedTracks: handlePlayLikedTracks,
    onQueueLikedTracks: handleQueueLikedTracks,
    onAlbumPlay: handleAlbumPlay,
    onBackToLibrary: handleOpenLibraryWithResumeDismiss,
    onStartRadio: handlers.handleStartRadio,
    onRemoveFromQueue: handlers.handleRemoveFromQueue,
    onReorderQueue: handlers.handleReorderQueue,
  }), [
    handlers,
    handleAlbumPlay,
    handlePlaylistSelect,
    handleOpenQuickAccessPanel,
    handlePlayWithResumeDismiss,
    handlePauseWithResumeDismiss,
    handleOpenLibraryWithResumeDismiss,
  ]);

  const { chosenProviderId, activeDescriptor, connectedProviderIds, fallthroughNotification, dismissFallthroughNotification, reconnectPrompt, acceptReconnectPrompt, dismissReconnectPrompt, disconnectToast, dismissDisconnectToast } = useProviderContext();
  // Setup is needed when no provider has been chosen yet and none are connected,
  // or when the active provider isn't authenticated and no other enabled provider is either.
  // connectedProviderIds is the subset of enabledProviderIds with valid auth.
  const needsSetup = chosenProviderId === null
    ? connectedProviderIds.length === 0
    : !activeDescriptor?.auth.isAuthenticated() && connectedProviderIds.length === 0;

  const autoSelectFired = useRef(false);
  useEffect(() => {
    if (needsSetup || autoSelectFired.current || selectedPlaylistId !== null) return;
    const params = new URLSearchParams(window.location.search);
    const playlistParam = params.get('playlist');
    if (!playlistParam) return;
    autoSelectFired.current = true;
    window.history.replaceState({}, '', '/');
    handlers.loadCollection(playlistParam);
  }, [needsSetup, selectedPlaylistId, handlers]);

  const isMainPlayerActive = !state.isLoading && !state.error && selectedPlaylistId !== null && tracks.length > 0;

  const handleOpenSettings = useCallback(() => {
    setShowVisualEffects(true);
  }, [setShowVisualEffects]);

  const handleCloseSettings = useCallback(() => {
    setShowVisualEffects(false);
  }, [setShowVisualEffects]);

  const handleResume = useCallback(async () => {
    if (!lastSession?.queueTracks?.length) return;
    const { queueTracks, trackId, trackIndex, collectionId, playbackPosition: savedPositionMs } = lastSession;
    const targetIdx = trackId
      ? queueTracks.findIndex(t => t.id === trackId)
      : Math.min(trackIndex, queueTracks.length - 1);
    const resolvedIdx = targetIdx >= 0 ? targetIdx : Math.min(trackIndex, queueTracks.length - 1);
    setTracks(queueTracks);
    setOriginalTracks(queueTracks);
    setSelectedPlaylistId(collectionId);
    setCurrentTrackIndex(resolvedIdx);
    // Update the imperative tracks mirror synchronously so playTrack can resolve
    // the right track before React re-renders. Required for iOS Safari, which
    // blocks audio.play() called outside the synchronous user-gesture call stack.
    mediaTracksRef.current = queueTracks;
    // Guard the playback subscription against index-sync racing during load:
    // without this, usePlaybackSubscription may overwrite resolvedIdx with a
    // stale provider track index before the new track's ID is confirmed.
    expectedTrackIdRef.current = queueTracks[resolvedIdx]?.id ?? null;

    const positionMs = savedPositionMs && savedPositionMs > 0 ? savedPositionMs : undefined;
    await handlers.playTrack(resolvedIdx, false, positionMs ? { positionMs } : undefined);
  }, [lastSession, setTracks, setOriginalTracks, setSelectedPlaylistId, setCurrentTrackIndex, mediaTracksRef, expectedTrackIdRef, handlers]);

  const handleClearCache = useCallback(async (options: ClearCacheOptions) => {
    const { clearCacheWithOptions } = await import('@/services/cache/libraryCache');
    await clearCacheWithOptions({ clearLikes: options.clearLikes });
    if (options.clearPins) {
      const { clearAllPins } = await import('@/services/settings/pinnedItemsStorage');
      await clearAllPins();
    }
    if (options.clearAccentColors) {
      localStorage.removeItem(STORAGE_KEYS.ACCENT_COLOR_OVERRIDES);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_ACCENT_COLORS);
    }
    if (options.clearPins || options.clearAccentColors) {
      const { clearPreferencesSyncTimestamp, getPreferencesSync } =
        await import('@/providers/dropbox/dropboxPreferencesSync');
      clearPreferencesSyncTimestamp();
      getPreferencesSync()?.initialSync();
    }
  }, []);

  const renderContent = () => {
    if (needsSetup) {
      return (
        <ProviderSetupScreen
          onOpenSettings={handleOpenSettings}
          onOpenLibrary={handlers.handleOpenLibrary}
        />
      );
    }

    if (state.isLoading || state.error || selectedPlaylistId === null || tracks.length === 0) {
      return (
        <>
          <ProfiledComponent id="PlayerStateRenderer">
            <PlayerStateRenderer
              isLoading={state.isLoading}
              error={state.error}
              selectedPlaylistId={selectedPlaylistId}
              tracks={tracks}
              onPlaylistSelect={handlePlaylistSelect}
              onAddToQueue={handleAddToQueueFromPanel}
              onPlayLikedTracks={handlePlayLikedTracks}
              onQueueLikedTracks={handleQueueLikedTracks}
              lastSession={lastSession}
              onResume={handleResume}
              onOpenSettings={handleOpenSettings}
              onHydrate={handlers.handleHydrate}
              onHydrateFired={handleHydrateFired}
            />
          </ProfiledComponent>
          {qapToast && (
            <Toast message={qapToast.message} actionLabel={qapToast.actionLabel} onAction={qapToast.onAction} onDismiss={handleQapToastDismiss} />
          )}
        </>
      );
    }

    return (
      <ProfiledComponent id="PlayerContent">
        <PlayerContent
          isPlaying={state.isPlaying}
          showLibrary={state.showLibrary}
          handlers={playbackHandlers}
          radioState={radio.radioState}
          isRadioAvailable={radio.isRadioAvailable}
          radioActive={radio.isActive}
          currentTrackProvider={displayProviderId}
          mediaTracksRef={mediaTracksRef}
          radioProgress={radio.radioProgress}
          onDismissRadioProgress={radio.dismissRadioProgress}
          lastSession={lastSession}
          onResume={handleResume}
        />
      </ProfiledComponent>
    );
  };

  return (
    <PlayerSizingProvider>
    <ProfilingProvider>
      <Container>
        <ScreenReaderAnnouncement aria-live="polite" aria-atomic="true">
          {currentTrack ? `Now playing: ${currentTrack.name} by ${currentTrack.artists}` : ''}
        </ScreenReaderAnnouncement>
        <DebugOverlay active={debugActive} />
        <ProfilingOverlay />
        {/* 5 rapid taps in top-left corner toggles debug overlay */}
        <div
          onClick={handleActivatorTap}
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0px)',
            left: 0,
            width: 44,
            height: 44,
            zIndex: theme.zIndex.debugOverlayAbove,
          }}
        />
        <ProfiledComponent id="AccentColorBackground">
          <AccentColorBackground
            enabled={accentColorBackgroundEnabled && isMainPlayerActive}
            accentColor={accentColor}
          />
        </ProfiledComponent>
        <ProfiledComponent id="BackgroundVisualizer">
          <BackgroundVisualizer
            enabled={backgroundVisualizerEnabled && isMainPlayerActive}
            style={backgroundVisualizerStyle}
            intensity={backgroundVisualizerIntensity}
            speed={backgroundVisualizerSpeed}
            accentColor={accentColor}
            isPlaying={state.isPlaying}
          />
        </ProfiledComponent>
        {renderContent()}
        {showQuickAccessPanel && isMainPlayerActive && (
          <QuickAccessOverlay onClick={handleCloseQuickAccessPanel}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '92%', maxWidth: 900, height: '80%', maxHeight: 'calc(100dvh - 120px)', margin: 'auto', position: 'relative' }}
            >
              <QuickAccessPanel
                onPlaylistSelect={(id, name, provider) => {
                  handleCloseQuickAccessPanel();
                  handlePlaylistSelect(id, name, provider);
                }}
                onAddToQueue={async (id, name, provider) => {
                  handleCloseQuickAccessPanel();
                  return handleAddToQueueFromPanel(id, name, provider);
                }}
                onBrowseLibrary={() => {
                  localStorage.removeItem(STORAGE_KEYS.LIBRARY_SEARCH);
                  localStorage.removeItem(STORAGE_KEYS.LIBRARY_PROVIDER_FILTERS);
                  localStorage.removeItem(STORAGE_KEYS.LIBRARY_GENRES);
                  handleCloseQuickAccessPanel();
                  handlers.handleOpenLibrary();
                }}
                lastSession={null}
                onResume={() => {}}
              />
            </div>
          </QuickAccessOverlay>
        )}
        {qapToast && (
          <Toast message={qapToast.message} actionLabel={qapToast.actionLabel} onAction={qapToast.onAction} onDismiss={handleQapToastDismiss} />
        )}
        {resumeToast && (
          <Toast message={resumeToast.message} onDismiss={dismissResumeToast} />
        )}
        {fallthroughNotification && (
          <Toast message={fallthroughNotification} onDismiss={dismissFallthroughNotification} />
        )}
        {reconnectPrompt && (
          <Toast
            message={reconnectPrompt.message}
            actionLabel="Reconnect"
            onAction={acceptReconnectPrompt}
            onDismiss={dismissReconnectPrompt}
            persistent
          />
        )}
        {disconnectToast && !reconnectPrompt && (
          <Toast message={disconnectToast} onDismiss={dismissDisconnectToast} />
        )}
        {!isMainPlayerActive && (
          <Suspense fallback={null}>
            <VisualEffectsMenu
              isOpen={showVisualEffects}
              onClose={handleCloseSettings}
              onClearCache={handleClearCache}
              profilerEnabled={false}
              onProfilerToggle={() => {}}
              visualizerDebugEnabled={false}
              onVisualizerDebugToggle={() => {}}
              qapEnabled={false}
              onQapToggle={() => {}}
            />
          </Suspense>
        )}
        {needsSetup && state.showLibrary && (
          <Suspense fallback={null}>
            <LibraryPage
              onPlaylistSelect={(id, name, provider) => {
                handlers.handleCloseLibrary();
                handlePlaylistSelect(id, name, provider);
              }}
              onPlayLikedTracks={handlePlayLikedTracks}
              onQueueLikedTracks={handleQueueLikedTracks}
              footer={lastSession && handleResume ? (
                <ResumeCard session={lastSession} onResume={handleResume} />
              ) : undefined}
            />
          </Suspense>
        )}
      </Container>
    </ProfilingProvider>
    </PlayerSizingProvider>
  );
};

export default AudioPlayerComponent;
