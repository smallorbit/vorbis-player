import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { flexCenter, srOnly } from '@/styles/utils';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import DebugOverlay, { useDebugActivator } from './DebugOverlay';
import ProviderSetupScreen from './ProviderSetupScreen';
import Toast from './Toast';
import LibraryDrawer from './LibraryDrawer';
import { ProfilingProvider } from '@/contexts/ProfilingContext';
import { ProfilingOverlay } from '@/components/ProfilingOverlay';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { usePlayerLogic } from '@/hooks/usePlayerLogic';
import { useColorContext } from '@/contexts/ColorContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { PlayerSizingProvider } from '@/contexts/PlayerSizingContext';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { toAlbumPlaylistId } from '@/constants/playlist';
import { STORAGE_KEYS } from '@/constants/storage';
import type { ClearCacheOptions } from '@/components/VisualEffectsMenu';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import QuickAccessPanel from './QuickAccessPanel';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu/index'));

const Container = styled.div`
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  ${flexCenter};
`;

const QuickAccessOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
`;

const ScreenReaderAnnouncement = styled.div`
  ${srOnly}
`;

const AudioPlayerComponent = () => {
  const { state, handlers, radio, currentPlaybackProviderRef: playbackProviderRef, mediaTracksRef } = usePlayerLogic();
  const { debugActive, handleActivatorTap } = useDebugActivator();
  const { accentColor } = useColorContext();
  const {
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    backgroundVisualizerSpeed,
    accentColorBackgroundEnabled,
    zenModeEnabled,
    showVisualEffects,
    setShowVisualEffects,
  } = useVisualEffectsContext();
  const { tracks, selectedPlaylistId, setTracks, setOriginalTracks, setSelectedPlaylistId } = useTrackListContext();
  const { currentTrack, currentTrackIndex, setCurrentTrackIndex } = useCurrentTrackContext();

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
      handlers.loadCollection(id, provider);
    },
    [handlers]
  );

  const [showQuickAccessPanel, setShowQuickAccessPanel] = useState(false);
  const handleOpenQuickAccessPanel = useCallback(() => setShowQuickAccessPanel(true), []);
  const handleCloseQuickAccessPanel = useCallback(() => setShowQuickAccessPanel(false), []);

  const [qapToast, setQapToast] = useState<string | null>(null);
  const handleAddToQueueFromPanel = useCallback(
    async (id: string, name?: string, provider?: import('@/types/domain').ProviderId) => {
      const result = await handlers.handleAddToQueue(id, name, provider);
      if (result && result.added > 0) {
        const title = result.collectionName?.trim();
        const label = title ? `"${title}"` : 'this collection';
        setQapToast(`Added ${result.added} ${result.added === 1 ? 'track' : 'tracks'} from ${label} to your queue`);
      }
      return result;
    },
    [handlers],
  );

  const playbackHandlers = useMemo(() => ({
    onPlay: handlers.handlePlay,
    onPause: handlers.handlePause,
    onNext: handlers.handleNext,
    onPrevious: handlers.handlePrevious,
    onTrackSelect: handlers.playTrack,
    onOpenLibraryDrawer: handleOpenQuickAccessPanel,
    onCloseLibraryDrawer: handlers.handleCloseLibraryDrawer,
    onOpenQuickAccessPanel: handleOpenQuickAccessPanel,
    onPlaylistSelect: handlePlaylistSelect,
    onAddToQueue: handlers.handleAddToQueue,
    onAlbumPlay: handleAlbumPlay,
    onBackToLibrary: handleOpenQuickAccessPanel,
    onStartRadio: handlers.handleStartRadio,
    onRemoveFromQueue: handlers.handleRemoveFromQueue,
    onReorderQueue: handlers.handleReorderQueue,
  }), [handlers, handleAlbumPlay, handlePlaylistSelect, handleOpenQuickAccessPanel]);

  const { chosenProviderId, activeDescriptor, connectedProviderIds, fallthroughNotification, dismissFallthroughNotification } = useProviderContext();
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

  const pendingPlayRef = useRef<{ trackId?: string; trackIndex: number } | null>(null);

  const handleResume = useCallback(() => {
    if (!lastSession?.queueTracks?.length) return;
    const { queueTracks, trackId, trackIndex, collectionId } = lastSession;
    const targetIdx = trackId
      ? queueTracks.findIndex(t => t.id === trackId)
      : Math.min(trackIndex, queueTracks.length - 1);
    const resolvedIdx = targetIdx >= 0 ? targetIdx : Math.min(trackIndex, queueTracks.length - 1);
    setTracks(queueTracks);
    setOriginalTracks(queueTracks);
    setSelectedPlaylistId(collectionId);
    setCurrentTrackIndex(resolvedIdx);
    pendingPlayRef.current = { trackId, trackIndex: resolvedIdx };
  }, [lastSession, setTracks, setOriginalTracks, setSelectedPlaylistId, setCurrentTrackIndex]);

  useEffect(() => {
    if (tracks.length === 0 || !pendingPlayRef.current) return;
    const { trackId, trackIndex } = pendingPlayRef.current;
    pendingPlayRef.current = null;
    const idx = trackId ? tracks.findIndex(t => t.id === trackId) : -1;
    handlers.playTrack(idx >= 0 ? idx : Math.min(trackIndex, tracks.length - 1));
  }, [tracks, handlers]);

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
          onOpenLibrary={handlers.handleOpenLibraryDrawer}
        />
      );
    }

    if (state.isLoading || state.error || selectedPlaylistId === null || tracks.length === 0) {
      return (
        <ProfiledComponent id="PlayerStateRenderer">
          <PlayerStateRenderer
            isLoading={state.isLoading}
            error={state.error}
            selectedPlaylistId={selectedPlaylistId}
            tracks={tracks}
            onPlaylistSelect={handlePlaylistSelect}
            onAddToQueue={handleAddToQueueFromPanel}
            lastSession={lastSession}
            onResume={handleResume}
          />
        </ProfiledComponent>
      );
    }

    return (
      <ProfiledComponent id="PlayerContent">
        <PlayerContent
          isPlaying={state.isPlaying}
          showLibraryDrawer={state.showLibraryDrawer}
          handlers={playbackHandlers}
          radioState={radio.radioState}
          isRadioAvailable={radio.isRadioAvailable}
          radioActive={radio.isActive}
          currentTrackProvider={displayProviderId}
          mediaTracksRef={mediaTracksRef}
          radioProgress={radio.radioProgress}
          onDismissRadioProgress={radio.dismissRadioProgress}
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
            zIndex: 999990,
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
            playbackPosition={state.playbackPosition}
            zenMode={zenModeEnabled}
          />
        </ProfiledComponent>
        {renderContent()}
        {showQuickAccessPanel && isMainPlayerActive && (
          <QuickAccessOverlay onClick={handleCloseQuickAccessPanel}>
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 480, aspectRatio: '1', margin: 'auto', position: 'relative' }}
            >
              <QuickAccessPanel
                onPlaylistSelect={(id, name, provider) => {
                  handleCloseQuickAccessPanel();
                  handlePlaylistSelect(id, name, provider);
                }}
                onAddToQueue={(id, name, provider) => {
                  handlers.handleAddToQueue(id, name, provider);
                }}
                onBrowseLibrary={() => {
                  handleCloseQuickAccessPanel();
                  handlers.handleOpenLibraryDrawer();
                }}
                lastSession={null}
                onResume={() => {}}
              />
            </div>
          </QuickAccessOverlay>
        )}
        {qapToast && (
          <Toast message={qapToast} onDismiss={() => setQapToast(null)} />
        )}
        {fallthroughNotification && (
          <Toast message={fallthroughNotification} onDismiss={dismissFallthroughNotification} />
        )}
        {needsSetup && (
          <>
            <Suspense fallback={null}>
              <VisualEffectsMenu
                isOpen={showVisualEffects}
                onClose={handleCloseSettings}
                onClearCache={handleClearCache}
                profilerEnabled={false}
                onProfilerToggle={() => {}}
                visualizerDebugEnabled={false}
                onVisualizerDebugToggle={() => {}}
              />
            </Suspense>
            <Suspense fallback={null}>
              <LibraryDrawer
                isOpen={state.showLibraryDrawer}
                onClose={handlers.handleCloseLibraryDrawer}
                onPlaylistSelect={handlePlaylistSelect}
                onAddToQueue={handleAddToQueueFromPanel}
              />
            </Suspense>
          </>
        )}
      </Container>
    </ProfilingProvider>
    </PlayerSizingProvider>
  );
};

export default AudioPlayerComponent;
