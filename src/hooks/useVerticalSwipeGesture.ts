import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVerticalSwipeGestureOptions {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onDrag?: (deltaY: number) => void;
  threshold?: number;
  velocityThreshold?: number;
  enabled?: boolean;
}

interface UseVerticalSwipeGestureReturn {
  ref: React.RefObject<HTMLDivElement>;
  isDragging: boolean;
  dragOffset: number;
}

const DIRECTION_LOCK_THRESHOLD = 10;

export function useVerticalSwipeGesture(
  options: UseVerticalSwipeGestureOptions = {}
): UseVerticalSwipeGestureReturn {
  const {
    onSwipeUp,
    onSwipeDown,
    onDrag,
    threshold = 50,
    velocityThreshold = 0.3,
    enabled = true,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentDeltaYRef = useRef(0);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Store callbacks in refs to avoid re-attaching listeners
  const onSwipeUpRef = useRef(onSwipeUp);
  onSwipeUpRef.current = onSwipeUp;
  const onSwipeDownRef = useRef(onSwipeDown);
  onSwipeDownRef.current = onSwipeDown;
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  const reset = useCallback(() => {
    setIsDragging(false);
    setDragOffset(0);
    currentDeltaYRef.current = 0;
    directionLockedRef.current = null;
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;
      startTimeRef.current = Date.now();
      currentDeltaYRef.current = 0;
      directionLockedRef.current = null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (directionLockedRef.current === 'horizontal') return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;

      if (directionLockedRef.current === null) {
        const absDY = Math.abs(deltaY);
        const absDX = Math.abs(deltaX);

        if (absDY < DIRECTION_LOCK_THRESHOLD && absDX < DIRECTION_LOCK_THRESHOLD) {
          return;
        }

        if (absDX > absDY) {
          directionLockedRef.current = 'horizontal';
          return;
        }

        directionLockedRef.current = 'vertical';
        setIsDragging(true);
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      currentDeltaYRef.current = deltaY;
      setDragOffset(deltaY);
      onDragRef.current?.(deltaY);
    };

    const handleTouchEnd = () => {
      if (directionLockedRef.current !== 'vertical') {
        directionLockedRef.current = null;
        return;
      }

      const deltaY = currentDeltaYRef.current;
      const duration = Date.now() - startTimeRef.current;
      const absDistance = Math.abs(deltaY);
      const velocity = duration > 0 ? absDistance / duration : 0;

      const isSwipe = absDistance >= threshold || velocity >= velocityThreshold;

      if (isSwipe) {
        if (deltaY < 0) {
          onSwipeUpRef.current?.();
        } else {
          onSwipeDownRef.current?.();
        }
      }

      reset();
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, threshold, velocityThreshold, reset]);

  return { ref, isDragging, dragOffset };
}
