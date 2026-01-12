import { Suspense, memo, useMemo, useRef, useEffect } from 'react';
import styled from 'styled-components';
import type { Track } from '../services/spotify';
import { theme } from '../styles/theme';
import { usePlayerSizing } from '../hooks/usePlayerSizing';
import MiniPlayer from './MiniPlayer';
import LibraryContent from './LibraryContent';

const LibraryDrawerContainer = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen', 'height', 'transitionDuration', 'transitionEasing'].includes(prop),
}) <{ isOpen: boolean; height: number; transitionDuration: number; transitionEasing: string }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${({ height }) => height}px;
  max-height: 70vh;
  background: ${theme.colors.overlay.dark};
  backdrop-filter: blur(${theme.drawer.backdropBlur});
  border-top: 1px solid ${theme.colors.popover.border};
  border-top-left-radius: ${theme.borderRadius['2xl']};
  border-top-right-radius: ${theme.borderRadius['2xl']};
  transform: translateY(${props => props.isOpen ? '0' : '100%'});
  transition: transform ${({ transitionDuration }) => transitionDuration}ms ${({ transitionEasing }) => transitionEasing},
            height ${({ transitionDuration }) => transitionDuration}ms ${({ transitionEasing }) => transitionEasing};
  z-index: ${theme.zIndex.modal};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
`;

const DrawerOverlay = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isOpen'].includes(prop),
}) <{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: ${theme.colors.overlay.light};
  backdrop-filter: blur(2px);
  opacity: ${props => props.isOpen ? 1 : 0};
  visibility: ${props => props.isOpen ? 'visible' : 'hidden'};
  transition: all ${theme.drawer.transitionDuration}ms ${theme.drawer.transitionEasing};
  z-index: ${theme.zIndex.overlay};
`;

const DragHandle = styled.div`
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  margin: ${theme.spacing.sm} auto;
  cursor: grab;
  flex-shrink: 0;

  &:active {
    cursor: grabbing;
  }
`;

const ContentWrapper = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

interface LibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAlbumQueue: (albumId: string) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
}

// Custom comparison function for LibraryDrawer memo optimization
const areLibraryDrawerPropsEqual = (
  prevProps: LibraryDrawerProps,
  nextProps: LibraryDrawerProps
): boolean => {
  if (prevProps.isOpen !== nextProps.isOpen) {
    return false;
  }

  if (prevProps.isPlaying !== nextProps.isPlaying) {
    return false;
  }

  if (prevProps.currentTrack?.id !== nextProps.currentTrack?.id) {
    return false;
  }

  return true;
};

export const LibraryDrawer = memo<LibraryDrawerProps>(({
  isOpen,
  onClose,
  onAlbumQueue,
  currentTrack,
  isPlaying,
  onPlayPause
}) => {
  const { viewport, transitionDuration, transitionEasing } = usePlayerSizing();
  const drawerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // Calculate drawer height (70% of viewport, with min/max constraints)
  const drawerHeight = useMemo(() => {
    const maxHeight = Math.floor(viewport.height * 0.7);
    const minHeight = 300;
    return Math.max(minHeight, Math.min(maxHeight, 600));
  }, [viewport.height]);

  // Handle drag-to-close gesture
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;

    const drawer = drawerRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (touch.clientY < drawer.getBoundingClientRect().top + 50) {
        // Only allow drag from top area
        startYRef.current = touch.clientY;
        currentYRef.current = touch.clientY;
        isDraggingRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      currentYRef.current = touch.clientY;
      const deltaY = currentYRef.current - startYRef.current;
      
      if (deltaY > 0 && drawer) {
        const translateY = Math.min(deltaY, drawerHeight);
        drawer.style.transform = `translateY(${translateY}px)`;
      }
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      
      const deltaY = currentYRef.current - startYRef.current;
      const threshold = drawerHeight * 0.3; // Close if dragged down more than 30%
      
      if (deltaY > threshold) {
        onClose();
      } else {
        // Reset position
        if (drawer) {
          drawer.style.transform = '';
        }
      }
    };

    drawer.addEventListener('touchstart', handleTouchStart);
    drawer.addEventListener('touchmove', handleTouchMove, { passive: false });
    drawer.addEventListener('touchend', handleTouchEnd);

    return () => {
      drawer.removeEventListener('touchstart', handleTouchStart);
      drawer.removeEventListener('touchmove', handleTouchMove);
      drawer.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, drawerHeight, onClose]);

  // Reset transform when drawer closes
  useEffect(() => {
    if (!isOpen && drawerRef.current) {
      drawerRef.current.style.transform = '';
    }
  }, [isOpen]);

  return (
    <>
      <DrawerOverlay
        isOpen={isOpen}
        onClick={onClose}
      />

      <LibraryDrawerContainer
        ref={drawerRef}
        isOpen={isOpen}
        height={drawerHeight}
        transitionDuration={transitionDuration}
        transitionEasing={transitionEasing}
      >
        <DragHandle />
        
        <ContentWrapper>
          <Suspense fallback={
            <div style={{
              padding: theme.spacing.lg,
              textAlign: 'center',
              color: theme.colors.muted.foreground
            }}>
              Loading library...
            </div>
          }>
            <LibraryContent onAlbumQueue={onAlbumQueue} />
          </Suspense>
        </ContentWrapper>

        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={onPlayPause}
          onClose={onClose}
        />
      </LibraryDrawerContainer>
    </>
  );
}, areLibraryDrawerPropsEqual);

LibraryDrawer.displayName = 'LibraryDrawer';

export default LibraryDrawer;
