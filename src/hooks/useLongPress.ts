import { useRef, useCallback } from 'react';

const LONG_PRESS_DURATION_MS = 500;
const MOVE_CANCEL_THRESHOLD = 10;

interface UseLongPressOptions {
  onLongPress: () => void;
  onShortPress?: () => void;
  enabled?: boolean;
}

interface UseLongPressReturn {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
}

export function useLongPress({
  onLongPress,
  onShortPress,
  enabled = true,
}: UseLongPressOptions): UseLongPressReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    firedRef.current = false;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;

    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      timerRef.current = null;
      onLongPress();
    }, LONG_PRESS_DURATION_MS);
  }, [enabled, onLongPress]);

  const onPointerUp = useCallback((_e: React.PointerEvent) => {
    if (!enabled) return;
    const wasPending = timerRef.current !== null;
    cancel();
    if (wasPending && !firedRef.current) {
      onShortPress?.();
    }
    firedRef.current = false;
  }, [enabled, cancel, onShortPress]);

  const onPointerCancel = useCallback((_e: React.PointerEvent) => {
    cancel();
    firedRef.current = false;
  }, [cancel]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    const dx = Math.abs(e.clientX - startXRef.current);
    const dy = Math.abs(e.clientY - startYRef.current);
    if (dx > MOVE_CANCEL_THRESHOLD || dy > MOVE_CANCEL_THRESHOLD) {
      cancel();
    }
  }, [enabled, cancel]);

  return { onPointerDown, onPointerUp, onPointerCancel, onPointerMove };
}
