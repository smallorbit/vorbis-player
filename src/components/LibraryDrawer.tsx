import React, { useCallback, useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import { theme } from '@/styles/theme';
import {
  DrawerOverlay,
  GripPill,
  SwipeHandle,
  DRAWER_TRANSITION_DURATION,
  DRAWER_TRANSITION_EASING
} from './styled';
import PlaylistSelection from './PlaylistSelection';
import ResumeCard from './QuickAccessPanel/ResumeCard';
import { LIBRARY_REFRESH_EVENT } from '@/hooks/useLibrarySync';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';
import type { SessionSnapshot } from '@/services/sessionPersistence';

const REFRESH_SPINNER_MIN_MS = 1500;

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (tracks: MediaTrack[], collectionId: string, collectionName: string, provider?: ProviderId) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  initialSearchQuery?: string;
  initialViewMode?: 'playlists' | 'albums';
  lastSession?: SessionSnapshot | null;
  onResume?: () => void;
}

const DrawerContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$isOpen', '$isDragging', '$dragOffset'].includes(prop),
}) <{
  $isOpen: boolean;
  $isDragging: boolean;
  $dragOffset: number;
}>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 85vh;
  max-height: 85vh;
  z-index: ${theme.zIndex.modal};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  -webkit-backdrop-filter: blur(${theme.drawer.backdropBlur});
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  transform: ${({ $isOpen, $isDragging, $dragOffset }) => {
    if ($isDragging) {
      return `translateY(${$dragOffset}px)`;
    }
    return $isOpen ? 'translateY(0)' : 'translateY(-100%)';
  }};
  transition: ${({ $isDragging }) =>
    $isDragging ? 'none' : `transform ${DRAWER_TRANSITION_DURATION}ms ${DRAWER_TRANSITION_EASING}`};
  will-change: ${({ $isDragging }) => ($isDragging ? 'transform' : 'auto')};

  /* Constrain width on desktop to match player content area */
  @media (min-width: ${theme.breakpoints.lg}) {
    max-width: 700px;
    margin-left: auto;
    margin-right: auto;
    border-radius: 0 0 ${theme.borderRadius.xl} ${theme.borderRadius.xl};
    border-left: 1px solid ${theme.colors.popover.border};
    border-right: 1px solid ${theme.colors.popover.border};
    border-bottom: 1px solid ${theme.colors.popover.border};
  }
`;

const DrawerContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);
`;

const LibraryDrawer = React.memo(function LibraryDrawer({ isOpen, onClose, onPlaylistSelect, onAddToQueue, onPlayLikedTracks, onQueueLikedTracks, initialSearchQuery, initialViewMode, lastSession, onResume }: LibraryDrawerProps) {
  const hasBeenOpenedRef = useRef(false);
  if (isOpen) hasBeenOpenedRef.current = true;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlaylistSelectWrapper = useCallback(
    (playlistId: string, playlistName: string, provider?: ProviderId) => {
      onClose();
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
      selectTimeoutRef.current = setTimeout(() => {
        selectTimeoutRef.current = null;
        onPlaylistSelect(playlistId, playlistName, provider);
      }, DRAWER_TRANSITION_DURATION);
    },
    [onClose, onPlaylistSelect]
  );

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    window.dispatchEvent(new Event(LIBRARY_REFRESH_EVENT));
    // Show spinner for a minimum duration then stop
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      setIsRefreshing(false);
      refreshTimeoutRef.current = null;
    }, REFRESH_SPINNER_MIN_MS);
  }, [isRefreshing]);

  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  const { ref: handleRef, isDragging, dragOffset } = useVerticalSwipeGesture({
    onSwipeUp: onClose,
    threshold: 80,
    enabled: isOpen,
  });

  const effectiveDragOffset = isOpen && isDragging ? dragOffset : 0;

  if (!hasBeenOpenedRef.current) return null;

  return createPortal(
    <>
      <DrawerOverlay $isOpen={isOpen} onClick={onClose} aria-hidden="true" />
      <DrawerContainer
        $isOpen={isOpen}
        $isDragging={isDragging}
        $dragOffset={effectiveDragOffset}
        role="dialog"
        aria-modal="true"
        aria-label="Library selection"
      >
        {isOpen && (
          <>
            <DrawerContent>
              <PlaylistSelection
                onPlaylistSelect={handlePlaylistSelectWrapper}
                onAddToQueue={onAddToQueue}
                onPlayLikedTracks={onPlayLikedTracks}
                onQueueLikedTracks={onQueueLikedTracks}
                inDrawer
                initialSearchQuery={initialSearchQuery}
                initialViewMode={initialViewMode}
                onLibraryRefresh={handleRefresh}
                isLibraryRefreshing={isRefreshing}
              />
              {lastSession && onResume && (
                <ResumeCard session={lastSession} onResume={onResume} />
              )}
            </DrawerContent>
            <SwipeHandle
              ref={handleRef}
              role="button"
              aria-label="Swipe up or tap to close library"
              onClick={onClose}
            >
              <GripPill />
            </SwipeHandle>
          </>
        )}
      </DrawerContainer>
    </>,
    document.body
  );
});

export default LibraryDrawer;
