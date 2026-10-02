import React, { Suspense, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import { theme } from '@/styles/theme';
import { GripPill, SwipeHandle, DRAWER_TRANSITION_DURATION, DRAWER_TRANSITION_EASING } from '@/components/styled';
import QueueSkeleton from './QueueSkeleton';
import { QueueDismissOverlay } from './QueueDismissOverlay.styled';
import { QueueShellHeader } from './QueueShellHeader';
import { areQueueSurfacePropsEqual, type QueueSurfaceProps } from './queueSurfaceProps';

const QueueTrackList = React.lazy(() => import('./QueueTrackList'));

const QUEUE_BOTTOM_SHEET_SKELETON_MAX_ROWS = 6;

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
  height: 66dvh;
  max-height: 66dvh;
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
  touch-action: pan-y;
  transform: ${({ $isOpen, $isDragging, $dragOffset }) => {
    if ($isDragging) {
      return `translateY(${$dragOffset}px)`;
    }
    return $isOpen ? 'translateY(0)' : 'translateY(100%)';
  }};
  transition: ${({ $isDragging }) =>
    $isDragging ? 'none' : `transform ${DRAWER_TRANSITION_DURATION}ms ${DRAWER_TRANSITION_EASING}`};
  will-change: ${({ $isDragging }) => ($isDragging ? 'transform' : 'auto')};
`;

const SheetHeader = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
`;

const SheetContent = styled.div`
  flex: 1;
  overflow: hidden;
  padding: 0 ${theme.spacing.md} ${theme.spacing.md};
  min-height: 0;
  display: flex;
  flex-direction: column;

  > div:first-child {
    margin-top: 0;
  }

  > div:last-child {
    margin-bottom: 0;
  }
`;

const QueueBottomSheet = memo<QueueSurfaceProps>(function QueueBottomSheet({
  isOpen,
  onClose,
  tracks,
  currentTrackIndex,
  onTrackSelect,
  onRemoveTrack,
  onReorderTracks,
  showProviderIcons,
  radioActive,
  radioSeedDescription,
  onSaveQueue,
  canSaveQueue,
}) {
  const hasBeenOpenedRef = useRef(false);
  if (isOpen) hasBeenOpenedRef.current = true;

  const { ref: headerRef, isDragging, dragOffset } = useVerticalSwipeGesture({
    onSwipeDown: onClose,
    threshold: 80,
    enabled: isOpen,
  });

  const effectiveDragOffset = isOpen && isDragging ? dragOffset : 0;

  if (!hasBeenOpenedRef.current) return null;

  return createPortal(
    <>
      <QueueDismissOverlay $isOpen={isOpen} onClick={onClose} aria-hidden="true" />
      <DrawerContainer
        $isOpen={isOpen}
        $isDragging={isDragging}
        $dragOffset={effectiveDragOffset}
        role="dialog"
        aria-modal="true"
        aria-label={radioActive ? 'Radio' : 'Up Next'}
      >
        <SheetHeader>
          <SwipeHandle
            ref={headerRef}
            role="button"
            aria-label="Swipe down or tap to close"
            onClick={onClose}
          >
            <GripPill />
          </SwipeHandle>
          <QueueShellHeader
            variant="sheet"
            radioActive={radioActive}
            radioSeedDescription={radioSeedDescription}
            canSaveQueue={canSaveQueue}
            onSaveQueue={onSaveQueue}
          />
        </SheetHeader>
        <SheetContent>
          {isOpen && (
            <Suspense
              fallback={
                <QueueSkeleton rowCount={Math.min(tracks.length, QUEUE_BOTTOM_SHEET_SKELETON_MAX_ROWS)} />
              }
            >
              <QueueTrackList
                tracks={tracks}
                currentTrackIndex={currentTrackIndex}
                onTrackSelect={(index) => {
                  onTrackSelect(index);
                  onClose();
                }}
                onRemoveTrack={onRemoveTrack}
                onReorderTracks={onReorderTracks}
                isOpen={isOpen}
                showProviderIcons={showProviderIcons}
                canEdit
              />
            </Suspense>
          )}
        </SheetContent>
      </DrawerContainer>
    </>,
    document.body,
  );
}, areQueueSurfacePropsEqual);

export default QueueBottomSheet;
