import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { flexCenter } from '@/styles/utils';
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
import { useLastFmScrobbler } from '@/hooks/useLastFmScrobbler';
import { isScrobblingConfigured } from '@/services/lastfmScrobbler';
import { useColorContext } from '@/contexts/ColorContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { PlayerSizingProvider } from '@/contexts/PlayerSizingContext';
import { useTrackListContext, useCurrentTrackContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { toAlbumPlaylistId } from '@/constants/playlist';
import type { ClearCacheOptions } from '@/components/VisualEffectsMenu';

const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu/index'));

const Container = styled.div`
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  ${flexCenter};
`;

const AudioPlayerComponent = () => {
  const { state, handlers, radio, currentPlaybackProviderRef: playbackProviderRef } = usePlayerLogic();
  const { debugActive, handleActivatorTap } = useDebugActivator();
  const { accentColor } = useColorContext();
  const {
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundEnabled,
    zenModeEnabled,
    showVisualEffects,
    setShowVisualEffects,
  } = useVisualEffectsContext();
  const { tracks, selectedPlaylistId } = useTrackListContext();
  const { currentTrack } = useCurrentTrackContext();

  // Last.fm scrobbling — watches playback and sends scrobble events
  useLastFmScrobbler({
    currentTrack: currentTrack ?? null,
    isPlaying: state.isPlaying,
    playbackPosition: state.playbackPosition,
    enabled: isScrobblingConfigured(),
  });

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

  const handleAlbumPlay = useCallback((albumId: string) => {
    handlers.handlePlaylistSelect(
      toAlbumPlaylistId(albumId),
      undefined,
      currentTrack?.provider,
    );
  }, [handlers, currentTrack?.provider]);

  const playbackHandlers = useMemo(() => ({
    onPlay: handlers.handlePlay,
    onPause: handlers.handlePause,
    onNext: handlers.handleNext,
    onPrevious: handlers.handlePrevious,
    onTrackSelect: handlers.playTrack,
    onOpenLibraryDrawer: handlers.handleOpenLibraryDrawer,
    onCloseLibraryDrawer: handlers.handleCloseLibraryDrawer,
    onPlaylistSelect: handlers.handlePlaylistSelect,
    onAlbumPlay: handleAlbumPlay,
    onBackToLibrary: handlers.handleBackToLibrary,
    onStartRadio: handlers.handleStartRadio,
  }), [handlers, handleAlbumPlay]);

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
    handlers.handlePlaylistSelect(playlistParam);
  }, [needsSetup, selectedPlaylistId, handlers]);

  const isMainPlayerActive = !state.isLoading && !state.error && selectedPlaylistId !== null && tracks.length > 0;

  const handleOpenSettings = useCallback(() => {
    setShowVisualEffects(true);
  }, [setShowVisualEffects]);

  const handleCloseSettings = useCallback(() => {
    setShowVisualEffects(false);
  }, [setShowVisualEffects]);

  const handleClearCache = useCallback(async (options: ClearCacheOptions) => {
    const { clearCacheWithOptions } = await import('@/services/cache/libraryCache');
    await clearCacheWithOptions({ clearLikes: options.clearLikes });
    if (options.clearPins) {
      const { clearAllPins } = await import('@/services/settings/pinnedItemsStorage');
      await clearAllPins();
    }
    if (options.clearAccentColors) {
      localStorage.removeItem('vorbis-player-accent-color-overrides');
      localStorage.removeItem('vorbis-player-custom-accent-colors');
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
            onPlaylistSelect={handlers.handlePlaylistSelect}
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
        />
      </ProfiledComponent>
    );
  };

  return (
    <PlayerSizingProvider>
    <ProfilingProvider>
      <Container>
        <DebugOverlay active={debugActive} />
        <ProfilingOverlay />
        {/* 5 rapid taps in top-left corner toggles debug overlay */}
        <div
          onClick={handleActivatorTap}
          style={{ position: 'fixed', top: 0, left: 0, width: 44, height: 44, zIndex: 999990 }}
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
            accentColor={accentColor}
            isPlaying={state.isPlaying}
            playbackPosition={state.playbackPosition}
            zenMode={zenModeEnabled}
          />
        </ProfiledComponent>
        {renderContent()}
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
                onPlaylistSelect={handlers.handlePlaylistSelect}
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
