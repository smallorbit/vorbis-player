import React, { Suspense, lazy } from 'react';
import styled from 'styled-components';
import { CardContent } from './styled';
import AlbumArt from './AlbumArt';
import PlayerControls from './PlayerControls';
import VisualEffectsContainer from './VisualEffectsContainer';
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
  shouldForwardProp: (prop) => !['width', 'height', 'padding', 'useFluidSizing', 'transitionDuration', 'transitionEasing'].includes(prop),
}) <{
  width: number;
  height: number;
  padding: number;
  useFluidSizing: boolean;
  transitionDuration: number;
  transitionEasing: string;
}>`
  width: ${props => props.useFluidSizing ? '100%' : `${props.width}px`};
  height: ${props => props.useFluidSizing ? '100vh' : `${props.height}px`};
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
  @container player (max-width: 480px) {
    width: 100%;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    padding: 8px;
  }
  
  @container player (min-width: 480px) and (max-width: 768px) {
    width: 100%;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    padding: 12px;
  }
  
  @container player (min-width: 768px) and (max-width: 1024px) {
    width: 100%;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    padding: 16px;
  }
  
  /* Fallback for browsers without container query support */
  @supports not (container-type: inline-size) {
    @media (max-width: ${theme.breakpoints.sm}) {
      width: 100%;
      height: 100vh;
      max-width: 100vw;
      max-height: 100vh;
      padding: 8px;
    }
    
    @media (min-width: ${theme.breakpoints.sm}) and (max-width: ${theme.breakpoints.md}) {
      width: 100%;
      height: 100vh;
      max-width: 100vw;
      max-height: 100vh;
      padding: 12px;
    }
    
    @media (min-width: ${theme.breakpoints.md}) and (max-width: ${theme.breakpoints.lg}) {
      width: 100%;
      height: 100vh;
      max-width: 100vw;
      max-height: 100vh;
      padding: 16px;
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
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 1px solid rgba(34, 36, 36, 0.68);
  box-shadow: 0 8px 24px rgba(38, 36, 37, 0.7), 0 2px 8px rgba(22, 21, 21, 0.6);
  ${({ backgroundImage }) => backgroundImage ? `
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

const PlayerContent: React.FC<PlayerContentProps> = ({ track, ui, effects, handlers }) => {
  const defaultFilters = {
    brightness: 110,
    contrast: 100,
    saturation: 100,
    hue: 0,
    blur: 0,
    sepia: 0
  };

  // Use responsive sizing hook
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing } = usePlayerSizing();

  return (
    <ContentWrapper
      width={dimensions.width}
      height={dimensions.height}
      padding={padding}
      useFluidSizing={useFluidSizing}
      transitionDuration={transitionDuration}
      transitionEasing={transitionEasing}
    >
      <LoadingCard
        backgroundImage={track.current?.image}
        accentColor={ui.accentColor}
        glowEnabled={effects.enabled}
        glowIntensity={effects.glow.intensity}
        glowRate={effects.glow.rate}
      >
        <CardContent style={{ position: 'relative', zIndex: 2, marginTop: '-0.25rem' }}>
          <AlbumArt
            currentTrack={track.current}
            accentColor={ui.accentColor}
            glowIntensity={effects.enabled ? effects.glow.intensity : 0}
            glowRate={effects.glow.rate}
            albumFilters={effects.enabled ? effects.filters : defaultFilters}
          />
        </CardContent>

        <CardContent style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2 }}>
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
      </LoadingCard>

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