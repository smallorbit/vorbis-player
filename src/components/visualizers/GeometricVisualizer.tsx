import React, { useCallback } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';

interface GeometricVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
  zenMode?: boolean;
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
 * In zen mode, shapes are more numerous, larger, faster spinning, and more vibrant.
 *
 * @component
 */
export const GeometricVisualizer: React.FC<GeometricVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
  zenMode
}) => {
  // Draw shape helper
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
          const angle = (i * Math.PI * 2) / 3 - Math.PI / 2;
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

    // Soft glow halo in zen mode for larger shapes
    if (zenMode && shape.currentRadius > 20) {
      ctx.globalAlpha = shape.opacity * 0.15;
      ctx.beginPath();
      ctx.arc(0, 0, shape.currentRadius * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, [zenMode]);

  // Calculate shape count based on viewport size
  const getShapeCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    const zenMultiplier = zenMode ? 2.5 : 1;

    if (isMobile) {
      return Math.min(Math.round(25 * zenMultiplier), Math.floor(pixelCount / (zenMode ? 25000 : 50000)));
    }

    return Math.min(Math.round(40 * zenMultiplier), Math.floor(pixelCount / (zenMode ? 15000 : 30000)));
  }, [zenMode]);

  // Initialize geometric shapes
  const initializeGeometricShapes = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): GeometricShape[] => {
    const types: ('circle' | 'triangle' | 'hexagon')[] = ['circle', 'triangle', 'hexagon'];
    const minRadius = zenMode ? 10 : 15;
    const maxRadius = zenMode ? 70 : 50;
    const basePulseSpeed = zenMode ? 0.02 : 0.01;

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
        rotationSpeed: (Math.random() - 0.5) * (zenMode ? 0.05 : 0.02),
        opacity: (zenMode ? 0.25 : 0.2) + Math.random() * (zenMode ? 0.4 : 0.3),
        baseOpacity: (zenMode ? 0.25 : 0.2) + Math.random() * (zenMode ? 0.4 : 0.3),
        color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: basePulseSpeed + Math.random() * (zenMode ? 0.02 : 0.01)
      };
    });
  }, [zenMode]);

  // Update geometric shapes
  const updateGeometricShapes = useCallback((
    shapes: GeometricShape[],
    deltaTime: number,
    isPlayingParam: boolean,
    width: number,
    height: number
  ): void => {
    const baseSpeed = isPlayingParam ? 1.0 : 0.3;
    const speedMultiplier = zenMode ? baseSpeed * 1.8 : baseSpeed;
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
      const pulseValue = (Math.sin(shape.pulsePhase) + 1) / 2;
      const pulseAmount = zenMode ? 0.35 : 0.2;
      shape.currentRadius = Math.max(5, shape.baseRadius + (pulseValue - 0.5) * shape.baseRadius * pulseAmount * 2);
      const opacityVariation = zenMode ? 0.45 : 0.3;
      shape.opacity = Math.max(0.1, Math.min(1.0, shape.baseOpacity + (pulseValue - 0.5) * opacityVariation));

      // Wrap around screen edges
      if (shape.x < -shape.currentRadius * 2) shape.x = width + shape.currentRadius * 2;
      if (shape.x > width + shape.currentRadius * 2) shape.x = -shape.currentRadius * 2;
      if (shape.y < -shape.currentRadius * 2) shape.y = height + shape.currentRadius * 2;
      if (shape.y > height + shape.currentRadius * 2) shape.y = -shape.currentRadius * 2;
    });
  }, [zenMode]);

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

  // Handle color changes
  const handleColorChange = useCallback((shapes: GeometricShape[], color: string) => {
    shapes.forEach(shape => {
      shape.color = generateColorVariant(color, Math.random() * 0.5 + 0.3);
    });
  }, []);

  const canvasRef = useCanvasVisualizer<GeometricShape>({
    accentColor,
    isPlaying,
    intensity,
    getItemCount: getShapeCount,
    initializeItems: initializeGeometricShapes,
    updateItems: updateGeometricShapes,
    renderItems: renderGeometricShapes,
    onColorChange: handleColorChange
  });

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
