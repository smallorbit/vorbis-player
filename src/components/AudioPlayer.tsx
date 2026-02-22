import { useCallback } from 'react';
import styled from 'styled-components';
import { flexCenter } from '@/styles/utils';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import DebugOverlay, { useDebugActivator } from './DebugOverlay';
import { usePlayerLogic } from '@/hooks/usePlayerLogic';
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

  const handleAlbumPlay = useCallback((albumId: string, _albumName: string) => {
    handlers.handlePlaylistSelect(toAlbumPlaylistId(albumId));
  }, [handlers]);

  const renderContent = () => {
    const stateRenderer = (
      <PlayerStateRenderer
        isLoading={state.isLoading}
        error={state.error}
        selectedPlaylistId={state.selectedPlaylistId}
        tracks={state.tracks}
        onPlaylistSelect={handlers.handlePlaylistSelect}
      />
    );

    if (state.isLoading || state.error || !state.selectedPlaylistId || state.tracks.length === 0) {
      return stateRenderer;
    }

    return (
      <PlayerContent
        track={{
          current: state.currentTrack,
          list: state.tracks,
          currentIndex: state.currentTrackIndex,
          isPlaying: state.isPlaying,
          isLiked: state.isLiked,
          isLikePending: state.isLikePending,
          isMuted: state.isMuted,
          volume: state.volume
        }}
        ui={{
          accentColor: state.accentColor,
          showVisualEffects: state.showVisualEffects,
          showPlaylist: state.showPlaylist,
          showLibraryDrawer: state.showLibraryDrawer,
          zenMode: state.zenModeEnabled
        }}
        effects={{
          enabled: state.visualEffectsEnabled,
          glow: state.effectiveGlow,
          filters: state.albumFilters
        }}
        handlers={{
          onPlay: handlers.handlePlay,
          onPause: handlers.handlePause,
          onNext: handlers.handleNext,
          onPrevious: handlers.handlePrevious,
          onShowPlaylist: handlers.handleShowPlaylist,
          onTogglePlaylist: handlers.handleTogglePlaylist,
          onShowVisualEffects: handlers.handleShowVisualEffects,
          onCloseVisualEffects: handlers.handleCloseVisualEffects,
          onToggleVisualEffectsMenu: handlers.handleToggleVisualEffectsMenu,
          onClosePlaylist: handlers.handleClosePlaylist,
          onTrackSelect: handlers.playTrack,
          onAccentColorChange: handlers.handleAccentColorChange,
          onGlowToggle: handlers.handleVisualEffectsToggle,
          onFilterChange: handlers.handleFilterChange,
          onResetFilters: handlers.handleResetFilters,
          onGlowIntensityChange: handlers.handleGlowIntensityChange,
          onGlowRateChange: handlers.handleGlowRateChange,
          onBackgroundVisualizerToggle: handlers.handleBackgroundVisualizerToggle,
          onBackgroundVisualizerIntensityChange: handlers.handleBackgroundVisualizerIntensityChange,
          onBackgroundVisualizerStyleChange: handlers.handleBackgroundVisualizerStyleChange,
          backgroundVisualizerEnabled: state.backgroundVisualizerEnabled,
          backgroundVisualizerStyle: state.backgroundVisualizerStyle,
          backgroundVisualizerIntensity: state.backgroundVisualizerIntensity,
          accentColorBackgroundEnabled: state.accentColorBackgroundPreferred, // Pass preferred state to VFX menu
          onAccentColorBackgroundToggle: handlers.handleAccentColorBackgroundToggle,
          onMuteToggle: handlers.handleMuteToggle,
          onVolumeChange: handlers.setVolumeLevel,
          onToggleLike: handlers.handleLikeToggle,
          onBackToLibrary: handlers.handleOpenLibraryDrawer,
          onOpenLibraryDrawer: handlers.handleOpenLibraryDrawer,
          onCloseLibraryDrawer: handlers.handleCloseLibraryDrawer,
          onPlaylistSelect: handlers.handlePlaylistSelect,
          onAlbumPlay: handleAlbumPlay,
          onZenModeToggle: handlers.handleZenModeToggle,
          zenModeEnabled: state.zenModeEnabled,
          onShuffleToggle: handlers.handleShuffleToggle,
          shuffleEnabled: state.shuffleEnabled
        }}
      />
    );
  };

  // Only show visualizers when main player is active (not on sign-in or playlist selection screens)
  const isMainPlayerActive = !state.isLoading && !state.error && !!state.selectedPlaylistId && state.tracks.length > 0;

  return (
    <Container>
      <DebugOverlay active={debugActive} />
      {/* 5 rapid taps in top-left corner toggles debug overlay */}
      <div
        onClick={handleActivatorTap}
        style={{ position: 'fixed', top: 0, left: 0, width: 44, height: 44, zIndex: 999990 }}
      />
      <AccentColorBackground
        enabled={state.accentColorBackgroundEnabled && isMainPlayerActive}
        accentColor={state.accentColor}
      />
      <BackgroundVisualizer
        enabled={state.backgroundVisualizerEnabled && isMainPlayerActive}
        style={state.backgroundVisualizerStyle}
        intensity={state.backgroundVisualizerIntensity}
        accentColor={state.accentColor}
        isPlaying={state.isPlaying}
        playbackPosition={state.playbackPosition}
        zenMode={state.zenModeEnabled}
      />
      {renderContent()}
    </Container>
  );
};

export default AudioPlayerComponent;
