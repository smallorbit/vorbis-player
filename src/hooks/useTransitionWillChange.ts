import { useLayoutEffect, useRef } from 'react';

/**
 * Dynamically applies a `will-change` hint to an element while a transition
 * triggered by `trigger` is running, then clears it on `transitionend` (or
 * after `fallbackMs`) to avoid the sustained compositor-memory overhead of a
 * permanent hint.
 *
 * Idempotent: pending listeners and timers from previous transitions are
 * removed before the next one starts.
 */
export function useTransitionWillChange<T extends HTMLElement>(
  ref: React.RefObject<T>,
  trigger: unknown,
  willChangeValue: string,
  fallbackMs: number,
): void {
  const cleanupRef = useRef<(() => void) | null>(null);
  const isFirstRunRef = useRef(true);

  useLayoutEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }

    const el = ref.current;
    if (!el) return;

    cleanupRef.current?.();

    el.style.willChange = willChangeValue;

    let timeoutId: number | null = null;
    const clear = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      el.removeEventListener('transitionend', onTransitionEnd);
      el.style.willChange = '';
      cleanupRef.current = null;
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== el) return;
      clear();
    };

    el.addEventListener('transitionend', onTransitionEnd);
    timeoutId = window.setTimeout(clear, fallbackMs);

    cleanupRef.current = clear;
    return clear;
  }, [ref, trigger, willChangeValue, fallbackMs]);
}
