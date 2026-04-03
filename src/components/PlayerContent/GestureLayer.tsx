import React, { useCallback } from 'react';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import { ClickableAlbumArtContainer } from './styled';

interface GestureLayerProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  isTouchDevice: boolean;
  onClick: () => void;
  albumArtContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

export const GestureLayer: React.FC<GestureLayerProps> = React.memo(({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  isTouchDevice,
  onClick,
  albumArtContainerRef,
  children,
}) => {
  const { offsetX, isSwiping, isAnimating, gestureHandlers } = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
  }, { enabled: isTouchDevice });

  const { ref: drawerSwipeRef } = useVerticalSwipeGesture({
    onSwipeUp,
    onSwipeDown,
    threshold: 80,
    enabled: isTouchDevice,
  });

  const handleRef = useCallback((el: HTMLDivElement | null) => {
    albumArtContainerRef.current = el;
    if (isTouchDevice && drawerSwipeRef && typeof drawerSwipeRef !== 'function') {
      (drawerSwipeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    } else if (isTouchDevice && typeof drawerSwipeRef === 'function') {
      (drawerSwipeRef as (instance: HTMLDivElement | null) => void)(el);
    }
  }, [isTouchDevice, drawerSwipeRef, albumArtContainerRef]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSwiping && !isAnimating) {
      onClick();
    }
  }, [isSwiping, isAnimating, onClick]);

  return (
    <ClickableAlbumArtContainer
      ref={handleRef}
      $swipeEnabled={isTouchDevice}
      $bothGestures={isTouchDevice}
      {...(isTouchDevice ? gestureHandlers : {})}
      onClick={handleClick}
      style={{
        transform: `translateX(${offsetX}px)`,
        transition: isAnimating ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        willChange: isSwiping ? 'transform' : undefined,
      }}
    >
      {children}
    </ClickableAlbumArtContainer>
  );
});

GestureLayer.displayName = 'GestureLayer';
