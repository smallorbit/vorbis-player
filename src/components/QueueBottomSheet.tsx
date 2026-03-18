import React, { Suspense, memo } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import { theme } from '@/styles/theme';
import {
  DrawerOverlay,
  GripPill,
  SwipeHandle,
  DrawerFallback,
  DrawerFallbackCard,
  DRAWER_TRANSITION_DURATION,
  DRAWER_TRANSITION_EASING
} from './styled';
import type { Track } from '../services/spotify';

const Playlist = React.lazy(() => import('./Playlist'));

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

const SheetTitle = styled.h3`
  margin: 0;
  padding: 0 ${theme.spacing.lg} ${theme.spacing.md};
  color: ${theme.colors.white};
  font-size: ${theme.fontSize.xl};
  font-weight: ${theme.fontWeight.semibold};
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

const SheetHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${theme.spacing.lg} ${theme.spacing.md};
`;

const SaveButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  padding: ${theme.spacing.sm};
  border-radius: ${theme.borderRadius.md};
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: rgba(255, 255, 255, 1);
  }
`;

interface QueueBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  showProviderIcons?: boolean;
  radioActive?: boolean;
  radioSeedDescription?: string | null;
  onSaveQueue?: () => void;
  canSaveQueue?: boolean;
}

const QueueBottomSheet = memo<QueueBottomSheetProps>(function QueueBottomSheet({
  isOpen,
  onClose,
  tracks,
  currentTrackIndex,
  onTrackSelect,
  showProviderIcons,
  radioActive,
  radioSeedDescription,
  onSaveQueue,
  canSaveQueue,
}) {
  const { ref: headerRef, isDragging, dragOffset } = useVerticalSwipeGesture({
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
        aria-label={radioActive ? 'Radio' : 'Queue'}
      >
        <SheetHeader>
          <SwipeHandle
            ref={headerRef}
            role="button"
            aria-label="Swipe down or tap to close queue"
            onClick={onClose}
          >
            <GripPill />
          </SwipeHandle>
          <SheetHeaderRow>
            <SheetTitle style={{ padding: 0 }}>{radioActive ? 'Radio' : 'Queue'}</SheetTitle>
            {canSaveQueue && (
              <SaveButton onClick={onSaveQueue} title="Save queue as Spotify playlist" aria-label="Save queue as Spotify playlist">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
                </svg>
              </SaveButton>
            )}
          </SheetHeaderRow>
          {radioActive && radioSeedDescription && (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: '2px' }}>
              {radioSeedDescription}
            </div>
          )}
        </SheetHeader>
        <SheetContent>
          {isOpen && (
            <Suspense
              fallback={
                <DrawerFallback>
                  <DrawerFallbackCard>
                    <div
                      style={{
                        animation: theme.animations.pulse,
                        color: theme.colors.muted.foreground,
                        textAlign: 'center',
                      }}
                    >
                      Loading queue...
                    </div>
                  </DrawerFallbackCard>
                </DrawerFallback>
              }
            >
              <Playlist
                tracks={tracks}
                currentTrackIndex={currentTrackIndex}
                onTrackSelect={(index) => {
                  onTrackSelect(index);
                  onClose();
                }}
                isOpen={isOpen}
                showProviderIcons={showProviderIcons}
              />
            </Suspense>
          )}
        </SheetContent>
      </DrawerContainer>
    </>,
    document.body
  );
});

export default QueueBottomSheet;
