import { useState, useRef, useCallback, useEffect } from 'react';

export interface SwipeGestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
}

export interface SwipeGestureOptions {
  swipeThreshold?: number;
  velocityThreshold?: number;
  tapMaxDuration?: number;
  tapMaxDistance?: number;
  enabled?: boolean;
  animationDuration?: number;
}

export interface SwipeGestureReturn {
  offsetX: number;
  isSwiping: boolean;
  isAnimating: boolean;
  gestureHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

const DIRECTION_LOCK_THRESHOLD = 10;
const DAMPENING_FACTOR = 0.8;

const noopHandlers: SwipeGestureReturn = {
  offsetX: 0,
  isSwiping: false,
  isAnimating: false,
  gestureHandlers: {
    onTouchStart: () => {},
    onTouchMove: () => {},
    onTouchEnd: () => {},
  },
};

export function useSwipeGesture(
  handlers: SwipeGestureHandlers,
  options: SwipeGestureOptions = {}
): SwipeGestureReturn {
  const {
    swipeThreshold = 50,
    velocityThreshold = 0.3,
    tapMaxDuration = 250,
    tapMaxDistance = 10,
    enabled = true,
    animationDuration = 300,
  } = options;

  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentDeltaXRef = useRef(0);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const rafIdRef = useRef<number>();
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
    };
  }, []);

  const resetState = useCallback(() => {
    setOffsetX(0);
    setIsSwiping(false);
    setIsAnimating(false);
    currentDeltaXRef.current = 0;
    directionLockedRef.current = null;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;

    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    startTimeRef.current = Date.now();
    directionLockedRef.current = null;
  }, [isAnimating]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    if (directionLockedRef.current === 'vertical') return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    if (directionLockedRef.current === null) {
      const absDX = Math.abs(deltaX);
      const absDY = Math.abs(deltaY);

      if (absDX < DIRECTION_LOCK_THRESHOLD && absDY < DIRECTION_LOCK_THRESHOLD) {
        return;
      }

      if (absDY > absDX) {
        directionLockedRef.current = 'vertical';
        return;
      }

      directionLockedRef.current = 'horizontal';
      setIsSwiping(true);
    }

    currentDeltaXRef.current = deltaX;
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      setOffsetX(deltaX * DAMPENING_FACTOR);
    });
  }, [isAnimating]);

  const onTouchEnd = useCallback(() => {
    if (isAnimating) return;
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    // Vertical gestures are not our concern — just clean up
    if (directionLockedRef.current === 'vertical') {
      directionLockedRef.current = null;
      return;
    }

    const duration = Date.now() - startTimeRef.current;
    const deltaX = currentDeltaXRef.current;
    const absDistance = Math.abs(deltaX);
    const velocity = absDistance / duration;

    setIsSwiping(false);

    if (duration < tapMaxDuration && absDistance < tapMaxDistance) {
      setOffsetX(0);
      directionLockedRef.current = null;
      handlersRef.current.onTap?.();
      return;
    }

    const isSwipe = absDistance >= swipeThreshold || velocity >= velocityThreshold;

    if (isSwipe && directionLockedRef.current === 'horizontal') {
      const direction = deltaX > 0 ? 'right' : 'left';
      const target = direction === 'left' ? -window.innerWidth : window.innerWidth;

      setIsAnimating(true);
      setOffsetX(target);

      animationTimeoutRef.current = setTimeout(() => {
        if (direction === 'left') {
          handlersRef.current.onSwipeLeft?.();
        } else {
          handlersRef.current.onSwipeRight?.();
        }
        resetState();
      }, animationDuration);
    } else {
      setIsAnimating(true);
      setOffsetX(0);

      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        directionLockedRef.current = null;
      }, animationDuration);
    }
  }, [isAnimating, tapMaxDuration, tapMaxDistance, swipeThreshold, velocityThreshold, animationDuration, resetState]);

  if (!enabled) return noopHandlers;

  return {
    offsetX,
    isSwiping,
    isAnimating,
    gestureHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
