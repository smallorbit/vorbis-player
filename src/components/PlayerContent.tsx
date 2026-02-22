import React, { Suspense, lazy, useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { CardContent } from './styled';
import AlbumArt from './AlbumArt';
import SpotifyPlayerControls from './SpotifyPlayerControls';
import BottomBar from './BottomBar';
import { BOTTOM_BAR_HEIGHT } from './BottomBar/styled';
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
  onVolumeChange?: (volume: number) => void; // Volume slider change handler
  onToggleLike?: () => void; // Like toggle handler
  onBackToLibrary?: () => void; // Back to library navigation handler
  onZenModeToggle?: () => void; // Zen mode toggle handler
  zenModeEnabled?: boolean; // Zen mode state
  onShuffleToggle?: () => void; // Shuffle toggle handler
  shuffleEnabled?: boolean; // Shuffle enabled state
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
    zenMode: boolean;
  };
  effects: {
    enabled: boolean;
    glow: { intensity: number; rate: number };
    filters: AlbumFilters;
  };
  handlers: PlayerContentHandlers;
}

const ContentWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => !['width', 'padding', 'useFluidSizing', 'transitionDuration', 'transitionEasing', '$zenMode'].includes(prop),
}) <{
  width: number;
  padding: number;
  useFluidSizing: boolean;
  transitionDuration: number;
  transitionEasing: string;
  $zenMode?: boolean;
}>`
  width: ${props => props.$zenMode ? '100%' : props.useFluidSizing ? '100%' : `${props.width}px`};
  max-width: ${props => props.$zenMode ? '100%' : `${props.width}px`};

  margin: 0 auto;
  padding: ${props => props.padding}px;
  padding-bottom: ${props => props.$zenMode ? props.padding : `calc(${props.padding + BOTTOM_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`};
  box-sizing: border-box;
  position: relative;
  z-index: 2;
  overflow: visible;

  transition: width ${props => props.$zenMode ? '1000ms cubic-bezier(0.4, 0, 0.2, 1) 300ms' : '1000ms cubic-bezier(0.4, 0, 0.2, 1)'},
            padding ${props => props.transitionDuration}ms ${props => props.transitionEasing},
            padding-bottom ${props => props.$zenMode ? '1000ms cubic-bezier(0.4, 0, 0.2, 1) 300ms' : '1000ms cubic-bezier(0.4, 0, 0.2, 1)'},
            max-width ${props => props.$zenMode ? '1000ms cubic-bezier(0.4, 0, 0.2, 1) 300ms' : '1000ms cubic-bezier(0.4, 0, 0.2, 1)'};

  container-type: inline-size;
  container-name: player;
  display: flex;
  flex-direction: column;
  /* Prevent overflow on tablets; content must fit above bottom bar + safe area */
  max-height: ${props => props.$zenMode ? 'none' : '100dvh'};
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
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
  margin-left: 0.25rem;
  margin-right: 0.25rem;
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

const PlayerContainer = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const PlayerStack = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$zenMode'].includes(prop),
})<{ $zenMode?: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0; /* Allow flex shrink so content fits above bottom bar */
  max-width: ${({ $zenMode }) => $zenMode
    ? `min(calc(100vw - 32px), calc(100dvh - 80px))`
    : `min(calc(100vw - 48px), calc(100dvh - var(--player-controls-height, 220px) - 120px))`
  };
  margin: 0 auto;
  /* Entering zen: art grows after controls fade out (300ms delay). Exiting zen: art shrinks immediately. */
  transition: ${({ $zenMode }) => $zenMode
    ? 'max-width 1000ms cubic-bezier(0.4, 0, 0.2, 1) 300ms'
    : 'max-width 1000ms cubic-bezier(0.4, 0, 0.2, 1)'
  };
`;

const ZenControlsWrapper = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$zenMode'].includes(prop),
})<{ $zenMode: boolean }>`
  display: grid;
  grid-template-rows: ${({ $zenMode }) => $zenMode ? '0fr' : '1fr'};
  opacity: ${({ $zenMode }) => $zenMode ? 0 : 1};
  transform: ${({ $zenMode }) => $zenMode ? 'scale(0.95) translateY(-8px)' : 'scale(1) translateY(0)'};
  transform-origin: top center;
  /*
   * grid-template-rows animates over the actual element height (unlike max-height which
   * animates over an arbitrary 500px range, causing non-linear perceived speed).
   * Entering zen: controls collapse + fade in 300ms, then art expands (300ms delay).
   * Exiting zen: art shrinks first (1000ms), then controls expand + fade in (350ms).
   * --player-controls-height is pre-set synchronously via stableControlsHeightRef before
   * the state flip, so PlayerStack has the correct target from the first animation frame.
   */
  transition: ${({ $zenMode }) => $zenMode
    ? 'grid-template-rows 300ms ease, opacity 300ms ease, transform 300ms ease'
    : 'grid-template-rows 500ms ease 500ms, opacity 1200ms ease 1200ms, transform 300ms ease 300ms'
  };
  pointer-events: ${({ $zenMode }) => $zenMode ? 'none' : 'auto'};
`;

// Direct grid item — min-height: 0 allows the grid row to collapse to 0fr,
// overflow: hidden clips content during the collapse animation.
const ZenControlsInner = styled.div`
  min-height: 0;
  overflow: hidden;
`;

// Album art container with click handler
const ClickableAlbumArtContainer = styled.div<{ $swipeEnabled?: boolean; $bothGestures?: boolean }>`
  position: relative;
  cursor: pointer;
  z-index: 3;
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
  // isTouchDevice: pointer-capability-based (true on any touch-primary device regardless of viewport size)
  // isMobile: viewport-width-based (use only for layout/spacing decisions)
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing, isMobile, hasPointerInput, isTouchDevice } = usePlayerSizing();

  // Measure the controls card height so album art can fill exactly the remaining space.
  // We set --player-controls-height on :root so AlbumArt can reference it in CSS.
  // stableControlsHeightRef preserves the last fully-visible height so we can restore it
  // synchronously before exiting zen, avoiding a ResizeObserver race with the CSS transition.
  const controlsRef = useRef<HTMLDivElement>(null);
  const stableControlsHeightRef = useRef<number>(220);
  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const update = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      // Only store when controls are clearly visible — avoids capturing near-zero values
      // that appear mid-animation as controls collapse into zen mode.
      if (h > 50) {
        stableControlsHeightRef.current = h;
        document.documentElement.style.setProperty('--player-controls-height', `${h}px`);
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, []);

  // Wraps the zen toggle to pre-set --player-controls-height synchronously before exiting zen.
  // This ensures PlayerStack/AlbumArtContainer start their max-width transitions toward the
  // correct target immediately, rather than after a ResizeObserver callback arrives.
  const handleZenModeToggle = useCallback(() => {
    if (ui.zenMode) {
      document.documentElement.style.setProperty(
        '--player-controls-height',
        `${stableControlsHeightRef.current}px`
      );
    }
    handlers.onZenModeToggle?.();
  }, [ui.zenMode, handlers.onZenModeToggle]);

  // Swipe gesture for track navigation: enabled on any touch-primary device (finger input),
  // regardless of viewport width — a high-res tablet is still a touch device.
  const { offsetX, isSwiping, isAnimating, gestureHandlers } = useSwipeGesture({
    onSwipeLeft: handlers.onNext,
    onSwipeRight: handlers.onPrevious,
  }, { enabled: isTouchDevice });

  // Vertical swipe on album art: up = exit zen (zen→normal), down = enter zen (normal→zen).
  // Drawers are controlled only by menu buttons, not gestures.
  const handleZenSwipeUp = useCallback(() => {
    if (ui.zenMode) handleZenModeToggle();
  }, [ui.zenMode, handleZenModeToggle]);
  const handleZenSwipeDown = useCallback(() => {
    if (!ui.zenMode) handleZenModeToggle();
  }, [ui.zenMode, handleZenModeToggle]);
  const { ref: zenVerticalSwipeRef } = useVerticalSwipeGesture({
    onSwipeUp: handleZenSwipeUp,
    onSwipeDown: handleZenSwipeDown,
    threshold: 80,
    enabled: isTouchDevice,
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

  const handleVolumeUp = useCallback(() => {
    const newVolume = Math.min(100, (track.volume ?? 50) + 5);
    handlers.onVolumeChange?.(newVolume);
  }, [track.volume, handlers]);

  const handleVolumeDown = useCallback(() => {
    const newVolume = Math.max(0, (track.volume ?? 50) - 5);
    handlers.onVolumeChange?.(newVolume);
  }, [track.volume, handlers]);

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
    onVolumeUp: handleVolumeUp,
    onVolumeDown: handleVolumeDown,
    onToggleLike: handlers.onToggleLike,
    onToggleHelp: toggleHelp,
    onShowPlaylist: handleArrowUp,
    onOpenLibraryDrawer: handleArrowDown,
    onToggleZenMode: handleZenModeToggle,
  }, { prefersPointerInput: hasPointerInput });

  return (
    <ContentWrapper
      width={dimensions.width}
      padding={padding}
      useFluidSizing={useFluidSizing}
      transitionDuration={transitionDuration}
      transitionEasing={transitionEasing}
      $zenMode={ui.zenMode}
    >
      <PlayerContainer>

        <PlayerStack $zenMode={ui.zenMode}>
          {/* Album Art Zone - Clickable to toggle play/pause */}
          <CardContent style={{
            position: 'relative',
            zIndex: 2,
            minHeight: 0,
            alignItems: 'center',
            paddingTop: ui.zenMode ? '0' : (isMobile ? '0.25rem' : '0.5rem')
          }}>
            <ClickableAlbumArtContainer
              ref={isTouchDevice ? zenVerticalSwipeRef : undefined}
              $swipeEnabled={isTouchDevice}
              $bothGestures={isTouchDevice}
              {...(isTouchDevice ? gestureHandlers : {})}
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
                zenMode={ui.zenMode}
              />
            </ClickableAlbumArtContainer>
          </CardContent>
          <ZenControlsWrapper $zenMode={ui.zenMode}>
            <ZenControlsInner ref={controlsRef}>
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
                  minHeight: 'auto',
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
            </ZenControlsInner>
          </ZenControlsWrapper>
        </PlayerStack>
      </PlayerContainer>
      <BottomBar
        accentColor={ui.accentColor}
        currentTrack={track.current}
        zenModeEnabled={ui.zenMode}
        isMuted={track.isMuted ?? false}
        volume={track.volume ?? 50}
        onMuteToggle={handlers.onMuteToggle}
        onVolumeChange={handlers.onVolumeChange}
        onShowVisualEffects={handlers.onShowVisualEffects}
        onAccentColorChange={handlers.onAccentColorChange}
        onBackToLibrary={handlers.onBackToLibrary}
        onShowPlaylist={handlers.onShowPlaylist}
        onZenModeToggle={handleZenModeToggle}
        shuffleEnabled={handlers.shuffleEnabled}
        onShuffleToggle={handlers.onShuffleToggle}
      />
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
            glowEnabled={effects.enabled}
            onGlowToggle={handlers.onGlowToggle}
            glowIntensity={effects.glow.intensity}
            setGlowIntensity={handlers.onGlowIntensityChange}
            glowRate={effects.glow.rate}
            setGlowRate={handlers.onGlowRateChange}
            effectiveGlow={effects.glow}
            backgroundVisualizerEnabled={handlers.backgroundVisualizerEnabled || false}
            onBackgroundVisualizerToggle={handlers.onBackgroundVisualizerToggle || (() => {})}
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