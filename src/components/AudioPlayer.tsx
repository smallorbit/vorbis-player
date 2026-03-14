import { useCallback, useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { flexCenter } from '@/styles/utils';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import DebugOverlay, { useDebugActivator } from './DebugOverlay';
import ProviderSetupScreen from './ProviderSetupScreen';
import { ProfilingProvider } from '@/contexts/ProfilingContext';
import { ProfilingOverlay } from '@/components/ProfilingOverlay';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { usePlayerLogic } from '@/hooks/usePlayerLogic';
import { useColorContext } from '@/contexts/ColorContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useTrackListContext } from '@/contexts/TrackContext';
import { useProviderContext } from '@/contexts/ProviderContext';
import { toAlbumPlaylistId } from '@/constants/playlist';

const Container = styled.div`
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  ${flexCenter};
`;

const AudioPlayerComponent = () => {
  const { state, handlers } = usePlayerLogic();
  const { debugActive, handleActivatorTap } = useDebugActivator();
  const { accentColor } = useColorContext();
  const {
    backgroundVisualizerEnabled,
    backgroundVisualizerStyle,
    backgroundVisualizerIntensity,
    accentColorBackgroundEnabled,
    zenModeEnabled,
  } = useVisualEffectsContext();
  const { tracks, selectedPlaylistId } = useTrackListContext();

  const handleAlbumPlay = useCallback((albumId: string, _albumName: string) => {
    handlers.handlePlaylistSelect(toAlbumPlaylistId(albumId));
  }, [handlers]);

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
  }), [handlers, handleAlbumPlay]);

  const { chosenProviderId, activeDescriptor } = useProviderContext();
  const needsSetup = chosenProviderId === null || !activeDescriptor?.auth.isAuthenticated();

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

  const renderContent = () => {
    if (needsSetup) {
      return <ProviderSetupScreen />;
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
        />
      </ProfiledComponent>
    );
  };

  return (
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
      </Container>
    </ProfilingProvider>
  );
};

export default AudioPlayerComponent;
