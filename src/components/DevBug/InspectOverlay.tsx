import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { useDevBug } from '@/contexts/DevBugContext';
import { extractElementInfo } from '@/services/devbug/reportBuilder';
import type { SelectedElement } from '@/types/devbug';
import { useElementDetection } from './useElementDetection';
import type { DetectedElement } from './useElementDetection';

const HIGHLIGHT_COLOR = 'rgba(255, 140, 0, 0.9)';
const HIGHLIGHT_FILL = 'rgba(255, 140, 0, 0.08)';
const TOOLTIP_BG = 'rgba(20, 20, 20, 0.92)';
const TOOLTIP_TEXT = '#fff';
const TOOLTIP_ACCENT = 'rgba(255, 140, 0, 0.9)';
const TOOLTIP_PADDING = 8;
const TOOLTIP_LINE_HEIGHT = 16;
const CANVAS_Z = 2147483644;
const OVERLAY_Z = 2147483645;

const CaptureLayer = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${OVERLAY_Z};
  pointer-events: auto;
  cursor: crosshair;
`;

const HighlightCanvas = styled.canvas`
  position: fixed;
  inset: 0;
  z-index: ${CANVAS_Z};
  pointer-events: none;
`;

interface InspectOverlayProps {
  onElementSelected: (element: Element, info: SelectedElement) => void;
}

export function InspectOverlay({ onElementSelected }: InspectOverlayProps) {
  const { isActive, deactivate } = useDevBug();
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detected, setDetected] = useState<DetectedElement | null>(null);
  const detectedRef = useRef<DetectedElement | null>(null);

  const { handleMouseMove } = useElementDetection(overlayRef, (d) => {
    detectedRef.current = d;
    setDetected(d);
  });

  const drawHighlight = useCallback((d: DetectedElement | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!d) return;

    const { rect, tagName, reactComponentName } = d;

    ctx.strokeStyle = HIGHLIGHT_COLOR;
    ctx.lineWidth = 2;
    ctx.fillStyle = HIGHLIGHT_FILL;
    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.fill();
    ctx.stroke();

    const dimLabel = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
    const componentLabel = reactComponentName ?? '';
    const line1 = `<${tagName}>`;
    const line2 = componentLabel ? `${componentLabel}` : dimLabel;
    const line3 = componentLabel ? dimLabel : '';

    const lines = [line1, line2, line3].filter(Boolean);

    ctx.font = 'bold 11px monospace';
    const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const tooltipW = maxWidth + TOOLTIP_PADDING * 2;
    const tooltipH = lines.length * TOOLTIP_LINE_HEIGHT + TOOLTIP_PADDING * 2;

    let tx = rect.left;
    let ty = rect.top - tooltipH - 6;
    if (ty < 0) ty = rect.bottom + 6;
    if (tx + tooltipW > canvas.width) tx = canvas.width - tooltipW - 4;
    if (tx < 0) tx = 4;

    ctx.fillStyle = TOOLTIP_BG;
    ctx.beginPath();
    ctx.rect(tx, ty, tooltipW, tooltipH);
    ctx.fill();

    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? TOOLTIP_ACCENT : TOOLTIP_TEXT;
      ctx.font = i === 0 ? 'bold 11px monospace' : '11px monospace';
      ctx.fillText(line, tx + TOOLTIP_PADDING, ty + TOOLTIP_PADDING + (i + 1) * TOOLTIP_LINE_HEIGHT - 3);
    });
  }, []);

  useEffect(() => {
    drawHighlight(detected);
  }, [detected, drawHighlight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const syncSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawHighlight(detectedRef.current);
    };

    syncSize();
    window.addEventListener('resize', syncSize);
    return () => window.removeEventListener('resize', syncSize);
  }, [drawHighlight]);

  useEffect(() => {
    if (!isActive) return;

    const overlay = overlayRef.current;
    if (!overlay) return;

    const onMouseMove = (e: MouseEvent) => handleMouseMove(e);
    overlay.addEventListener('mousemove', onMouseMove);

    return () => overlay.removeEventListener('mousemove', onMouseMove);
  }, [isActive, handleMouseMove]);

  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        deactivate();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isActive, deactivate]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const d = detectedRef.current;
      if (!d) return;

      const info = extractElementInfo(d.element);
      onElementSelected(d.element, info);
    },
    [onElementSelected],
  );

  if (!isActive) return null;

  return createPortal(
    <>
      <HighlightCanvas ref={canvasRef} />
      <CaptureLayer ref={overlayRef} onClick={handleClick} />
    </>,
    document.body,
  );
}
