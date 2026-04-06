import { useState, useRef, useCallback } from 'react';

export type AnnotationTool = 'rectangle' | 'arrow' | 'freehand';

export type DrawingPhase = 'idle' | 'tool_selected' | 'drawing' | 'done';

interface Point {
  x: number;
  y: number;
}

interface RectangleAnnotation {
  kind: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ArrowAnnotation {
  kind: 'arrow';
  from: Point;
  to: Point;
}

interface FreehandAnnotation {
  kind: 'freehand';
  points: Point[];
}

export type Annotation = RectangleAnnotation | ArrowAnnotation | FreehandAnnotation;

export interface UseAnnotationDrawingResult {
  tool: AnnotationTool;
  phase: DrawingPhase;
  annotations: Annotation[];
  setTool: (tool: AnnotationTool) => void;
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: (e: MouseEvent) => void;
  undo: () => void;
  previewAnnotation: Annotation | null;
}

function normalizeRect(from: Point, to: Point): RectangleAnnotation {
  return {
    kind: 'rectangle',
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

export function useAnnotationDrawing(): UseAnnotationDrawingResult {
  const [tool, setToolState] = useState<AnnotationTool>('rectangle');
  const [phase, setPhase] = useState<DrawingPhase>('idle');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [previewAnnotation, setPreviewAnnotation] = useState<Annotation | null>(null);

  const startRef = useRef<Point | null>(null);
  const freehandPointsRef = useRef<Point[]>([]);
  const phaseRef = useRef<DrawingPhase>('idle');
  const toolRef = useRef<AnnotationTool>('rectangle');

  const updatePhase = useCallback((next: DrawingPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const setTool = useCallback((next: AnnotationTool) => {
    toolRef.current = next;
    setToolState(next);
    updatePhase('tool_selected');
  }, [updatePhase]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    const pt = { x: e.clientX, y: e.clientY };
    startRef.current = pt;

    if (toolRef.current === 'freehand') {
      freehandPointsRef.current = [pt];
      setPreviewAnnotation({ kind: 'freehand', points: [pt] });
    }

    updatePhase('drawing');
  }, [updatePhase]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (phaseRef.current !== 'drawing' || !startRef.current) return;

    const current = { x: e.clientX, y: e.clientY };

    if (toolRef.current === 'rectangle') {
      setPreviewAnnotation(normalizeRect(startRef.current, current));
    } else if (toolRef.current === 'arrow') {
      setPreviewAnnotation({ kind: 'arrow', from: startRef.current, to: current });
    } else if (toolRef.current === 'freehand') {
      freehandPointsRef.current = [...freehandPointsRef.current, current];
      setPreviewAnnotation({ kind: 'freehand', points: freehandPointsRef.current });
    }
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (phaseRef.current !== 'drawing' || !startRef.current) return;

    const current = { x: e.clientX, y: e.clientY };
    let annotation: Annotation | null = null;

    if (toolRef.current === 'rectangle') {
      const rect = normalizeRect(startRef.current, current);
      if (rect.width > 2 || rect.height > 2) {
        annotation = rect;
      }
    } else if (toolRef.current === 'arrow') {
      const dx = current.x - startRef.current.x;
      const dy = current.y - startRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 4) {
        annotation = { kind: 'arrow', from: startRef.current, to: current };
      }
    } else if (toolRef.current === 'freehand') {
      const pts = [...freehandPointsRef.current, current];
      if (pts.length > 1) {
        annotation = { kind: 'freehand', points: pts };
      }
      freehandPointsRef.current = [];
    }

    setPreviewAnnotation(null);
    startRef.current = null;

    if (annotation) {
      setAnnotations(prev => [...prev, annotation as Annotation]);
    }

    updatePhase('tool_selected');
  }, [updatePhase]);

  const undo = useCallback(() => {
    setAnnotations(prev => prev.slice(0, -1));
  }, []);

  return {
    tool,
    phase,
    annotations,
    setTool,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    undo,
    previewAnnotation,
  };
}
