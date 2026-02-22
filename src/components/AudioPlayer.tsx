import { useCallback } from 'react';
import styled from 'styled-components';
import { flexCenter } from '@/styles/utils';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import DebugOverlay, { useDebugActivator } from './DebugOverlay';
import { usePlayerLogic } from '@/hooks/usePlayerLogic';
import { useColorContext } from '@/contexts/ColorContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useTrackContext } from '@/contexts/TrackContext';
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
  const { tracks, selectedPlaylistId } = useTrackContext();

  const handleAlbumPlay = useCallback((albumId: string, _albumName: string) => {
    handlers.handlePlaylistSelect(toAlbumPlaylistId(albumId));
  }, [handlers]);

  const isMainPlayerActive = !state.isLoading && !state.error && !!selectedPlaylistId && tracks.length > 0;

  const renderContent = () => {
    if (state.isLoading || state.error || !selectedPlaylistId || tracks.length === 0) {
      return (
        <PlayerStateRenderer
          isLoading={state.isLoading}
          error={state.error}
          selectedPlaylistId={selectedPlaylistId}
          tracks={tracks}
          onPlaylistSelect={handlers.handlePlaylistSelect}
        />
      );
    }

    return (
      <PlayerContent
        isPlaying={state.isPlaying}
        showLibraryDrawer={state.showLibraryDrawer}
        handlers={{
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
        }}
      />
    );
  };

  return (
    <Container>
      <DebugOverlay active={debugActive} />
      {/* 5 rapid taps in top-left corner toggles debug overlay */}
      <div
        onClick={handleActivatorTap}
        style={{ position: 'fixed', top: 0, left: 0, width: 44, height: 44, zIndex: 999990 }}
      />
      <AccentColorBackground
        enabled={accentColorBackgroundEnabled && isMainPlayerActive}
        accentColor={accentColor}
      />
      <BackgroundVisualizer
        enabled={backgroundVisualizerEnabled && isMainPlayerActive}
        style={backgroundVisualizerStyle}
        intensity={backgroundVisualizerIntensity}
        accentColor={accentColor}
        isPlaying={state.isPlaying}
        playbackPosition={state.playbackPosition}
        zenMode={zenModeEnabled}
      />
      {renderContent()}
    </Container>
  );
};

export default AudioPlayerComponent;
