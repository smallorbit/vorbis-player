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
  background: rgba(22, 21, 21, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  touch-action: pan-y;
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

const CloseButton = styled.button`
  position: absolute;
  bottom: ${theme.spacing.sm};
  right: ${theme.spacing.sm};
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: ${theme.borderRadius.md};
  color: ${theme.colors.muted.foreground};
  font-size: 1rem;
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  z-index: 1;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: ${theme.colors.white};
  }
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

  const { ref: drawerRef, isDragging, dragOffset } = useVerticalSwipeGesture({
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
            <PlaylistSelection
              onPlaylistSelect={handlePlaylistSelectWrapper}
              inDrawer
              swipeZoneRef={drawerRef}
            />
            <CloseButton onClick={onClose} aria-label="Close library">
              ×
            </CloseButton>
          </>
        )}
      </DrawerContainer>
    </>,
    document.body
  );
}

export default LibraryDrawer;
