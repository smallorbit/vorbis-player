import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useCurrentTrackContext } from '@/contexts/TrackContext';
import { useVisualEffectsToggle, useZenMode } from '@/contexts/visualEffects';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import { ZEN_ART_DURATION, ZEN_ART_ENTER_DELAY } from '@/constants/zenAnimation';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { AlbumArtBounds } from '@/types/visualizer';
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
  onOpenLibrary: () => void;
  onCloseLibrary: () => void;
  onOpenQuickAccessPanel?: () => void;
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  onAlbumPlay: (albumId: string, albumName: string) => void;
  onBackToLibrary: () => void;
  onStartRadio?: () => void;
  onRemoveFromQueue?: (index: number) => void;
  onReorderQueue?: (fromIndex: number, toIndex: number) => void;
}

interface PlayerContentProps {
  isPlaying: boolean;
  showLibrary: boolean;
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
  showLibrary,
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
  const { zenModeEnabled, setZenModeEnabled } = useZenMode();
  const { setShowVisualEffects } = useVisualEffectsToggle();
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing, isMobile, isTablet, hasPointerInput, isTouchDevice } = usePlayerSizingContext();
  const { isLiked, isLikePending, handleLikeToggle, canSaveTrack } = useLikeTrack(currentTrack?.id, currentTrack?.provider);

  const [qapEnabled] = useQapEnabled();

  const controlsRef = useRef<HTMLDivElement>(null);
  const stableControlsHeightRef = useRef<number>(220);
  const flipToggleRef = useRef<(() => void) | null>(null);
  const zenTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zenTransitioningRef = useRef(false);

  const [zenTransitioning, setZenTransitioning] = useState(false);

  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    /*
     * Skip --player-controls-height updates while a zen transition is running. On exit the
     * controls row expands 0 → full height via grid-template-rows; every intermediate frame
     * would otherwise drive this variable from 0 up to the final value, causing
     * PlayerStack.max-width's target to drift mid-transition and the album art to chase a
     * moving target, then snap when the variable finally settles at the end of the shrink.
     */
    const update = () => {
      if (zenTransitioningRef.current) return;
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

  useEffect(() => {
    return () => {
      if (zenTransitionTimeoutRef.current !== null) {
        clearTimeout(zenTransitionTimeoutRef.current);
        zenTransitionTimeoutRef.current = null;
      }
    };
  }, []);

  const handleShowQueue = useCallback(() => {
    handlers.onCloseLibrary();
    setShowVisualEffects(false);
    setShowQueue(prev => !prev);
  }, [setShowQueue, handlers, setShowVisualEffects]);

  const handleCloseQueue = useCallback(() => setShowQueue(false), [setShowQueue]);

  const handleOpenQueueFromToast = useCallback(() => {
    handlers.onCloseLibrary();
    setShowVisualEffects(false);
    setShowQueue(true);
  }, [handlers, setShowVisualEffects, setShowQueue]);

  const handleOpenLibrary = useCallback(() => {
    setShowQueue(false);
    setShowVisualEffects(false);
    handlers.onOpenLibrary();
  }, [handlers, setShowQueue, setShowVisualEffects]);

  const handleArtistBrowse = useCallback((_artistName: string) => {
    handleOpenLibrary();
  }, [handleOpenLibrary]);

  const handleAlbumPlay = useCallback((albumId: string, albumName: string) => {
    handlers.onAlbumPlay(albumId, albumName);
  }, [handlers]);

  const handleCloseLibrary = useCallback(() => {
    handlers.onCloseLibrary();
  }, [handlers]);

  const handleZenModeToggle = useCallback(() => {
    if (zenModeEnabled) {
      document.documentElement.style.setProperty(
        '--player-controls-height',
        `${stableControlsHeightRef.current}px`
      );
    }
    if (zenTransitionTimeoutRef.current !== null) {
      clearTimeout(zenTransitionTimeoutRef.current);
      zenTransitionTimeoutRef.current = null;
    }
    zenTransitioningRef.current = true;
    setZenTransitioning(true);
    setZenModeEnabled(prev => !prev);
    zenTransitionTimeoutRef.current = setTimeout(() => {
      zenTransitionTimeoutRef.current = null;
      zenTransitioningRef.current = false;
      setZenTransitioning(false);
    }, ZEN_ART_DURATION + ZEN_ART_ENTER_DELAY + 50);
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
    if (showLibrary) {
      handlers.onCloseLibrary();
    } else if (!qapEnabled) {
      handleOpenLibrary();
    } else if (handlers.onOpenQuickAccessPanel) {
      handlers.onOpenQuickAccessPanel();
    } else {
      handleOpenLibrary();
    }
  }, [showLibrary, handlers, handleOpenLibrary, qapEnabled]);


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
        <PlayerStack $zenMode={zenModeEnabled} $zenTransitioning={zenTransitioning}>
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
            showLibrary={showLibrary}
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
            onOpenLibrary={handleOpenLibrary}
            onCloseLibrary={handleCloseLibrary}
            onOpenQuickAccessPanel={handlers.onOpenQuickAccessPanel}
            onZenModeToggle={handleZenModeToggle}
            isRadioAvailable={isRadioAvailable}
            onStartRadio={handlers.onStartRadio}
            radioState={radioState}
            isLiked={isLiked}
            isLikePending={isLikePending}
            onLikeToggle={handleLikeToggle}
          />
        </PlayerStack>
      </PlayerContainer>
      <DrawerOrchestrator
        showQueue={showQueue}
        onCloseQueue={handleCloseQueue}
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
      />
    </ContentWrapper>
  );
});

PlayerContent.displayName = 'PlayerContent';

export default PlayerContent;
