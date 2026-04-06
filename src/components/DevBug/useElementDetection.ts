import { useRef, useCallback } from 'react';
import { getReactComponentName } from '@/services/devbug/reportBuilder';

export interface DetectedElement {
  element: Element;
  tagName: string;
  reactComponentName: string | null;
  rect: DOMRect;
}

export function useElementDetection(
  overlayRef: React.RefObject<HTMLDivElement | null>,
  onDetect: (detected: DetectedElement | null) => void,
): { handleMouseMove: (e: MouseEvent) => void } {
  const rafPendingRef = useRef(false);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (rafPendingRef.current) return;
      rafPendingRef.current = true;

      requestAnimationFrame(() => {
        rafPendingRef.current = false;

        const overlay = overlayRef.current;
        if (!overlay) return;

        overlay.style.pointerEvents = 'none';
        const element = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = 'auto';

        if (!element || element === document.body || element === document.documentElement) {
          onDetectRef.current(null);
          return;
        }

        if (element.closest('[data-devbug]')) {
          onDetectRef.current(null);
          return;
        }

        onDetectRef.current({
          element,
          tagName: element.tagName.toLowerCase(),
          reactComponentName: getReactComponentName(element),
          rect: element.getBoundingClientRect(),
        });
      });
    },
    [overlayRef],
  );

  return { handleMouseMove };
}
