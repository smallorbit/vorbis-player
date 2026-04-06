import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import type { SelectedElement } from '@/types/devbug';
import { useAreaSelection } from './useAreaSelection';
import type { SelectionRect } from './useAreaSelection';

const SELECTION_STROKE = 'rgba(255, 140, 0, 1)';
const SELECTION_FILL = 'rgba(255, 140, 0, 0.12)';
const HIGHLIGHT_STROKE = 'rgba(255, 140, 0, 0.9)';
const HIGHLIGHT_FILL = 'rgba(255, 140, 0, 0.08)';
const CANVAS_Z = 2147483644;
const OVERLAY_Z = 2147483645;

const HighlightCanvas = styled.canvas`
  position: fixed;
  inset: 0;
  z-index: ${CANVAS_Z};
  pointer-events: none;
`;

const CaptureLayer = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${OVERLAY_Z};
  pointer-events: auto;
  cursor: crosshair;
  user-select: none;
`;

export interface AreaSelectOverlayProps {
  onAreaSelected: (elements: Element[], infos: SelectedElement[]) => void;
  onCancel: () => void;
}

export function AreaSelectOverlay({ onAreaSelected, onCancel }: AreaSelectOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { phase, selectionRect, collectedElements, handleMouseDown, handleMouseMove, handleMouseUp } =
    useAreaSelection(onAreaSelected, onCancel);

  const drawFrame = useCallback(
    (rect: SelectionRect | null, done: boolean, elements: Element[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (done && elements.length > 0) {
        for (const el of elements) {
          const r = el.getBoundingClientRect();
          ctx.strokeStyle = HIGHLIGHT_STROKE;
          ctx.lineWidth = 2;
          ctx.fillStyle = HIGHLIGHT_FILL;
          ctx.beginPath();
          ctx.rect(r.left, r.top, r.width, r.height);
          ctx.fill();
          ctx.stroke();
        }
      }

      if (rect && rect.width > 0 && rect.height > 0) {
        ctx.strokeStyle = SELECTION_STROKE;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.fillStyle = SELECTION_FILL;
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    },
    [],
  );

  useEffect(() => {
    drawFrame(selectionRect, phase === 'done', collectedElements);
  }, [selectionRect, phase, collectedElements, drawFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    syncSize();
    window.addEventListener('resize', syncSize);
    return () => window.removeEventListener('resize', syncSize);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleMouseDown(e.nativeEvent);
    },
    [handleMouseDown],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMouseMove(e.nativeEvent);
    },
    [handleMouseMove],
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      handleMouseUp(e.nativeEvent);
    },
    [handleMouseUp],
  );

  return createPortal(
    <>
      <HighlightCanvas ref={canvasRef} />
      <CaptureLayer
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />
    </>,
    document.body,
  );
}
