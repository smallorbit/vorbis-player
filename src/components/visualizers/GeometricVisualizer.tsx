import React, { useEffect, useRef, useCallback } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { generateColorVariant } from '../../utils/visualizerUtils';

interface GeometricVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
}

interface GeometricShape {
  type: 'circle' | 'triangle' | 'hexagon';
  x: number;
  y: number;
  baseRadius: number;
  currentRadius: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  baseOpacity: number;
  color: string;
  pulsePhase: number;
  pulseSpeed: number;
}

/**
 * GeometricVisualizer Component
 * 
 * Renders rotating and pulsing geometric shapes (circles, triangles, hexagons)
 * that create an abstract, modern visual pattern.
 * 
 * @component
 */
export const GeometricVisualizer: React.FC<GeometricVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying
  // playbackPosition will be used for more accurate sync in future
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shapesRef = useRef<GeometricShape[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  // Draw shape helper (moved up to be used in dependencies)
  const drawShape = useCallback((
    ctx: CanvasRenderingContext2D,
    shape: GeometricShape
  ): void => {
    ctx.save();
    ctx.translate(shape.x, shape.y);
    ctx.rotate(shape.rotation);
    ctx.globalAlpha = shape.opacity;
    ctx.fillStyle = shape.color;
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = 2;
    
    switch (shape.type) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(0, 0, shape.currentRadius, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'triangle':
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const angle = (i * Math.PI * 2) / 3 - Math.PI / 2; // Start from top
          const x = Math.cos(angle) * shape.currentRadius;
          const y = Math.sin(angle) * shape.currentRadius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'hexagon':
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI * 2) / 6;
          const x = Math.cos(angle) * shape.currentRadius;
          const y = Math.sin(angle) * shape.currentRadius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
    
    ctx.restore();
  }, []);

  // Calculate shape count based on viewport size
  const getShapeCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    
    if (isMobile) {
      return Math.min(15, Math.floor(pixelCount / 50000));
    }
    
    return Math.min(40, Math.floor(pixelCount / 30000));
  }, []);

  // Initialize geometric shapes
  const initializeGeometricShapes = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): GeometricShape[] => {
    const types: ('circle' | 'triangle' | 'hexagon')[] = ['circle', 'triangle', 'hexagon'];
    const minRadius = 15;
    const maxRadius = 50;
    const pulseSpeed = 0.01;
    
    return Array.from({ length: count }, () => {
      const type = types[Math.floor(Math.random() * types.length)];
      const baseRadius = minRadius + Math.random() * (maxRadius - minRadius);
      
      return {
        type,
        x: Math.random() * width,
        y: Math.random() * height,
        baseRadius,
        currentRadius: baseRadius,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        opacity: 0.2 + Math.random() * 0.3,
        baseOpacity: 0.2 + Math.random() * 0.3,
        color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: pulseSpeed + Math.random() * 0.01
      };
    });
  }, []);

  // Initialize geometric shapes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Reinitialize shapes on resize
      const shapeCount = getShapeCount(canvas.width, canvas.height);
      shapesRef.current = initializeGeometricShapes(shapeCount, canvas.width, canvas.height, accentColor);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [accentColor, getShapeCount, initializeGeometricShapes]);

  // Update colors when accent color changes
  useEffect(() => {
    shapesRef.current.forEach(shape => {
      shape.color = generateColorVariant(accentColor, Math.random() * 0.5 + 0.3);
    });
  }, [accentColor]);



  // Update geometric shapes
  const updateGeometricShapes = useCallback((
    shapes: GeometricShape[],
    deltaTime: number,
    isPlayingParam: boolean,
    width: number,
    height: number
  ): void => {
    const speedMultiplier = isPlayingParam ? 1.0 : 0.3;
    const normalizedDelta = isFinite(deltaTime) ? Math.min(deltaTime / 16, 10) : 1;
    
    shapes.forEach(shape => {
      // Update rotation
      shape.rotation += shape.rotationSpeed * speedMultiplier * normalizedDelta;
      if (shape.rotation > Math.PI * 2) shape.rotation -= Math.PI * 2;
      if (shape.rotation < 0) shape.rotation += Math.PI * 2;
      
      // Update pulse
      shape.pulsePhase += shape.pulseSpeed * speedMultiplier * normalizedDelta;
      if (shape.pulsePhase > Math.PI * 2) shape.pulsePhase -= Math.PI * 2;
      
      // Calculate pulsing radius and opacity
      const pulseValue = (Math.sin(shape.pulsePhase) + 1) / 2; // Normalize to 0-1
      const pulseAmount = 0.2; // 20% pulse variation
      shape.currentRadius = Math.max(5, shape.baseRadius + (pulseValue - 0.5) * shape.baseRadius * pulseAmount * 2);
      shape.opacity = Math.max(0.1, Math.min(1.0, shape.baseOpacity + (pulseValue - 0.5) * 0.3));
      
      // Wrap around screen edges (optional - creates continuous movement)
      if (shape.x < -shape.currentRadius * 2) shape.x = width + shape.currentRadius * 2;
      if (shape.x > width + shape.currentRadius * 2) shape.x = -shape.currentRadius * 2;
      if (shape.y < -shape.currentRadius * 2) shape.y = height + shape.currentRadius * 2;
      if (shape.y > height + shape.currentRadius * 2) shape.y = -shape.currentRadius * 2;
    });
  }, []);

  // Render geometric shapes
  const renderGeometricShapes = useCallback((
    ctx: CanvasRenderingContext2D,
    shapes: GeometricShape[],
    width: number,
    height: number,
    intensityParam: number
  ): void => {
    ctx.clearRect(0, 0, width, height);
    
    shapes.forEach(shape => {
      // Validate shape values
      if (!isFinite(shape.x) || !isFinite(shape.y) || !isFinite(shape.currentRadius)) {
        return;
      }
      
      // Skip shapes outside viewport (with margin)
      const margin = shape.currentRadius * 2;
      if (shape.x < -margin || shape.x > width + margin ||
          shape.y < -margin || shape.y > height + margin) {
        return;
      }
      
      // Apply intensity to opacity
      const originalOpacity = shape.opacity;
      shape.opacity = originalOpacity * (intensityParam / 100);
      
      drawShape(ctx, shape);
      
      // Restore original opacity
      shape.opacity = originalOpacity;
    });
  }, [drawShape]);

  // Animation loop
  const animate = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const deltaTime = currentTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentTime;

    // Skip if deltaTime is too large (tab was hidden)
    if (deltaTime > 1000) {
      return;
    }

    // Update geometric shapes
    updateGeometricShapes(shapesRef.current, deltaTime, isPlaying, canvas.width, canvas.height);

    // Render geometric shapes
    renderGeometricShapes(ctx, shapesRef.current, canvas.width, canvas.height, intensity);
  }, [isPlaying, intensity, updateGeometricShapes, renderGeometricShapes]);

  useAnimationFrame(animate);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
};

