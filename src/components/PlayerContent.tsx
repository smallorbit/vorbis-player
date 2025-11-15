import React, { Suspense, lazy, useState, useCallback } from 'react';
import styled from 'styled-components';
import { CardContent } from './styled';
import AlbumArt from './AlbumArt';
import PlayerControls from './PlayerControls';
import VisualEffectsContainer from './VisualEffectsContainer';
import QuickActionsPanel from './QuickActionsPanel';
import { theme } from '@/styles/theme';
import { cardBase } from '../styles/utils';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import type { Track } from '../services/spotify';

const PlaylistDrawer = lazy(() => import('./PlaylistDrawer'));

interface AlbumArtFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  blur: number;
  sepia: number;
}

interface PlayerContentHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowPlaylist: () => void;
  onShowVisualEffects: () => void;
  onCloseVisualEffects: () => void;
  onClosePlaylist: () => void;
  onTrackSelect: (index: number) => void;
  onAccentColorChange: (color: string) => void;
  onGlowToggle: () => void;
  onFilterChange: (filter: string, value: number) => void;
  onResetFilters: () => void;
  onGlowIntensityChange: (intensity: number) => void;
  onGlowRateChange: (rate: number) => void;
  onBackgroundVisualizerToggle?: () => void; // Temporary test handler
  onBackgroundVisualizerIntensityChange?: (delta: number) => void; // Temporary debug handler
  onBackgroundVisualizerStyleChange?: (style: 'particles' | 'waveform' | 'geometric' | 'gradient-flow') => void; // Temporary debug handler
  backgroundVisualizerEnabled?: boolean; // Temporary debug prop
  backgroundVisualizerStyle?: string; // Temporary debug prop
  backgroundVisualizerIntensity?: number; // Temporary debug prop
}

interface PlayerContentProps {
  track: {
    current: Track | null;
    list: Track[];
    currentIndex: number;
  };
  ui: {
    accentColor: string;
    showVisualEffects: boolean;
    showPlaylist: boolean;
  };
  effects: {
    enabled: boolean;
    glow: { intensity: number; rate: number };
    filters: AlbumArtFilters;
  };
  handlers: PlayerContentHandlers;
}

const ContentWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => !['width', 'height', 'padding', 'useFluidSizing', 'transitionDuration', 'transitionEasing', 'aspectRatio'].includes(prop),
}) <{
  width: number;
  height: number;
  padding: number;
  useFluidSizing: boolean;
  transitionDuration: number;
  transitionEasing: string;
  aspectRatio: number;
}>`
  /* Maintain consistent aspect ratio */
  aspect-ratio: ${props => props.aspectRatio};
  
  width: ${props => props.useFluidSizing ? '100%' : `${props.width}px`};
  height: ${props => props.useFluidSizing ? 'auto' : `${props.height}px`};
  max-width: ${props => props.width}px;
  max-height: ${props => props.height}px;
  
  margin: 0 auto;
  padding: ${props => props.padding}px;
  box-sizing: border-box;
  position: absolute;
  z-index: 1000;
  
  /* Smooth transitions for responsive sizing */
  transition: width ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            height ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            padding ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            max-width ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            max-height ${props => props.transitionDuration}ms ${props => props.transitionEasing};
  
  /* Enable container queries */
  container-type: inline-size;
  container-name: player;
  
  /* Container query responsive adjustments */
  @container player (max-width: ${theme.breakpoints.sm}) {
    width: 100%;
    height: auto;
    max-width: 100vw;
    max-height: 100vh;
    padding: ${theme.spacing.sm};
  }
  
  @container player (min-width: ${theme.breakpoints.sm}) and (max-width: ${theme.breakpoints.md}) {
    width: 100%;
    height: auto;
    max-width: 100vw;
    max-height: 100vh;
    padding: ${theme.spacing.md};
  }
  
  @container player (min-width: ${theme.breakpoints.md}) and (max-width: ${theme.breakpoints.lg}) {
    width: 100%;
    height: auto;
    max-width: 100vw;
    max-height: 100vh;
    padding: ${theme.spacing.lg};
  }
  
  /* Fallback for browsers without container query support */
  @supports not (container-type: inline-size) {
    @media (max-width: ${theme.breakpoints.sm}) {
      width: 100%;
      height: auto;
      max-width: 100vw;
      max-height: 100vh;
      padding: ${theme.spacing.sm};
    }
    
    @media (min-width: ${theme.breakpoints.sm}) and (max-width: ${theme.breakpoints.md}) {
      width: 100%;
      height: auto;
      max-width: 100vw;
      max-height: 100vh;
      padding: ${theme.spacing.md};
    }
    
    @media (min-width: ${theme.breakpoints.md}) and (max-width: ${theme.breakpoints.lg}) {
      width: 100%;
      height: auto;
      max-width: 100vw;
      max-height: 100vh;
      padding: ${theme.spacing.lg};
    }
  }
`;

const LoadingCard = styled.div.withConfig({
  shouldForwardProp: (prop: string) => !['backgroundImage', 'standalone', 'accentColor', 'glowEnabled', 'glowIntensity', 'glowRate'].includes(prop),
}) <{
  backgroundImage?: string;
  standalone?: boolean;
  accentColor?: string;
  glowEnabled?: boolean;
  glowIntensity?: number;
  glowRate?: number;
}>`
  ${cardBase};
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(34, 36, 36, 0.68);
  box-shadow: 0 8px 24px rgba(38, 36, 37, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6);
  ${({ backgroundImage }) => backgroundImage ? `
    &::after {
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
      position: absolute;
      inset: 0;
      background: rgba(32, 30, 30, 0.7);
      backdrop-filter: blur(40px);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: rgba(38, 38, 38, 0.5);
    backdrop-filter: blur(12px);
  `}
`;

const ControlsLoadingFallback = () => (
  <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
    Loading controls...
  </div>
);


const PlaylistLoadingFallback = () => (
  <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
    Loading playlist...
  </div>
);

// Animated controls container
const AnimatedControlsContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isVisible', 'transitionDuration', 'transitionEasing', 'maxHeight'].includes(prop),
}) <{
  isVisible: boolean;
  transitionDuration: number;
  transitionEasing: string;
  maxHeight: number;
}>`
  overflow: hidden;
  isolation: isolate;
  transition: max-height ${props => props.transitionDuration}ms ${props => props.transitionEasing},
              opacity ${props => props.transitionDuration}ms ${props => props.transitionEasing},
              transform ${props => props.transitionDuration}ms ${props => props.transitionEasing};
  max-height: ${props => props.isVisible ? `${props.maxHeight}px` : '0'};
  opacity: ${props => props.isVisible ? '1' : '0'};
  transform: ${props => props.isVisible ? 'translateY(0)' : 'translateY(-10px)'};
`;

// Main player container with stacked layout
const PlayerContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['controlsVisible', 'transitionDuration', 'transitionEasing'].includes(prop),
}) <{
  controlsVisible: boolean;
  transitionDuration: number;
  transitionEasing: string;
}>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  transition: transform ${props => props.transitionDuration}ms ${props => props.transitionEasing};
  transform: ${props => props.controlsVisible ? 'translateY(-3rem)' : 'translateY(0)'};
`;

// Album art container with click handler
const ClickableAlbumArtContainer = styled.div`
  position: relative;
  cursor: pointer;
  transition: filter 0.2s ease;
  z-index: 3;
  
  &:hover {
    filter: brightness(1.05);
  }
  
  &::after {
    content: '';
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 8px solid rgba(255, 255, 255, 0.7);
    transition: opacity 0.2s ease;
    opacity: 0;
  }
  
  &:hover::after {
    opacity: 1;
  }
`;

const PlayerContent: React.FC<PlayerContentProps> = ({ track, ui, effects, handlers }) => {
  const defaultFilters = {
    brightness: 110,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0
  };

  // Controls visibility state (default: hidden)
  const [controlsVisible, setControlsVisible] = useState(true);

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    setControlsVisible(prev => !prev);
  }, []);

  // Use responsive sizing hook
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing, aspectRatio } = usePlayerSizing();

  return (
    <ContentWrapper
      width={dimensions.width}
      height={dimensions.height}
      padding={padding}
      useFluidSizing={useFluidSizing}
      transitionDuration={transitionDuration}
      transitionEasing={transitionEasing}
      aspectRatio={aspectRatio}
    >
      <PlayerContainer
        controlsVisible={controlsVisible}
        transitionDuration={transitionDuration}
        transitionEasing={transitionEasing}
      >

        {/* Album Art Zone - Clickable to toggle controls */}
        <CardContent style={{
          position: 'relative',
          zIndex: 2,
          minHeight: 0,
          alignItems: 'center',
          paddingTop: '1rem'
        }}>
          <ClickableAlbumArtContainer onClick={toggleControls}>
            <AlbumArt
              currentTrack={track.current}
              accentColor={ui.accentColor}
              glowIntensity={effects.enabled ? effects.glow.intensity : 0}
              glowRate={effects.glow.rate}
              albumFilters={effects.enabled ? effects.filters : defaultFilters}
            />
            {/* Right-side quick actions panel next to album art, docked to its right edge */}
            <QuickActionsPanel
              accentColor={ui.accentColor}
              currentTrack={track.current}
              glowEnabled={effects.enabled}
              onShowPlaylist={handlers.onShowPlaylist}
              onShowVisualEffects={handlers.onShowVisualEffects}
              onGlowToggle={handlers.onGlowToggle}
              onAccentColorChange={handlers.onAccentColorChange}
              onBackgroundVisualizerToggle={handlers.onBackgroundVisualizerToggle}
              onBackgroundVisualizerIntensityChange={handlers.onBackgroundVisualizerIntensityChange}
              onBackgroundVisualizerStyleChange={handlers.onBackgroundVisualizerStyleChange}
              backgroundVisualizerEnabled={handlers.backgroundVisualizerEnabled}
              backgroundVisualizerStyle={handlers.backgroundVisualizerStyle}
              backgroundVisualizerIntensity={handlers.backgroundVisualizerIntensity}
              isVisible={controlsVisible}
            />
          </ClickableAlbumArtContainer>
        </CardContent>
        <LoadingCard
          backgroundImage={track.current?.image}
          accentColor={ui.accentColor}
          glowEnabled={effects.enabled}
          glowIntensity={effects.glow.intensity}
          glowRate={effects.glow.rate}
        >
          {/* Animated Controls Zone - Slides down when visible */}
          <AnimatedControlsContainer
            isVisible={controlsVisible}
            transitionDuration={transitionDuration}
            transitionEasing={transitionEasing}
            maxHeight={theme.controls.maxHeight}
          >
            <CardContent style={{
              position: 'relative',
              zIndex: 2,
              flex: '0 0 auto',
              minHeight: `${theme.controls.minHeight}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Suspense fallback={<ControlsLoadingFallback />}>
                <PlayerControls
                  currentTrack={track.current}
                  accentColor={ui.accentColor}
                  trackCount={track.list.length}
                  visualEffectsEnabled={effects.enabled}
                  onPlayback={{
                    play: handlers.onPlay,
                    pause: handlers.onPause,
                    next: handlers.onNext,
                    previous: handlers.onPrevious
                  }}
                  onUI={{
                    showPlaylist: handlers.onShowPlaylist,
                    showVisualEffects: handlers.onShowVisualEffects,
                    toggleVisualEffects: handlers.onGlowToggle
                  }}
                  onAccentColorChange={handlers.onAccentColorChange}
                />
              </Suspense>
            </CardContent>
          </AnimatedControlsContainer>


        </LoadingCard>
      </PlayerContainer>
      <VisualEffectsContainer
        enabled={effects.enabled}
        isMenuOpen={ui.showVisualEffects}
        accentColor={ui.accentColor}
        filters={effects.filters}
        onMenuClose={handlers.onCloseVisualEffects}
        onFilterChange={handlers.onFilterChange}
        onResetFilters={handlers.onResetFilters}
        onToggleEffects={handlers.onGlowToggle}
        glowIntensity={effects.glow.intensity}
        setGlowIntensity={handlers.onGlowIntensityChange}
        glowRate={effects.glow.rate}
        setGlowRate={handlers.onGlowRateChange}
        effectiveGlow={effects.glow}
      />
      <Suspense fallback={<PlaylistLoadingFallback />}>
        <PlaylistDrawer
          isOpen={ui.showPlaylist}
          onClose={handlers.onClosePlaylist}
          tracks={track.list}
          currentTrackIndex={track.currentIndex}
          accentColor={ui.accentColor}
          onTrackSelect={handlers.onTrackSelect}
        />
      </Suspense>
    </ContentWrapper>
  );
};

export default PlayerContent;