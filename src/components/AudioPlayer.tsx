import styled from 'styled-components';
import { flexCenter } from '@/styles/utils';
import PlayerStateRenderer from './PlayerStateRenderer';
import PlayerContent from './PlayerContent';
import BackgroundVisualizer from './BackgroundVisualizer';
import AccentColorBackground from './AccentColorBackground';
import { usePlayerLogic } from '@/hooks/usePlayerLogic';

const Container = styled.div`
  width: 100%;
  ${flexCenter};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing.sm};
  }
`;

const AudioPlayerComponent = () => {
  const { state, handlers } = usePlayerLogic();

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
          currentIndex: state.currentTrackIndex
        }}
        ui={{
          accentColor: state.accentColor,
          showVisualEffects: state.showVisualEffects,
          showPlaylist: state.showPlaylist
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
          onShowVisualEffects: handlers.handleShowVisualEffects,
          onCloseVisualEffects: handlers.handleCloseVisualEffects,
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
          debugModeEnabled: state.debugModeEnabled
        }}
      />
    );
  };

  return (
    <Container>
      <AccentColorBackground
        enabled={state.accentColorBackgroundEnabled}
        accentColor={state.accentColor}
      />
      <BackgroundVisualizer
        enabled={state.backgroundVisualizerEnabled}
        style={state.backgroundVisualizerStyle}
        intensity={state.backgroundVisualizerIntensity}
        accentColor={state.accentColor}
        isPlaying={state.isPlaying}
        playbackPosition={state.playbackPosition}
      />
      {renderContent()}
    </Container>
  );
};

export default AudioPlayerComponent;
