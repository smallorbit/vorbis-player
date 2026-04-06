import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useCurrentTrackContext } from '@/contexts/TrackContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { RadioState, RadioProgress } from '@/types/radio';
import { ContentWrapper, PlayerContainer, PlayerStack } from './styled';
import { AlbumArtSection } from './AlbumArtSection';
import { PlayerControlsSection } from './PlayerControlsSection';
import { DrawerOrchestrator } from './DrawerOrchestrator';

export interface PlaybackHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onTrackSelect: (index: number) => void;
  onOpenLibraryDrawer: () => void;
  onCloseLibraryDrawer: () => void;
  onOpenQuickAccessPanel?: () => void;
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onAlbumPlay: (albumId: string, albumName: string) => void;
  onBackToLibrary: () => void;
  onStartRadio?: () => void;
  onRemoveFromQueue?: (index: number) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
}

interface AlbumArtBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PlayerContentProps {
  isPlaying: boolean;
  showLibraryDrawer: boolean;
  onAlbumArtBoundsChange?: (bounds: AlbumArtBounds | null) => void;
  handlers: PlaybackHandlers;
  currentTrackProvider?: ProviderId;
  radioState?: RadioState;
  isRadioAvailable?: boolean;
  radioActive?: boolean;
  mediaTracksRef?: React.RefObject<MediaTrack[]>;
  radioProgress?: RadioProgress | null;
  onDismissRadioProgress?: () => void;
}

const PlayerContent: React.FC<PlayerContentProps> = React.memo(({
  isPlaying,
  showLibraryDrawer,
  onAlbumArtBoundsChange,
  handlers,
  currentTrackProvider,
  radioState,
  isRadioAvailable,
  radioActive,
  mediaTracksRef,
  radioProgress,
  onDismissRadioProgress,
}) => {
  const { currentTrack, showQueue, setShowQueue } = useCurrentTrackContext();
  const { zenModeEnabled, setZenModeEnabled, setShowVisualEffects } = useVisualEffectsContext();
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing, isMobile, isTablet, hasPointerInput, isTouchDevice } = usePlayerSizingContext();
  const { isLiked, isLikePending, handleLikeToggle, canSaveTrack } = useLikeTrack(currentTrack?.id, currentTrack?.provider);

  const [librarySearchQuery, setLibrarySearchQuery] = useState<string | undefined>(undefined);
  const [libraryViewMode, setLibraryViewMode] = useState<'playlists' | 'albums' | undefined>(undefined);

  const controlsRef = useRef<HTMLDivElement>(null);
  const stableControlsHeightRef = useRef<number>(220);
  const flipToggleRef = useRef<(() => void) | null>(null);
  const handleFlipToggle = useCallback(() => flipToggleRef.current?.(), []);

  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const update = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
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

  const handleShowQueue = useCallback(() => {
    handlers.onCloseLibraryDrawer();
    setShowVisualEffects(false);
    setShowQueue(prev => !prev);
  }, [setShowQueue, handlers, setShowVisualEffects]);

  const handleCloseQueue = useCallback(() => setShowQueue(false), [setShowQueue]);

  const handleOpenQueueFromToast = useCallback(() => {
    handlers.onCloseLibraryDrawer();
    setShowVisualEffects(false);
    setShowQueue(true);
  }, [handlers, setShowVisualEffects, setShowQueue]);

  const handleOpenLibraryDrawer = useCallback(() => {
    setShowQueue(false);
    setShowVisualEffects(false);
    handlers.onOpenLibraryDrawer();
  }, [handlers, setShowQueue, setShowVisualEffects]);

  const handleArtistBrowse = useCallback((artistName: string) => {
    setLibrarySearchQuery(artistName);
    setLibraryViewMode('albums');
    handleOpenLibraryDrawer();
  }, [handleOpenLibraryDrawer]);

  const handleAlbumPlay = useCallback((albumId: string, albumName: string) => {
    handlers.onAlbumPlay(albumId, albumName);
  }, [handlers]);

  const handleCloseLibraryDrawer = useCallback(() => {
    handlers.onCloseLibraryDrawer();
  }, [handlers]);

  const handleZenModeToggle = useCallback(() => {
    if (zenModeEnabled) {
      document.documentElement.style.setProperty(
        '--player-controls-height',
        `${stableControlsHeightRef.current}px`
      );
    }
    setZenModeEnabled(prev => !prev);
  }, [zenModeEnabled, setZenModeEnabled]);

  const handleZenExitClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (zenModeEnabled && e.currentTarget.contains(e.target as Node)) {
      handleZenModeToggle();
    }
  }, [zenModeEnabled, handleZenModeToggle]);

  const handleSwipeUp = useCallback(() => {
    if (showQueue) {
      handleCloseQueue();
    } else {
      handleShowQueue();
    }
  }, [showQueue, handleShowQueue, handleCloseQueue]);

  const handleSwipeDown = useCallback(() => {
    if (showLibraryDrawer) {
      handlers.onCloseLibraryDrawer();
    } else if (handlers.onOpenQuickAccessPanel) {
      handlers.onOpenQuickAccessPanel();
    } else {
      handleOpenLibraryDrawer();
    }
  }, [showLibraryDrawer, handlers, handleOpenLibraryDrawer]);

  const handleLibrarySearchQueryReset = useCallback(() => setLibrarySearchQuery(undefined), []);
  const handleLibraryViewModeReset = useCallback(() => setLibraryViewMode(undefined), []);

  return (
    <ContentWrapper
      width={dimensions.width}
      padding={padding}
      useFluidSizing={useFluidSizing}
      transitionDuration={transitionDuration}
      transitionEasing={transitionEasing}
      $zenMode={zenModeEnabled}
      onClick={handleZenExitClick}
    >
      <PlayerContainer>
        <PlayerStack $zenMode={zenModeEnabled}>
          <AlbumArtSection
            currentTrack={currentTrack}
            currentTrackProvider={currentTrackProvider}
            zenModeEnabled={zenModeEnabled}
            isMobile={isMobile}
            isTablet={isTablet}
            isTouchDevice={isTouchDevice}
            hasPointerInput={hasPointerInput}
            isPlaying={isPlaying}
            onSwipeLeft={handlers.onNext}
            onSwipeRight={handlers.onPrevious}
            onSwipeUp={handleSwipeUp}
            onSwipeDown={handleSwipeDown}
            onAlbumArtBoundsChange={onAlbumArtBoundsChange}
            onPlay={handlers.onPlay}
            onPause={handlers.onPause}
            onNext={handlers.onNext}
            onPrevious={handlers.onPrevious}
            isLiked={isLiked}
            canSaveTrack={canSaveTrack}
            onLikeToggle={handleLikeToggle}
            flipToggleRef={flipToggleRef}
          />
          <PlayerControlsSection
            currentTrack={currentTrack}
            currentTrackProvider={currentTrackProvider}
            isPlaying={isPlaying}
            zenModeEnabled={zenModeEnabled}
            hasPointerInput={hasPointerInput}
            showLibraryDrawer={showLibraryDrawer}
            showQueue={showQueue}
            controlsRef={controlsRef}
            onPlay={handlers.onPlay}
            onPause={handlers.onPause}
            onNext={handlers.onNext}
            onPrevious={handlers.onPrevious}
            onArtistBrowse={handleArtistBrowse}
            onAlbumPlay={handleAlbumPlay}
            onShowQueue={handleShowQueue}
            onCloseQueue={handleCloseQueue}
            onOpenLibraryDrawer={handleOpenLibraryDrawer}
            onCloseLibraryDrawer={handleCloseLibraryDrawer}
            onZenModeToggle={handleZenModeToggle}
            isRadioAvailable={isRadioAvailable}
            onStartRadio={handlers.onStartRadio}
            radioState={radioState}
            isLiked={isLiked}
            isLikePending={isLikePending}
            onLikeToggle={handleLikeToggle}
            onFlipToggle={handleFlipToggle}
          />
        </PlayerStack>
      </PlayerContainer>
      <DrawerOrchestrator
        showQueue={showQueue}
        onCloseQueue={handleCloseQueue}
        showLibraryDrawer={showLibraryDrawer}
        onCloseLibraryDrawer={handleCloseLibraryDrawer}
        onPlaylistSelect={handlers.onPlaylistSelect}
        onAddToQueue={handlers.onAddToQueue}
        onTrackSelect={handlers.onTrackSelect}
        onRemoveFromQueue={handlers.onRemoveFromQueue}
        onReorderQueue={handlers.onReorderQueue}
        isMobile={isMobile}
        radioActive={radioActive}
        radioState={radioState}
        mediaTracksRef={mediaTracksRef}
        radioProgress={radioProgress}
        onDismissRadioProgress={onDismissRadioProgress}
        onOpenQueueFromToast={handleOpenQueueFromToast}
        librarySearchQuery={librarySearchQuery}
        libraryViewMode={libraryViewMode}
        onLibrarySearchQueryReset={handleLibrarySearchQueryReset}
        onLibraryViewModeReset={handleLibraryViewModeReset}
      />
    </ContentWrapper>
  );
});

PlayerContent.displayName = 'PlayerContent';

export default PlayerContent;
