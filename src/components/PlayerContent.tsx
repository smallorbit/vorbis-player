import React, { Suspense, lazy, useState, useCallback } from 'react';
import styled from 'styled-components';
import { CardContent } from './styled';
import AlbumArt from './AlbumArt';
import PlayerControls from './PlayerControls';
import QuickActionsPanel from './QuickActionsPanel';
import LeftQuickActionsPanel from './LeftQuickActionsPanel';
import MobileBottomMenu from './MobileBottomMenu';
import { theme } from '@/styles/theme';
import { cardBase } from '../styles/utils';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
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
  onBackgroundVisualizerStyleChange?: (style: 'particles' | 'geometric') => void; // Background visualizer style change handler
  backgroundVisualizerEnabled?: boolean; // Background visualizer enabled state
  backgroundVisualizerStyle?: string; // Background visualizer style
  backgroundVisualizerIntensity?: number; // Background visualizer intensity
  accentColorBackgroundEnabled?: boolean; // Accent color background toggle
  onAccentColorBackgroundToggle?: () => void; // Accent color background toggle handler
  debugModeEnabled?: boolean; // Debug mode toggle
  onMuteToggle?: () => void; // Mute toggle handler
  onToggleLike?: () => void; // Like toggle handler
  onBackToLibrary?: () => void; // Back to library navigation handler
}

interface PlayerContentProps {
  track: {
    current: Track | null;
    list: Track[];
    currentIndex: number;
    isPlaying: boolean;
    isLiked?: boolean;
    isLikePending?: boolean;
    isMuted?: boolean;
    volume?: number;
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
  shouldForwardProp: (prop) => !['width', 'padding', 'useFluidSizing', 'transitionDuration', 'transitionEasing'].includes(prop),
}) <{
  width: number;
  padding: number;
  useFluidSizing: boolean;
  transitionDuration: number;
  transitionEasing: string;
}>`
  width: ${props => props.useFluidSizing ? '100%' : `${props.width}px`};
  max-width: ${props => props.width}px;

  margin: 0 auto;
  padding: ${props => props.padding}px;
  box-sizing: border-box;
  position: relative;
  z-index: 2;
  overflow: visible;

  transition: width ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            padding ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            max-width ${props => props.transitionDuration}ms ${props => props.transitionEasing};

  container-type: inline-size;
  container-name: player;
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

const AnimatedControlsContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isVisible'].includes(prop),
}) <{
  isVisible: boolean;
}>`
  display: grid;
  grid-template-rows: ${props => props.isVisible ? '1fr' : '0fr'};
  opacity: ${props => props.isVisible ? '1' : '0'};
  transition: grid-template-rows 150ms ease-out,
              opacity 150ms ease-out;

  > * {
    overflow: hidden;
    will-change: transform;
  }
`;

const PlayerContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
`;

// Album art container with click handler
const ClickableAlbumArtContainer = styled.div<{ $swipeEnabled?: boolean }>`
  position: relative;
  cursor: pointer;
  z-index: 3;
  /* Add subtle outer glow/shadow for separation from background */
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
  ${({ $swipeEnabled }) => $swipeEnabled && `
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
  `}
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

  const [controlsVisible, setControlsVisible] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const toggleControls = useCallback(() => {
    setControlsVisible(prev => !prev);
  }, []);

  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  // Use responsive sizing hook
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing, isMobile, isDesktop } = usePlayerSizing();

  // Swipe gesture for mobile/tablet track navigation
  const { offsetX, isSwiping, isAnimating, gestureHandlers } = useSwipeGesture({
    onSwipeLeft: handlers.onNext,
    onSwipeRight: handlers.onPrevious,
  }, { enabled: !isDesktop });

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
    onToggleLike: handlers.onToggleLike,
    onToggleHelp: toggleHelp,
    onToggleControls: toggleControls
  });

  return (
    <ContentWrapper
      width={dimensions.width}
      padding={padding}
      useFluidSizing={useFluidSizing}
      transitionDuration={transitionDuration}
      transitionEasing={transitionEasing}
    >
      <PlayerContainer>

        {/* Album Art Zone - Clickable to toggle controls */}
        <CardContent style={{
          position: 'relative',
          zIndex: 2,
          minHeight: 0,
          alignItems: 'center',
          paddingTop: isMobile ? '0.25rem' : '1rem'
        }}>
          <ClickableAlbumArtContainer
            $swipeEnabled={!isDesktop}
            {...(!isDesktop ? gestureHandlers : {})}
            onClick={!isSwiping && !isAnimating ? toggleControls : undefined}
            style={{
              transform: `translateX(${offsetX}px)`,
              transition: isAnimating ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
              willChange: isSwiping ? 'transform' : undefined,
            }}
          >
            {!isMobile && (
              <LeftQuickActionsPanel
                accentColor={ui.accentColor}
                glowEnabled={effects.enabled}
                onGlowToggle={handlers.onGlowToggle}
                onBackgroundVisualizerToggle={handlers.onBackgroundVisualizerToggle}
                backgroundVisualizerEnabled={handlers.backgroundVisualizerEnabled}
                isVisible={controlsVisible}
              />
            )}

            <AlbumArt
              currentTrack={track.current}
              accentColor={ui.accentColor}
              glowIntensity={effects.enabled ? effects.glow.intensity : 0}
              glowRate={effects.glow.rate}
              glowEnabled={effects.enabled}
              albumFilters={effects.enabled ? effects.filters : defaultFilters}
            />

            {!isMobile && (
              <QuickActionsPanel
                accentColor={ui.accentColor}
                currentTrack={track.current}
                onShowPlaylist={handlers.onShowPlaylist}
                onShowVisualEffects={handlers.onShowVisualEffects}
                onAccentColorChange={handlers.onAccentColorChange}
                onBackToLibrary={handlers.onBackToLibrary}
                debugModeEnabled={handlers.debugModeEnabled}
                isVisible={controlsVisible}
              />
            )}
          </ClickableAlbumArtContainer>
        </CardContent>
        <AnimatedControlsContainer isVisible={controlsVisible}>
          <LoadingCard
            backgroundImage={track.current?.image}
            accentColor={ui.accentColor}
            glowEnabled={effects.enabled}
            glowIntensity={effects.glow.intensity}
            glowRate={effects.glow.rate}
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
                  isLiked={track.isLiked}
                  isLikePending={track.isLikePending}
                  isMuted={track.isMuted}
                  volume={track.volume}
                  onMuteToggle={handlers.onMuteToggle}
                  onToggleLike={handlers.onToggleLike}
                  onPlayback={{
                    play: handlers.onPlay,
                    pause: handlers.onPause,
                    next: handlers.onNext,
                    previous: handlers.onPrevious
                  }}
                />
              </Suspense>
            </CardContent>

          </LoadingCard>
        </AnimatedControlsContainer>
      </PlayerContainer>
      {isMobile && (
        <MobileBottomMenu
          accentColor={ui.accentColor}
          currentTrack={track.current}
          glowEnabled={effects.enabled}
          backgroundVisualizerEnabled={handlers.backgroundVisualizerEnabled}
          onShowPlaylist={handlers.onShowPlaylist}
          onShowVisualEffects={handlers.onShowVisualEffects}
          onGlowToggle={handlers.onGlowToggle}
          onBackgroundVisualizerToggle={handlers.onBackgroundVisualizerToggle}
          onAccentColorChange={handlers.onAccentColorChange}
          onBackToLibrary={handlers.onBackToLibrary}
          debugModeEnabled={handlers.debugModeEnabled}
          transitionDuration={transitionDuration}
          transitionEasing={transitionEasing}
        />
      )}
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