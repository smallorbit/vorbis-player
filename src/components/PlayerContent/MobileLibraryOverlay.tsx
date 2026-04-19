import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';

const LibraryPage = lazy(() => import('@/components/PlaylistSelection'));

export const MOBILE_LIBRARY_OVERLAY_DURATION_MS = 200;
export const MOBILE_LIBRARY_OVERLAY_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

const OverlayRoot = styled.div.withConfig({
  shouldForwardProp: (prop) => !['$visible', '$reducedMotion'].includes(prop),
}) <{ $visible: boolean; $reducedMotion: boolean }>`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.overlay};
  overflow: hidden;
  transform-origin: center bottom;
  pointer-events: ${({ $visible }) => ($visible ? 'auto' : 'none')};
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: ${({ $visible }) => ($visible ? 'translateY(0)' : 'translateY(8px)')};
  will-change: opacity, transform;

  ${({ $reducedMotion }) =>
    $reducedMotion
      ? css`
          transition: none;
        `
      : css`
          transition:
            opacity ${MOBILE_LIBRARY_OVERLAY_DURATION_MS}ms ${MOBILE_LIBRARY_OVERLAY_EASING},
            transform ${MOBILE_LIBRARY_OVERLAY_DURATION_MS}ms ${MOBILE_LIBRARY_OVERLAY_EASING};
        `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

interface MobileLibraryOverlayProps {
  isOpen: boolean;
  isPlaying?: boolean;
  onPlaylistSelect: (playlistId: string, playlistName: string, provider?: ProviderId) => void;
  onAddToQueue?: (
    playlistId: string,
    playlistName?: string,
    provider?: ProviderId,
  ) => Promise<AddToQueueResult | null>;
  onPlayLikedTracks?: (
    tracks: MediaTrack[],
    collectionId: string,
    collectionName: string,
    provider?: ProviderId,
  ) => Promise<void>;
  onQueueLikedTracks?: (tracks: MediaTrack[], collectionName?: string) => void;
  onCloseLibrary: () => void;
}

export const MobileLibraryOverlay: React.FC<MobileLibraryOverlayProps> = React.memo(({
  isOpen,
  isPlaying,
  onPlaylistSelect,
  onAddToQueue,
  onPlayLikedTracks,
  onQueueLikedTracks,
  onCloseLibrary,
}) => {
  const reducedMotion = useReducedMotion();
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setShouldRender(true);
      // Defer the visible flag to the next frame so the browser registers
      // the initial (hidden) styles before transitioning to visible.
      enterFrameRef.current = requestAnimationFrame(() => {
        setVisible(true);
      });
      return () => {
        if (enterFrameRef.current !== null) {
          cancelAnimationFrame(enterFrameRef.current);
          enterFrameRef.current = null;
        }
      };
    }

    setVisible(false);
    if (!shouldRender) return;
    if (reducedMotion) {
      setShouldRender(false);
      return;
    }
    exitTimerRef.current = setTimeout(() => {
      setShouldRender(false);
      exitTimerRef.current = null;
    }, MOBILE_LIBRARY_OVERLAY_DURATION_MS);
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [isOpen, reducedMotion, shouldRender]);

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (enterFrameRef.current !== null) cancelAnimationFrame(enterFrameRef.current);
  }, []);

  if (!shouldRender) return null;

  return (
    <OverlayRoot
      $visible={visible}
      $reducedMotion={reducedMotion}
      data-testid="mobile-library-overlay"
      data-state={visible ? 'open' : 'closed'}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
    >
      <Suspense fallback={null}>
        <ProfiledComponent id="LibraryPage">
          <LibraryPage
            onPlaylistSelect={onPlaylistSelect}
            onAddToQueue={onAddToQueue}
            onPlayLikedTracks={onPlayLikedTracks}
            onQueueLikedTracks={onQueueLikedTracks}
            onNavigateToPlayer={onCloseLibrary}
            isPlaying={isPlaying}
          />
        </ProfiledComponent>
      </Suspense>
    </OverlayRoot>
  );
});

MobileLibraryOverlay.displayName = 'MobileLibraryOverlay';

export default MobileLibraryOverlay;
