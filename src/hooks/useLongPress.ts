import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  delay?: number;
}

interface LongPressHandlers {
  onMouseDown: (event: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
}

export function useLongPress({ onLongPress, delay = 500 }: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventRef = useRef<React.TouchEvent | React.MouseEvent | null>(null);

  const start = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      eventRef.current = event;
      timerRef.current = setTimeout(() => {
        if (eventRef.current) {
          onLongPress(eventRef.current);
        }
      }, delay);
    },
    [onLongPress, delay],
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    eventRef.current = null;
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
  };
}
