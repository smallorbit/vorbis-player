import { useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import { theme } from '@/styles/theme';
import PlaylistSelection from './PlaylistSelection';

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaylistSelect: (playlistId: string, playlistName: string) => void;
}

const TRANSITION_DURATION = 300;
const TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

const DrawerOverlay = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== '$isOpen',
}) <{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  z-index: ${theme.zIndex.modal};
  background: rgba(0, 0, 0, 0.6);
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  transition: opacity ${TRANSITION_DURATION}ms ${TRANSITION_EASING};
`;

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
  height: 80vh;
  max-height: 80vh;
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
    $isDragging ? 'none' : `transform ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`};
  will-change: ${({ $isDragging }) => ($isDragging ? 'transform' : 'auto')};
`;

/** Dedicated swipe-to-close zone; spans full width so edge swipes work. touch-action: none so gesture captures. */
const DrawerHeader = styled.div`
  flex-shrink: 0;
  padding: ${theme.spacing.md} ${theme.spacing.lg} ${theme.spacing.sm};
  min-height: 48px;
  display: flex;
  align-items: center;
  touch-action: none;
`;

const DrawerTitle = styled.h3`
  color: ${theme.colors.white};
  margin: 0;
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
`;

const DrawerContent = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

/** Grip handle at bottom; swipe up to dismiss. touch-action: none so gesture captures. */
const DrawerHandle = styled.div`
  flex-shrink: 0;
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.sm} 0;
  cursor: grab;
  touch-action: none;

  &:active {
    cursor: grabbing;
  }
`;

const GripPill = styled.div`
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
`;

export function LibraryDrawer({ isOpen, onClose, onPlaylistSelect }: LibraryDrawerProps) {
  const selectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePlaylistSelectWrapper = useCallback(
    (playlistId: string, playlistName: string) => {
      onClose();
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
      selectTimeoutRef.current = setTimeout(() => {
        selectTimeoutRef.current = null;
        onPlaylistSelect(playlistId, playlistName);
      }, 320);
    },
    [onClose, onPlaylistSelect]
  );

  useEffect(() => {
    return () => {
      if (selectTimeoutRef.current) clearTimeout(selectTimeoutRef.current);
    };
  }, []);

  const { ref: handleRef, isDragging, dragOffset } = useVerticalSwipeGesture({
    onSwipeUp: onClose,
    threshold: 80,
    enabled: isOpen,
  });

  const effectiveDragOffset = isOpen && isDragging ? dragOffset : 0;

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
            <DrawerHeader>
              <DrawerTitle>Library</DrawerTitle>
            </DrawerHeader>
            <DrawerContent>
              <PlaylistSelection
                onPlaylistSelect={handlePlaylistSelectWrapper}
                inDrawer
              />
            </DrawerContent>
            <DrawerHandle
              ref={handleRef}
              role="button"
              aria-label="Swipe up or tap to close library"
              onClick={onClose}
            >
              <GripPill />
            </DrawerHandle>
          </>
        )}
      </DrawerContainer>
    </>,
    document.body
  );
}

export default LibraryDrawer;
