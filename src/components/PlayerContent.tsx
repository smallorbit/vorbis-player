import React, { Suspense, lazy, useState, useCallback } from 'react';
import styled from 'styled-components';
import { CardContent } from './styled';
import AlbumArt from './AlbumArt';
import PlayerControls from './PlayerControls';
import QuickActionsPanel from './QuickActionsPanel';
import LeftQuickActionsPanel from './LeftQuickActionsPanel';
import { theme } from '@/styles/theme';
import { cardBase } from '../styles/utils';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { Track } from '../services/spotify';
import type { VisualizerStyle } from '../types/visualizer';
import type { AlbumFilters } from '../types/filters';

const PlaylistDrawer = lazy(() => import('./PlaylistDrawer'));
const VisualEffectsMenu = lazy(() => import('./VisualEffectsMenu/index'));
const KeyboardShortcutsHelp = lazy(() => import('./KeyboardShortcutsHelp'));

interface PlayerContentHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onShowPlaylist: () => void;
  onTogglePlaylist: () => void;
  onShowVisualEffects: () => void;
  onCloseVisualEffects: () => void;
  onToggleVisualEffectsMenu: () => void;
  onClosePlaylist: () => void;
  onTrackSelect: (index: number) => void;
  onAccentColorChange: (color: string) => void;
  onGlowToggle: () => void;
  onFilterChange: (filter: string, value: number) => void;
  onResetFilters: () => void;
  onGlowIntensityChange: (intensity: number) => void;
  onGlowRateChange: (rate: number) => void;
  onBackgroundVisualizerToggle?: () => void; // Background visualizer toggle handler
  onBackgroundVisualizerIntensityChange?: (intensity: number) => void; // Background visualizer intensity change handler (direct value, not delta)
  onBackgroundVisualizerStyleChange?: (style: 'particles' | 'waveform' | 'geometric' | 'gradient-flow') => void; // Background visualizer style change handler
  backgroundVisualizerEnabled?: boolean; // Background visualizer enabled state
  backgroundVisualizerStyle?: string; // Background visualizer style
  backgroundVisualizerIntensity?: number; // Background visualizer intensity
  accentColorBackgroundEnabled?: boolean; // Accent color background toggle
  onAccentColorBackgroundToggle?: () => void; // Accent color background toggle handler
  debugModeEnabled?: boolean; // Debug mode toggle
  onMuteToggle?: () => void; // Mute toggle handler
}

interface PlayerContentProps {
  track: {
    current: Track | null;
    list: Track[];
    currentIndex: number;
    isPlaying: boolean;
  };
  ui: {
    accentColor: string;
    showVisualEffects: boolean;
    showPlaylist: boolean;
  };
  effects: {
    enabled: boolean;
    glow: { intensity: number; rate: number };
    filters: AlbumFilters;
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
  /* Enhanced border with subtle highlight */
  border: 1px solid rgba(255, 255, 255, 0.12);
  /* Multi-layer shadows for depth */
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.9),
    0 4px 16px rgba(0, 0, 0, 0.8),
    0 2px 8px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
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
      background: rgba(20, 18, 18, 0.85);
      backdrop-filter: blur(40px) saturate(180%);
      -webkit-backdrop-filter: blur(40px) saturate(180%);
      border-radius: 1.25rem;
      z-index: 1;
    }
  ` : `
    background: linear-gradient(
      to bottom,
      rgba(28, 28, 28, 0.95) 0%,
      rgba(20, 20, 20, 0.98) 100%
    );
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
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
  transform: ${props => props.controlsVisible ? 'translateY(-4rem)' : 'translateY(0)'};
`;

// Album art container with click handler
const ClickableAlbumArtContainer = styled.div`
  position: relative;
  cursor: pointer;
  z-index: 3;
  /* Add subtle outer glow/shadow for separation from background */
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
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
  
  // Help modal state
  const [showHelp, setShowHelp] = useState(false);

  // Toggle controls visibility
  const toggleControls = useCallback(() => {
    setControlsVisible(prev => !prev);
  }, []);

  // Toggle help modal
  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  // Use responsive sizing hook
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing, aspectRatio } = usePlayerSizing();

  // Combined close handler for Escape key (closes VFX menu and help modal)
  const handleEscapeClose = useCallback(() => {
    handlers.onCloseVisualEffects();
    if (showHelp) {
      closeHelp();
    }
  }, [handlers, showHelp, closeHelp]);

  // Combine play/pause for Space key
  const handlePlayPause = useCallback(() => {
    if (track.isPlaying) {
      handlers.onPause();
    } else {
      handlers.onPlay();
    }
  }, [handlers, track.isPlaying]);

  // Set up keyboard shortcuts
  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: handlers.onNext,
    onPrevious: handlers.onPrevious,
    onTogglePlaylist: handlers.onTogglePlaylist,
    onClosePlaylist: handlers.onClosePlaylist,
    onToggleVisualEffectsMenu: handlers.onToggleVisualEffectsMenu,
    onCloseVisualEffects: handleEscapeClose,
    onToggleBackgroundVisualizer: handlers.onBackgroundVisualizerToggle,
    onToggleGlow: handlers.onGlowToggle,
    onMute: handlers.onMuteToggle,
    onToggleHelp: toggleHelp
  });

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
            {/* Left-side quick actions panel for glow and visualizer toggles */}
            <LeftQuickActionsPanel
              accentColor={ui.accentColor}
              glowEnabled={effects.enabled}
              onGlowToggle={handlers.onGlowToggle}
              onBackgroundVisualizerToggle={handlers.onBackgroundVisualizerToggle}
              backgroundVisualizerEnabled={handlers.backgroundVisualizerEnabled}
              isVisible={controlsVisible}
            />

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
              backgroundVisualizerEnabled={handlers.backgroundVisualizerEnabled}
              debugModeEnabled={handlers.debugModeEnabled}
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
                  onPlayback={{
                    play: handlers.onPlay,
                    pause: handlers.onPause,
                    next: handlers.onNext,
                    previous: handlers.onPrevious
                  }}
                />
              </Suspense>
            </CardContent>
          </AnimatedControlsContainer>


        </LoadingCard>
      </PlayerContainer>
      {ui.showVisualEffects && (
        <Suspense fallback={
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '350px',
            height: '100vh',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '14px'
          }}>
            Loading effects...
          </div>
        }>
          <VisualEffectsMenu
            isOpen={ui.showVisualEffects}
            onClose={handlers.onCloseVisualEffects}
            accentColor={ui.accentColor}
            filters={effects.filters}
            onFilterChange={handlers.onFilterChange}
            onResetFilters={handlers.onResetFilters}
            glowIntensity={effects.glow.intensity}
            setGlowIntensity={handlers.onGlowIntensityChange}
            glowRate={effects.glow.rate}
            setGlowRate={handlers.onGlowRateChange}
            effectiveGlow={effects.glow}
            backgroundVisualizerStyle={(handlers.backgroundVisualizerStyle as VisualizerStyle) || 'particles'}
            onBackgroundVisualizerStyleChange={handlers.onBackgroundVisualizerStyleChange || (() => { })}
            backgroundVisualizerIntensity={handlers.backgroundVisualizerIntensity || 60}
            onBackgroundVisualizerIntensityChange={handlers.onBackgroundVisualizerIntensityChange || (() => { })}
            accentColorBackgroundEnabled={handlers.accentColorBackgroundEnabled || false}
            onAccentColorBackgroundToggle={handlers.onAccentColorBackgroundToggle || (() => { })}
          />
        </Suspense>
      )}
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
      <Suspense fallback={null}>
        <KeyboardShortcutsHelp isOpen={showHelp} onClose={closeHelp} />
      </Suspense>
    </ContentWrapper>
  );
};

export default PlayerContent;