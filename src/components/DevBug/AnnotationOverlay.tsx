import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { captureViewport } from '@/services/devbug/screenshotCapture';
import { useAnnotationDrawing } from './useAnnotationDrawing';
import type { Annotation, AnnotationTool } from './useAnnotationDrawing';

const STROKE_COLOR = '#e53e3e';
const STROKE_WIDTH = 2;
const FREEHAND_STROKE_WIDTH = 3;
const ARROWHEAD_SIZE = 12;
const OVERLAY_Z = 2147483646;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${OVERLAY_Z};
  display: flex;
  flex-direction: column;
  user-select: none;
`;

const AnnotationCanvas = styled.canvas`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
`;

const Toolbar = styled.div`
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 8px 12px;
  backdrop-filter: blur(8px);
`;

const ToolButton = styled.button<{ $active: boolean }>`
  background: ${({ $active }) => ($active ? 'rgba(255, 255, 255, 0.2)' : 'transparent')};
  border: 1px solid ${({ $active }) => ($active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.2)')};
  color: #fff;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
  }
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'cancel' }>`
  background: ${({ $variant }) =>
    $variant === 'primary' ? '#3182ce' : $variant === 'cancel' ? 'transparent' : 'transparent'};
  border: 1px solid
    ${({ $variant }) =>
      $variant === 'primary' ? '#3182ce' : 'rgba(255, 255, 255, 0.3)'};
  color: #fff;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;

  &:hover {
    opacity: 0.85;
  }
`;

const Divider = styled.div`
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 4px;
`;

const HintText = styled.span`
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
`;

export interface AnnotationOverlayProps {
  onComplete: (annotatedDataUrl: string) => void;
  onCancel: () => void;
}

function drawArrowhead(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, size: number): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 6),
    to.y - size * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 6),
    to.y - size * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

function renderAnnotation(ctx: CanvasRenderingContext2D, annotation: Annotation, dpr: number): void {
  ctx.save();
  ctx.strokeStyle = STROKE_COLOR;
  ctx.fillStyle = 'transparent';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (annotation.kind === 'rectangle') {
    ctx.lineWidth = STROKE_WIDTH * dpr;
    ctx.strokeRect(
      annotation.x * dpr,
      annotation.y * dpr,
      annotation.width * dpr,
      annotation.height * dpr,
    );
  } else if (annotation.kind === 'arrow') {
    ctx.lineWidth = STROKE_WIDTH * dpr;
    ctx.beginPath();
    ctx.moveTo(annotation.from.x * dpr, annotation.from.y * dpr);
    ctx.lineTo(annotation.to.x * dpr, annotation.to.y * dpr);
    ctx.stroke();
    drawArrowhead(ctx, annotation.from, annotation.to, ARROWHEAD_SIZE * dpr);
  } else if (annotation.kind === 'freehand') {
    ctx.lineWidth = FREEHAND_STROKE_WIDTH * dpr;
    if (annotation.points.length < 2) {
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(annotation.points[0].x * dpr, annotation.points[0].y * dpr);
    for (let i = 1; i < annotation.points.length; i++) {
      ctx.lineTo(annotation.points[i].x * dpr, annotation.points[i].y * dpr);
    }
    ctx.stroke();
  }

  ctx.restore();
}

export function AnnotationOverlay({ onComplete, onCancel }: AnnotationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenshotRef = useRef<HTMLCanvasElement | null>(null);
  const [isCapturing, setIsCapturing] = useState(true);

  const {
    tool,
    annotations,
    setTool,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    undo,
    previewAnnotation,
  } = useAnnotationDrawing();

  const dpr = window.devicePixelRatio || 1;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (screenshotRef.current) {
      ctx.drawImage(screenshotRef.current, 0, 0);
    }

    for (const annotation of annotations) {
      renderAnnotation(ctx, annotation, dpr);
    }

    if (previewAnnotation) {
      renderAnnotation(ctx, previewAnnotation, dpr);
    }
  }, [annotations, previewAnnotation, dpr]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    setIsCapturing(true);
    captureViewport()
      .then(screenshot => {
        screenshotRef.current = screenshot;
        setIsCapturing(false);
        redraw();
      })
      .catch(() => {
        setIsCapturing(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleDone = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onComplete(dataUrl);
  }, [onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, undo]);

  const tools: { id: AnnotationTool; label: string }[] = [
    { id: 'rectangle', label: 'Rectangle' },
    { id: 'arrow', label: 'Arrow' },
    { id: 'freehand', label: 'Freehand' },
  ];

  return createPortal(
    <Backdrop>
      <AnnotationCanvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />
      <Toolbar>
        {tools.map(t => (
          <ToolButton
            key={t.id}
            $active={tool === t.id}
            onClick={() => setTool(t.id)}
          >
            {t.label}
          </ToolButton>
        ))}
        <Divider />
        <ToolButton $active={false} onClick={undo} title="Ctrl+Z">
          Undo
        </ToolButton>
        <Divider />
        {isCapturing && <HintText>Capturing…</HintText>}
        <ActionButton $variant="cancel" onClick={onCancel}>
          Cancel
        </ActionButton>
        <ActionButton $variant="primary" onClick={handleDone}>
          Done
        </ActionButton>
      </Toolbar>
    </Backdrop>,
    document.body,
  );
}
