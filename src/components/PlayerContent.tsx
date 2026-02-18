import React, { Suspense, lazy, useState, useCallback } from 'react';
import styled from 'styled-components';
import { CardContent } from './styled';
import AlbumArt from './AlbumArt';
import SpotifyPlayerControls from './SpotifyPlayerControls';
import FabMenu from './FabMenu';
import { theme } from '@/styles/theme';
import { cardBase } from '../styles/utils';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import LibraryDrawer from './LibraryDrawer';
import type { Track } from '../services/spotify';
import type { VisualizerStyle } from '../types/visualizer';
import type { AlbumFilters } from '../types/filters';


const PlaylistDrawer = lazy(() => import('./PlaylistDrawer'));
const PlaylistBottomSheet = lazy(() => import('./PlaylistBottomSheet'));
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
  onMuteToggle?: () => void; // Mute toggle handler
  onToggleLike?: () => void; // Like toggle handler
  onBackToLibrary?: () => void; // Back to library navigation handler
  onOpenLibraryDrawer?: () => void;
  onCloseLibraryDrawer?: () => void;
  onPlaylistSelect?: (playlistId: string, playlistName: string) => void;
  onAlbumPlay?: (albumId: string, albumName: string) => void;
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
    showLibraryDrawer: boolean;
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

  height: 100%;
  margin: 0 auto;
  padding: ${props => props.padding}px;
  padding-bottom: ${props => props.padding}px;
  box-sizing: border-box;
  position: relative;
  z-index: 2;
  overflow: visible;

  transition: width ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            padding ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            max-width ${props => props.transitionDuration}ms ${props => props.transitionEasing};

  container-type: inline-size;
  container-name: player;
  display: flex;
  flex-direction: column;
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

const PlayerContainer = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;
`;

// Album art container with click handler
const ClickableAlbumArtContainer = styled.div<{ $swipeEnabled?: boolean; $bothGestures?: boolean }>`
  position: relative;
  cursor: pointer;
  z-index: 3;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Add subtle outer glow/shadow for separation from background */
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
  ${({ $swipeEnabled, $bothGestures }) => $swipeEnabled && `
    touch-action: ${$bothGestures ? 'none' : 'pan-y'};
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

  const [showHelp, setShowHelp] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState<string | undefined>(undefined);
  const [libraryViewMode, setLibraryViewMode] = useState<'playlists' | 'albums' | undefined>(undefined);

  const toggleHelp = useCallback(() => {
    setShowHelp(prev => !prev);
  }, []);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, []);

  // Handler: artist name clicked → open library drawer filtered to albums by that artist
  const handleArtistBrowse = useCallback((artistName: string) => {
    setLibrarySearchQuery(artistName);
    setLibraryViewMode('albums');
    handlers.onOpenLibraryDrawer?.();
  }, [handlers]);

  // Handler: album name clicked → play that album
  const handleAlbumPlay = useCallback((albumId: string, albumName: string) => {
    handlers.onAlbumPlay?.(albumId, albumName);
  }, [handlers]);

  // Reset library filter state when drawer closes
  const handleCloseLibraryDrawer = useCallback(() => {
    handlers.onCloseLibraryDrawer?.();
    // Clear after transition so the drawer doesn't flash with stale query
    setTimeout(() => {
      setLibrarySearchQuery(undefined);
      setLibraryViewMode(undefined);
    }, 350);
  }, [handlers]);

  // Use responsive sizing hook
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing, isMobile, isDesktop, hasPointerInput } = usePlayerSizing();

  // Swipe gesture for mobile/tablet track navigation
  const { offsetX, isSwiping, isAnimating, gestureHandlers } = useSwipeGesture({
    onSwipeLeft: handlers.onNext,
    onSwipeRight: handlers.onPrevious,
  }, { enabled: !isDesktop });

  // Vertical swipe on the full player area (mobile only): down = library, up = playlist
  // Disabled when a drawer is open so swipe-to-dismiss on the drawer itself works without conflict
  const { ref: verticalSwipeRef } = useVerticalSwipeGesture({
    onSwipeDown: handlers.onOpenLibraryDrawer,
    onSwipeUp: handlers.onShowPlaylist,
    threshold: 80,
    enabled: isMobile && !ui.showPlaylist && !ui.showLibraryDrawer,
  });

  // Combined close handler for Escape key (closes VFX menu, library drawer, and help modal)
  const handleEscapeClose = useCallback(() => {
    handleCloseLibraryDrawer();
    handlers.onCloseVisualEffects();
    if (showHelp) {
      closeHelp();
    }
  }, [handleCloseLibraryDrawer, handlers, showHelp, closeHelp]);

  // Combine play/pause for Space key
  const handlePlayPause = useCallback(() => {
    if (track.isPlaying) {
      handlers.onPause();
    } else {
      handlers.onPlay();
    }
  }, [handlers, track.isPlaying]);

  // ArrowUp/ArrowDown (desktop): toggle drawers, cross-dismiss (up dismisses library→playlist, down dismisses playlist→library)
  const handleArrowUp = useCallback(() => {
    if (ui.showLibraryDrawer) {
      handlers.onCloseLibraryDrawer?.();
      handlers.onShowPlaylist();
    } else if (ui.showPlaylist) {
      handlers.onClosePlaylist();
    } else {
      handlers.onShowPlaylist();
    }
  }, [handlers, ui.showLibraryDrawer, ui.showPlaylist]);

  const handleArrowDown = useCallback(() => {
    if (ui.showPlaylist) {
      handlers.onClosePlaylist();
      handlers.onOpenLibraryDrawer?.();
    } else if (ui.showLibraryDrawer) {
      handlers.onCloseLibraryDrawer?.();
    } else {
      handlers.onOpenLibraryDrawer?.();
    }
  }, [handlers, ui.showPlaylist, ui.showLibraryDrawer]);

  // Set up keyboard shortcuts
  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onNext: handlers.onNext,
    onPrevious: handlers.onPrevious,
    onClosePlaylist: handlers.onClosePlaylist,
    onToggleVisualEffectsMenu: handlers.onToggleVisualEffectsMenu,
    onCloseVisualEffects: handleEscapeClose,
    onToggleBackgroundVisualizer: handlers.onBackgroundVisualizerToggle,
    onToggleGlow: handlers.onGlowToggle,
    onMute: handlers.onMuteToggle,
    onToggleLike: handlers.onToggleLike,
    onToggleHelp: toggleHelp,
    onShowPlaylist: handleArrowUp,
    onOpenLibraryDrawer: handleArrowDown,
  }, { prefersPointerInput: hasPointerInput });

  return (
    <ContentWrapper
      ref={isMobile ? verticalSwipeRef : undefined}
      width={dimensions.width}
      padding={padding}
      useFluidSizing={useFluidSizing}
      transitionDuration={transitionDuration}
      transitionEasing={transitionEasing}
      style={{ touchAction: isMobile ? 'pan-x' : undefined }}
    >
      <PlayerContainer>

        {/* Album Art Zone - Clickable to toggle play/pause */}
        <CardContent style={{
          position: 'relative',
          zIndex: 2,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: isMobile ? '0.25rem' : '1rem'
        }}>
          <ClickableAlbumArtContainer
            $swipeEnabled={!isDesktop}
            $bothGestures={false}
            {...(!isDesktop ? gestureHandlers : {})}
            onClick={!isSwiping && !isAnimating ? handlePlayPause : undefined}
            style={{
              transform: `translateX(${offsetX}px)`,
              transition: isAnimating ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
              willChange: isSwiping ? 'transform' : undefined,
            }}
          >
            <AlbumArt
              currentTrack={track.current}
              accentColor={ui.accentColor}
              glowIntensity={effects.enabled ? effects.glow.intensity : 0}
              glowRate={effects.glow.rate}
              glowEnabled={effects.enabled}
              albumFilters={effects.enabled ? effects.filters : defaultFilters}
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
              <SpotifyPlayerControls
                currentTrack={track.current}
                accentColor={ui.accentColor}
                trackCount={track.list.length}
                isLiked={track.isLiked}
                isLikePending={track.isLikePending}
                isMuted={track.isMuted}
                volume={track.volume}
                onMuteToggle={handlers.onMuteToggle}
                onToggleLike={handlers.onToggleLike}
                onPlay={handlers.onPlay}
                onPause={handlers.onPause}
                onNext={handlers.onNext}
                onPrevious={handlers.onPrevious}
                onArtistBrowse={handleArtistBrowse}
                onAlbumPlay={handleAlbumPlay}
              />
            </Suspense>
          </CardContent>
        </LoadingCard>
        <FabMenu
          accentColor={ui.accentColor}
          currentTrack={track.current}
          glowEnabled={effects.enabled}
          backgroundVisualizerEnabled={handlers.backgroundVisualizerEnabled}
          onShowVisualEffects={handlers.onShowVisualEffects}
          onGlowToggle={handlers.onGlowToggle}
          onBackgroundVisualizerToggle={handlers.onBackgroundVisualizerToggle}
          onAccentColorChange={handlers.onAccentColorChange}
          onBackToLibrary={handlers.onBackToLibrary}
          onShowPlaylist={handlers.onShowPlaylist}
        />
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
        {isMobile ? (
          <PlaylistBottomSheet
            isOpen={ui.showPlaylist}
            onClose={handlers.onClosePlaylist}
            tracks={track.list}
            currentTrackIndex={track.currentIndex}
            accentColor={ui.accentColor}
            onTrackSelect={handlers.onTrackSelect}
          />
        ) : (
          <PlaylistDrawer
            isOpen={ui.showPlaylist}
            onClose={handlers.onClosePlaylist}
            tracks={track.list}
            currentTrackIndex={track.currentIndex}
            accentColor={ui.accentColor}
            onTrackSelect={handlers.onTrackSelect}
          />
        )}
      </Suspense>
      <Suspense fallback={null}>
        <KeyboardShortcutsHelp isOpen={showHelp} onClose={closeHelp} />
      </Suspense>
      <LibraryDrawer
        isOpen={ui.showLibraryDrawer}
        onClose={handleCloseLibraryDrawer}
        onPlaylistSelect={handlers.onPlaylistSelect || (() => { })}
        initialSearchQuery={librarySearchQuery}
        initialViewMode={libraryViewMode}
      />
    </ContentWrapper>
  );
};

export default PlayerContent;