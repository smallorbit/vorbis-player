import React, { Suspense, memo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import { theme } from '@/styles/theme';
import type { Track } from '../services/spotify';

const Playlist = React.lazy(() => import('./Playlist'));

const TRANSITION_DURATION = 300;
const TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

const DrawerOverlay = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== '$isOpen',
})<{ $isOpen: boolean }>`
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
})<{
  $isOpen: boolean;
  $isDragging: boolean;
  $dragOffset: number;
}>`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 85vh;
  z-index: ${theme.zIndex.modal};
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  -webkit-backdrop-filter: blur(${theme.drawer.backdropBlur});
  border-top-left-radius: ${theme.borderRadius['2xl']};
  border-top-right-radius: ${theme.borderRadius['2xl']};
  border-top: 1px solid ${theme.colors.popover.border};
  overflow: hidden;
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  display: flex;
  flex-direction: column;
  transform: ${({ $isOpen, $isDragging, $dragOffset }) => {
    if ($isDragging) {
      return `translateY(${$dragOffset}px)`;
    }
    return $isOpen ? 'translateY(0)' : 'translateY(100%)';
  }};
  transition: ${({ $isDragging }) =>
    $isDragging ? 'none' : `transform ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`};
  will-change: ${({ $isDragging }) => ($isDragging ? 'transform' : 'auto')};
`;

const DismissHandle = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  touch-action: none;
  padding: 12px 0;
  background: ${theme.colors.overlay.dark};
  flex-shrink: 0;
`;

const HandlePill = styled.div`
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
`;

const SheetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 ${theme.spacing.md} ${theme.spacing.md};
  flex-shrink: 0;
`;

const SheetTitle = styled.h3`
  color: ${theme.colors.white};
  margin: 0;
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${theme.colors.muted.foreground};
  font-size: ${theme.fontSize.xl};
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all ${theme.transitions.fast};

  &:hover {
    background: ${theme.colors.muted.background};
    color: ${theme.colors.white};
  }
`;

const SheetContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 ${theme.spacing.md} ${theme.spacing.md};
  min-height: 0;

  > div:first-child {
    margin-top: 0;
  }

  > div:last-child {
    margin-bottom: 0;
  }
`;

const PlaylistFallback = styled.div`
  width: 100%;
  padding: ${theme.spacing.lg};
`;

const PlaylistFallbackCard = styled.div`
  background-color: ${theme.colors.gray[800]};
  border-radius: ${theme.borderRadius['2xl']};
  padding: ${theme.spacing.md};
  border: 1px solid ${theme.colors.gray[700]};
`;

interface PlaylistBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  currentTrackIndex: number;
  accentColor: string;
  onTrackSelect: (index: number) => void;
}

export const PlaylistBottomSheet = memo<PlaylistBottomSheetProps>(function PlaylistBottomSheet({
  isOpen,
  onClose,
  tracks,
  currentTrackIndex,
  accentColor,
  onTrackSelect,
}) {
  const { ref: handleRef, isDragging, dragOffset } = useVerticalSwipeGesture({
    onSwipeDown: onClose,
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
        aria-label="Playlist"
      >
        <DismissHandle ref={handleRef} onClick={onClose} role="button" aria-label="Close playlist">
          <HandlePill />
        </DismissHandle>
        <SheetHeader>
          <SheetTitle>Playlist ({tracks.length} tracks)</SheetTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </SheetHeader>
        <SheetContent>
          {isOpen && (
            <Suspense
              fallback={
                <PlaylistFallback>
                  <PlaylistFallbackCard>
                    <div
                      style={{
                        animation: theme.animations.pulse,
                        color: theme.colors.muted.foreground,
                        textAlign: 'center',
                      }}
                    >
                      Loading playlist...
                    </div>
                  </PlaylistFallbackCard>
                </PlaylistFallback>
              }
            >
              <Playlist
                tracks={tracks}
                currentTrackIndex={currentTrackIndex}
                accentColor={accentColor}
                onTrackSelect={(index) => {
                  onTrackSelect(index);
                  onClose();
                }}
                isOpen={isOpen}
              />
            </Suspense>
          )}
        </SheetContent>
      </DrawerContainer>
    </>,
    document.body
  );
});

export default PlaylistBottomSheet;
