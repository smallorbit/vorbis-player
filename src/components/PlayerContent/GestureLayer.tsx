import React, { useCallback } from 'react';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useVerticalSwipeGesture } from '@/hooks/useVerticalSwipeGesture';
import { useLongPress } from '@/hooks/useLongPress';
import { ClickableAlbumArtContainer } from './styled';

type Zone = 'left' | 'center' | 'right';

interface ZenTouchHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
}

interface GestureLayerProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  isTouchDevice: boolean;
  onClick: (e: React.MouseEvent) => void;
  onLongPress?: () => void;
  zenTouchHandlers?: ZenTouchHandlers;
  albumArtContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  onZoneHover?: (zone: Zone | null) => void;
  zenModeEnabled?: boolean;
  hasPointerInput?: boolean;
}

export const GestureLayer: React.FC<GestureLayerProps> = React.memo(({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  isTouchDevice,
  onClick,
  onLongPress,
  zenTouchHandlers,
  albumArtContainerRef,
  children,
  onZoneHover,
  zenModeEnabled,
  hasPointerInput,
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

  const longPressHandlers = useLongPress({
    onLongPress: onLongPress ?? (() => {}),
    enabled: zenModeEnabled === true && onLongPress !== undefined,
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
      onClick(e);
    }
  }, [isSwiping, isAnimating, onClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onZoneHover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / rect.height;
    if (relY < 0.2 || relY > 0.8) {
      onZoneHover(null);
      return;
    }
    const relX = (e.clientX - rect.left) / rect.width;
    if (relX < 0.25) {
      onZoneHover('left');
    } else if (relX > 0.75) {
      onZoneHover('right');
    } else {
      onZoneHover('center');
    }
  }, [onZoneHover]);

  const handleMouseLeave = useCallback(() => {
    onZoneHover?.(null);
  }, [onZoneHover]);

  const zoneHoverHandlers = zenModeEnabled && hasPointerInput
    ? { onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave }
    : {};

  const activePointerHandlers = zenTouchHandlers
    ? {
        onPointerDown: zenTouchHandlers.onPointerDown,
        onPointerUp: zenTouchHandlers.onPointerUp,
        onPointerCancel: zenTouchHandlers.onPointerCancel,
        onPointerMove: zenTouchHandlers.onPointerMove,
      }
    : zenModeEnabled && onLongPress
      ? {
          onPointerDown: longPressHandlers.onPointerDown,
          onPointerUp: longPressHandlers.onPointerUp,
          onPointerCancel: longPressHandlers.onPointerCancel,
          onPointerMove: longPressHandlers.onPointerMove,
        }
      : {};

  return (
    <ClickableAlbumArtContainer
      ref={handleRef}
      $swipeEnabled={isTouchDevice}
      $bothGestures={isTouchDevice}
      {...(isTouchDevice ? gestureHandlers : {})}
      {...zoneHoverHandlers}
      {...activePointerHandlers}
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
