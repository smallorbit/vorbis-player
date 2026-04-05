import { useRef, useCallback } from 'react';

const DOUBLE_TAP_THRESHOLD_MS = 300;
const LONG_PRESS_DURATION_MS = 500;
const MOVE_CANCEL_THRESHOLD = 10;

interface UseZenTouchGesturesOptions {
  enabled: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onLikeToggle: () => void;
  onFlipToggle: () => void;
}

interface UseZenTouchGesturesReturn {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
}

export function useZenTouchGestures({
  enabled,
  isPlaying,
  onPlay,
  onPause,
  onLikeToggle,
  onFlipToggle,
}: UseZenTouchGesturesOptions): UseZenTouchGesturesReturn {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const longPressFiredRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const cancelSingleTap = useCallback(() => {
    if (singleTapTimerRef.current !== null) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    longPressFiredRef.current = false;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      longPressTimerRef.current = null;
      cancelSingleTap();
      onFlipToggle();
    }, LONG_PRESS_DURATION_MS);
  }, [enabled, cancelSingleTap, onFlipToggle]);

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    if (!enabled) return;
    const wasPending = longPressTimerRef.current !== null;
    cancelLongPress();

    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }

    if (!wasPending) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;

    if (timeSinceLastTap < DOUBLE_TAP_THRESHOLD_MS) {
      cancelSingleTap();
      lastTapTimeRef.current = 0;
      onLikeToggle();
    } else {
      lastTapTimeRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        lastTapTimeRef.current = 0;
        if (isPlayingRef.current) {
          onPause();
        } else {
          onPlay();
        }
      }, DOUBLE_TAP_THRESHOLD_MS);
    }
  }, [enabled, cancelLongPress, cancelSingleTap, onLikeToggle, onPlay, onPause]);

  const onPointerCancel = useCallback((_e: React.PointerEvent) => {
    cancelLongPress();
    cancelSingleTap();
    longPressFiredRef.current = false;
  }, [cancelLongPress, cancelSingleTap]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    const dx = Math.abs(e.clientX - startXRef.current);
    const dy = Math.abs(e.clientY - startYRef.current);
    if (dx > MOVE_CANCEL_THRESHOLD || dy > MOVE_CANCEL_THRESHOLD) {
      cancelLongPress();
    }
  }, [enabled, cancelLongPress]);

  return { onPointerDown, onPointerUp, onPointerCancel, onPointerMove };
}
