import { useCallback, useEffect, useRef } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 8;

export interface UseLongPressOptions {
  onLongPress: (anchor: DOMRect) => void;
  onTap?: () => void;
  enabled?: boolean;
}

interface PointerState {
  startX: number;
  startY: number;
  timer: ReturnType<typeof setTimeout> | null;
  triggered: boolean;
  active: boolean;
}

export interface UseLongPressHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
}

export function useLongPress({ onLongPress, onTap, enabled = true }: UseLongPressOptions): UseLongPressHandlers {
  const stateRef = useRef<PointerState>({
    startX: 0,
    startY: 0,
    timer: null,
    triggered: false,
    active: false,
  });

  const clearTimer = useCallback(() => {
    if (stateRef.current.timer !== null) {
      clearTimeout(stateRef.current.timer);
      stateRef.current.timer = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const state = stateRef.current;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.triggered = false;
      state.active = true;
      const target = e.currentTarget as HTMLElement;
      state.timer = setTimeout(() => {
        if (!state.active) return;
        state.triggered = true;
        const rect = target.getBoundingClientRect();
        const anchor = new DOMRect(state.startX, state.startY, 0, 0);
        onLongPress(rect.width > 0 ? anchor : rect);
      }, LONG_PRESS_MS);
    },
    [enabled, onLongPress],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const state = stateRef.current;
    if (!state.active) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
      clearTimer();
      state.active = false;
    }
  }, [clearTimer]);

  const onPointerUp = useCallback(() => {
    const state = stateRef.current;
    const wasTriggered = state.triggered;
    const wasActive = state.active;
    clearTimer();
    state.active = false;
    state.triggered = false;
    if (wasActive && !wasTriggered) {
      onTap?.();
    }
  }, [clearTimer, onTap]);

  const onPointerCancel = useCallback(() => {
    clearTimer();
    stateRef.current.active = false;
    stateRef.current.triggered = false;
  }, [clearTimer]);

  const onPointerLeave = useCallback(() => {
    clearTimer();
    stateRef.current.active = false;
  }, [clearTimer]);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave };
}
