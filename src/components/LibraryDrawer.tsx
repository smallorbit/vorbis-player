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
    $isDragging ? 'none' : `transform ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`};
  will-change: ${({ $isDragging }) => ($isDragging ? 'transform' : 'auto')};
`;

/** Dedicated swipe-to-close zone; spans full width so edge swipes work. touch-action: none so gesture captures. */
const DrawerHeader = styled.div`
  flex-shrink: 0;
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  min-height: 48px;
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  touch-action: none;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.15s ease;
  padding: 0;

  &:active {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const DrawerTitle = styled.h3`
  color: ${theme.colors.white};
  margin: 0;
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
  text-align: center;
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
              <CloseButton onClick={onClose} aria-label="Close library">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 7L10 13L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </CloseButton>
              <DrawerTitle>Library</DrawerTitle>
              <div />
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
