import { useRef, useEffect, useCallback } from 'react';
import { useAnimationFrame } from './useAnimationFrame';

export interface UseCanvasVisualizerProps<T> {
  accentColor: string;
  isPlaying: boolean;
  intensity: number;
  /**
   * Calculate how many items to spawn based on canvas dimensions
   */
  getItemCount: (width: number, height: number) => number;
  /**
   * Create the initial array of items
   */
  initializeItems: (count: number, width: number, height: number, color: string) => T[];
  /**
   * Update item state (position, rotation, etc.)
   */
  updateItems: (items: T[], deltaTime: number, isPlaying: boolean, width: number, height: number) => void;
  /**
   * Render items to the canvas
   */
  renderItems: (ctx: CanvasRenderingContext2D, items: T[], width: number, height: number, intensity: number) => void;
  /**
   * Update item colors when accent color changes. 
   * This runs in addition to re-initialization to ensure immediate feedback without full reset if desired,
   * though currently the hook re-initializes on color change by default due to dependency.
   */
  onColorChange: (items: T[], color: string) => void;
}

/**
 * A generic hook for canvas-based visualizers that handle resizing, 
 * animation loops, and item management (particles, shapes, etc.).
 */
export const useCanvasVisualizer = <T>({
  accentColor,
  isPlaying,
  intensity,
  getItemCount,
  initializeItems,
  updateItems,
  renderItems,
  onColorChange
}: UseCanvasVisualizerProps<T>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<T[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  // Handle resize and initialization
  // Re-runs when accentColor changes to ensure new items have correct base color
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const count = getItemCount(canvas.width, canvas.height);
      itemsRef.current = initializeItems(count, canvas.width, canvas.height, accentColor);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [accentColor, getItemCount, initializeItems]);

  // Handle color changes for existing items
  useEffect(() => {
    if (itemsRef.current.length > 0) {
      onColorChange(itemsRef.current, accentColor);
    }
  }, [accentColor, onColorChange]);

  // Animation loop
  const animate = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize lastFrameTime if it's the first frame
    if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = currentTime;
    }

    const deltaTime = currentTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentTime;

    // Skip if deltaTime is too large (tab was hidden)
    if (deltaTime > 1000) {
      return;
    }

    updateItems(itemsRef.current, deltaTime, isPlaying, canvas.width, canvas.height);
    renderItems(ctx, itemsRef.current, canvas.width, canvas.height, intensity);
  }, [isPlaying, intensity, updateItems, renderItems]);

  useAnimationFrame(animate);

  return canvasRef;
};

