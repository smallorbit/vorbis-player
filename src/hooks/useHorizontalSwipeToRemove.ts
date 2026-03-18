import { useState, useRef, useCallback, useEffect } from 'react';

interface UseHorizontalSwipeToRemoveOptions {
  onRemove: () => void;
  enabled?: boolean;
  threshold?: number;
}

interface UseHorizontalSwipeToRemoveReturn {
  ref: React.RefObject<HTMLDivElement>;
  offsetX: number;
  isSwiping: boolean;
  isRevealed: boolean;
  reset: () => void;
}

const DIRECTION_LOCK_THRESHOLD = 10;
const DEFAULT_THRESHOLD = 80;

export function useHorizontalSwipeToRemove(
  options: UseHorizontalSwipeToRemoveOptions
): UseHorizontalSwipeToRemoveReturn {
  const {
    onRemove,
    enabled = true,
    threshold = DEFAULT_THRESHOLD,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);
  const currentDeltaXRef = useRef(0);
  const isRevealedRef = useRef(false);

  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  const reset = useCallback(() => {
    setIsSwiping(false);
    setOffsetX(0);
    setIsRevealed(false);
    isRevealedRef.current = false;
    currentDeltaXRef.current = 0;
    directionLockedRef.current = null;
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      currentDeltaXRef.current = 0;
      directionLockedRef.current = null;

      // If already revealed, start from revealed position
      if (isRevealedRef.current) {
        currentDeltaXRef.current = -threshold;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
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

      if (e.cancelable) {
        e.preventDefault();
      }

      let newOffset: number;
      if (isRevealedRef.current) {
        // Already revealed: allow swiping right to close or further left
        newOffset = -threshold + deltaX;
      } else {
        newOffset = deltaX;
      }

      // Clamp: only allow leftward (negative), max at -threshold * 1.2
      newOffset = Math.min(0, Math.max(-threshold * 1.2, newOffset));
      currentDeltaXRef.current = newOffset;
      setOffsetX(newOffset);
    };

    const handleTouchEnd = () => {
      if (directionLockedRef.current !== 'horizontal') {
        directionLockedRef.current = null;
        return;
      }

      const offset = currentDeltaXRef.current;

      if (isRevealedRef.current) {
        // If swiped back past half the threshold, close
        if (offset > -threshold / 2) {
          reset();
        }
        // Otherwise keep revealed
      } else {
        // If swiped past threshold, reveal
        if (Math.abs(offset) >= threshold) {
          setOffsetX(-threshold);
          setIsRevealed(true);
          isRevealedRef.current = true;
        } else {
          reset();
        }
      }

      setIsSwiping(false);
      directionLockedRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, threshold, reset]);

  return { ref, offsetX, isSwiping, isRevealed, reset };
}
