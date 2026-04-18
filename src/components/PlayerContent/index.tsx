import React, { useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { useQapEnabled } from '@/hooks/useQapEnabled';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useCurrentTrackContext } from '@/contexts/TrackContext';
import { useVisualEffectsContext } from '@/contexts/VisualEffectsContext';
import { useLikeTrack } from '@/hooks/useLikeTrack';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { STORAGE_KEYS } from '@/constants/storage';
import {
  ZEN_ART_DURATION,
  ZEN_ART_EASING,
  ZEN_ART_ENTER_DELAY,
} from '@/constants/zenAnimation';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { RadioState, RadioProgress } from '@/types/radio';
import type { SessionSnapshot } from '@/services/sessionPersistence';
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

interface AlbumArtBounds {
  left: number;
  top: number;
  width: number;
  height: number;
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
  lastSession?: SessionSnapshot | null;
  onResume?: () => void;
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
  lastSession,
  onResume,
}) => {
  const { currentTrack, showQueue, setShowQueue } = useCurrentTrackContext();
  const { zenModeEnabled, setZenModeEnabled, setShowVisualEffects } = useVisualEffectsContext();
  const { dimensions, useFluidSizing, padding, transitionDuration, transitionEasing, isMobile, isTablet, hasPointerInput, isTouchDevice } = usePlayerSizingContext();
  const { isLiked, isLikePending, handleLikeToggle, canSaveTrack } = useLikeTrack(currentTrack?.id, currentTrack?.provider);
  const reducedMotion = useReducedMotion();

  const [qapEnabled] = useQapEnabled();

  const controlsRef = useRef<HTMLDivElement>(null);
  const stableControlsHeightRef = useRef<number>(220);
  const flipToggleRef = useRef<(() => void) | null>(null);
  const playerStackRef = useRef<HTMLDivElement>(null);
  const lastStackWidthRef = useRef<number | null>(null);

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

  useLayoutEffect(() => {
    const el = playerStackRef.current;
    if (!el) return;

    const prevWidth = lastStackWidthRef.current;
    const nextWidth = el.offsetWidth;
    lastStackWidthRef.current = nextWidth;

    if (prevWidth === null || prevWidth === 0 || nextWidth === 0 || reducedMotion) {
      el.style.transition = 'none';
      el.style.transform = '';
      return;
    }

    const ratio = prevWidth / nextWidth;
    if (Math.abs(ratio - 1) < 0.001) return;

    const enterDelay = zenModeEnabled ? ZEN_ART_ENTER_DELAY : 0;

    el.style.transition = 'none';
    el.style.transform = `scale(${ratio})`;
    void el.offsetWidth;
    el.style.transition = `transform ${ZEN_ART_DURATION}ms ${ZEN_ART_EASING} ${enterDelay}ms`;
    el.style.transform = 'scale(1)';
  }, [zenModeEnabled, reducedMotion]);

  useEffect(() => {
    const el = playerStackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      lastStackWidthRef.current = el.offsetWidth;
    });
    observer.observe(el);
    return () => observer.disconnect();
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

  const handleArtistBrowse = useCallback((artistName: string) => {
    localStorage.setItem(STORAGE_KEYS.LIBRARY_SEARCH, JSON.stringify(artistName));
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
        <PlayerStack $zenMode={zenModeEnabled} ref={playerStackRef}>
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
        showLibrary={showLibrary}
        onCloseLibrary={handleCloseLibrary}
        isPlaying={isPlaying}
        onPlaylistSelect={handlers.onPlaylistSelect}
        onAddToQueue={handlers.onAddToQueue}
        onPlayLikedTracks={handlers.onPlayLikedTracks}
        onQueueLikedTracks={handlers.onQueueLikedTracks}
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
        lastSession={lastSession}
        onResume={onResume}
      />
    </ContentWrapper>
  );
});

PlayerContent.displayName = 'PlayerContent';

export default PlayerContent;
