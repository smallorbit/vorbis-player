import React, { Suspense, memo, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { theme } from '@/styles/theme';
import { usePlayerSizingContext } from '@/contexts/PlayerSizingContext';
import { useModalOverlay } from '@/hooks/useModalOverlay';
import QueueSkeleton from './QueueSkeleton';
import { QueueDismissOverlay } from './QueueDismissOverlay.styled';
import { QueueShellHeader } from './QueueShellHeader';
import { areQueueSurfacePropsEqual, type QueueSurfaceProps } from './queueSurfaceProps';

const QueueTrackList = React.lazy(() => import('./QueueTrackList'));

const QUEUE_DRAWER_SKELETON_MAX_ROWS = 8;

const QueueDrawerContainer = styled.div<{
  $isOpen: boolean;
  $width: number;
  $transitionDuration: number;
  $transitionEasing: string;
}>`
  position: fixed;
  top: 0;
  right: 0;
  width: ${({ $width }) => $width}px;
  height: 100dvh;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  border-left: 1px solid ${theme.colors.popover.border};
  transform: translateX(${({ $isOpen }) => ($isOpen ? '0' : '100%')});
  transition: transform ${({ $transitionDuration }) => $transitionDuration}ms
      ${({ $transitionEasing }) => $transitionEasing},
    width ${({ $transitionDuration }) => $transitionDuration}ms
      ${({ $transitionEasing }) => $transitionEasing};
  z-index: ${theme.zIndex.modal};
  overflow-y: auto;
  padding: ${theme.spacing.md};
  padding-top: calc(${theme.spacing.md} + env(safe-area-inset-top, 0px));
  box-sizing: border-box;

  container-type: inline-size;
  container-name: queue;

  @container queue (max-width: ${theme.breakpoints.md}) {
    width: ${theme.drawer.widths.mobile};
    padding: ${theme.spacing.sm};
  }

  @container queue (min-width: ${theme.breakpoints.md}) and (max-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.tablet};
    padding: ${theme.spacing.md};
  }

  @container queue (min-width: ${theme.drawer.breakpoints.mobile}) {
    width: ${theme.drawer.widths.desktop};
    padding: ${theme.spacing.lg};
  }

  @supports not (container-type: inline-size) {
    @media (max-width: ${theme.breakpoints.sm}) {
      width: ${theme.drawer.widths.mobile};
    }
  }
`;

const QueueContent = styled.div`
  padding: ${theme.spacing.sm} 0 ${theme.spacing.md} 0;

  > div:first-child {
    margin-top: 0;
  }

  > div:last-child {
    margin-bottom: 0;
  }
`;

const QueueDrawer = memo<QueueSurfaceProps>(
  ({
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
  }) => {
    const hasBeenOpenedRef = useRef(false);
    if (isOpen) hasBeenOpenedRef.current = true;

    const { viewport, isMobile, isTablet, transitionDuration, transitionEasing } =
      usePlayerSizingContext();
    const { containerRef, dialogProps } = useModalOverlay<HTMLDivElement>(isOpen);

    const drawerWidth = useMemo(() => {
      if (isMobile) return Math.min(viewport.width, parseInt(theme.breakpoints.xs, 10));
      if (isTablet) return Math.min(viewport.width * 0.4, parseInt(theme.drawer.widths.tablet, 10));
      return Math.min(viewport.width * 0.3, parseInt(theme.drawer.widths.desktop, 10));
    }, [viewport.width, isMobile, isTablet]);

    if (!hasBeenOpenedRef.current) return null;

    return createPortal(
      <>
        <QueueDismissOverlay $isOpen={isOpen} onClick={onClose} aria-hidden="true" />

        <QueueDrawerContainer
          ref={containerRef}
          {...dialogProps}
          aria-label={radioActive ? 'Radio' : 'Up Next'}
          $isOpen={isOpen}
          $width={drawerWidth}
          $transitionDuration={transitionDuration}
          $transitionEasing={transitionEasing}
        >
          <QueueShellHeader
            variant="drawer"
            radioActive={radioActive}
            radioSeedDescription={radioSeedDescription}
            canSaveQueue={canSaveQueue}
            onSaveQueue={onSaveQueue}
            onClose={onClose}
          />

          <QueueContent>
            <Suspense
              fallback={
                <QueueSkeleton rowCount={Math.min(tracks.length, QUEUE_DRAWER_SKELETON_MAX_ROWS)} />
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
          </QueueContent>
        </QueueDrawerContainer>
      </>,
      document.body,
    );
  },
  areQueueSurfacePropsEqual,
);

QueueDrawer.displayName = 'QueueDrawer';

export default QueueDrawer;
