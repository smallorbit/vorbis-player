import React, { Suspense, lazy, useRef } from 'react';
import styled from 'styled-components';
import { ProfiledComponent } from '@/components/ProfiledComponent';
import { DRAWER_TRANSITION_DURATION, DRAWER_TRANSITION_EASING } from '@/components/styled';
import type { AddToQueueResult, MediaTrack, ProviderId } from '@/types/domain';

const LibraryPage = lazy(() => import('@/components/PlaylistSelection'));

const OverlayRoot = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== '$isOpen',
})<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.zIndex.overlay};
  overflow: hidden;
  background: ${({ theme }) => theme.colors.popover.background};
  pointer-events: ${({ $isOpen }) => ($isOpen ? 'auto' : 'none')};
  opacity: ${({ $isOpen }) => ($isOpen ? 1 : 0)};
  transform: ${({ $isOpen }) => ($isOpen ? 'translateY(0)' : 'translateY(8px)')};
  will-change: opacity, transform;
  transition:
    opacity ${DRAWER_TRANSITION_DURATION}ms ${DRAWER_TRANSITION_EASING},
    transform ${DRAWER_TRANSITION_DURATION}ms ${DRAWER_TRANSITION_EASING};

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
  const hasBeenOpenedRef = useRef(false);
  if (isOpen) hasBeenOpenedRef.current = true;

  if (!hasBeenOpenedRef.current) return null;

  return (
    <OverlayRoot
      $isOpen={isOpen}
      data-testid="mobile-library-overlay"
      data-state={isOpen ? 'open' : 'closed'}
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
