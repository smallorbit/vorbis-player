import { useState, useRef, useCallback } from 'react';
import { extractElementInfo, getReactComponentName } from '@/services/devbug/reportBuilder';
import type { SelectedElement } from '@/types/devbug';

export type SelectionPhase = 'idle' | 'dragging' | 'done';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseAreaSelectionResult {
  phase: SelectionPhase;
  selectionRect: SelectionRect | null;
  collectedElements: Element[];
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: (e: MouseEvent) => void;
  reset: () => void;
}

function rectsOverlap(a: SelectionRect, b: DOMRect): boolean {
  return (
    a.x < b.right &&
    a.x + a.width > b.left &&
    a.y < b.bottom &&
    a.y + a.height > b.top
  );
}

function collectOverlappingElements(rect: SelectionRect): { elements: Element[]; infos: SelectedElement[] } {
  const all = document.querySelectorAll('*');
  const seen = new Set<Element>();
  const elements: Element[] = [];
  const infos: SelectedElement[] = [];

  for (const el of all) {
    if (seen.has(el)) continue;

    if (el.closest('[data-devbug]')) continue;

    const computed = window.getComputedStyle(el);
    const isHidden =
      computed.display === 'none' ||
      computed.visibility === 'hidden' ||
      computed.opacity === '0';
    if (isHidden) continue;

    const domRect = el.getBoundingClientRect();
    if (domRect.width === 0 && domRect.height === 0) continue;

    if (rectsOverlap(rect, domRect)) {
      // Skip elements that fully enclose the selection — they're ancestors, not targets
      const enclosesSelection =
        domRect.left <= rect.x &&
        domRect.top <= rect.y &&
        domRect.right >= rect.x + rect.width &&
        domRect.bottom >= rect.y + rect.height;
      if (enclosesSelection) continue;

      seen.add(el);
      elements.push(el);
      infos.push(extractElementInfo(el));
    }
  }

  return { elements, infos };
}

function normalizeRect(startX: number, startY: number, currentX: number, currentY: number): SelectionRect {
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

export function useAreaSelection(
  onAreaSelected: (elements: Element[], infos: SelectedElement[]) => void,
  onCancel: () => void,
): UseAreaSelectionResult {
  const [phase, setPhase] = useState<SelectionPhase>('idle');
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [collectedElements, setCollectedElements] = useState<Element[]>([]);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const phaseRef = useRef<SelectionPhase>('idle');

  const updatePhase = useCallback((next: SelectionPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
    setSelectionRect(null);
    setCollectedElements([]);
    updatePhase('idle');
  }, [updatePhase]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY };
    setSelectionRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
    updatePhase('dragging');
  }, [updatePhase]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (phaseRef.current !== 'dragging' || !startRef.current) return;
    const rect = normalizeRect(startRef.current.x, startRef.current.y, e.clientX, e.clientY);
    setSelectionRect(rect);
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (phaseRef.current !== 'dragging' || !startRef.current) return;

    const rect = normalizeRect(startRef.current.x, startRef.current.y, e.clientX, e.clientY);

    if (rect.width < 4 && rect.height < 4) {
      onCancel();
      reset();
      return;
    }

    const { elements, infos } = collectOverlappingElements(rect);

    setSelectionRect(rect);
    setCollectedElements(elements);
    updatePhase('done');

    onAreaSelected(elements, infos);
  }, [onAreaSelected, onCancel, reset, updatePhase]);

  return {
    phase,
    selectionRect,
    collectedElements,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    reset,
  };
}

export { getReactComponentName };
