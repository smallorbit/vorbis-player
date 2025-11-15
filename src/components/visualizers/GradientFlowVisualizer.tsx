import React, { useEffect, useRef, useCallback } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { generateColorVariant } from '../../utils/visualizerUtils';

interface GradientFlowVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
}

interface GradientLayer {
  stops: GradientStop[];
  angle: number;
  centerX: number;
  centerY: number;
  radius: number;
  animationPhase: number;
}

interface GradientStop {
  color: string;
  position: number;
}

/**
 * GradientFlowVisualizer Component
 * 
 * Renders flowing gradient patterns that shift and morph, creating a smooth,
 * organic background effect with multiple gradient layers.
 * 
 * @component
 */
export const GradientFlowVisualizer: React.FC<GradientFlowVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
  playbackPosition: _playbackPosition // Will be used for more accurate sync in future
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<GradientLayer[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  // Initialize gradient layers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Reinitialize layers on resize
      const layerCount = getLayerCount(canvas.width, canvas.height);
      layersRef.current = initializeGradientLayers(layerCount, accentColor);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [accentColor]);

  // Update colors when accent color changes
  useEffect(() => {
    layersRef.current.forEach((layer, index) => {
      layer.stops = [
        { color: accentColor, position: 0 },
        { color: generateColorVariant(accentColor, 0.3 + (index / layersRef.current.length) * 0.2), position: 0.5 },
        { color: generateColorVariant(accentColor, 0.6 + (index / layersRef.current.length) * 0.2), position: 1 }
      ];
    });
  }, [accentColor]);

  // Calculate layer count based on viewport size
  const getLayerCount = useCallback((width: number, _height: number): number => {
    const isMobile = width < 768;
    return isMobile ? 3 : 5;
  }, []);

  // Initialize gradient layers
  const initializeGradientLayers = useCallback((
    count: number,
    baseColor: string
  ): GradientLayer[] => {
    return Array.from({ length: count }, (_, i) => ({
      stops: [
        { color: baseColor, position: 0 },
        { color: generateColorVariant(baseColor, 0.3 + (i / count) * 0.2), position: 0.5 },
        { color: generateColorVariant(baseColor, 0.6 + (i / count) * 0.2), position: 1 }
      ],
      angle: (i / count) * Math.PI * 2,
      centerX: 0.5,
      centerY: 0.5,
      radius: 0.4 + Math.random() * 0.4,
      animationPhase: (i / count) * Math.PI * 2
    }));
  }, []);

  // Update gradient layers
  const updateGradientLayers = useCallback((
    layers: GradientLayer[],
    deltaTime: number,
    isPlaying: boolean,
    _width: number,
    _height: number
  ): void => {
    const speedMultiplier = isPlaying ? 1.0 : 0.2;
    const normalizedDelta = isFinite(deltaTime) ? Math.min(deltaTime / 16, 10) : 1;
    const animationSpeed = 0.001 * normalizedDelta;
    const phaseSpeed = 0.002 * normalizedDelta;
    
    layers.forEach((layer, index) => {
      // Animate angle (slow rotation)
      layer.angle += animationSpeed * speedMultiplier;
      if (layer.angle > Math.PI * 2) layer.angle -= Math.PI * 2;
      if (layer.angle < 0) layer.angle += Math.PI * 2;
      
      // Animate center position (circular motion)
      layer.animationPhase += phaseSpeed * speedMultiplier;
      if (layer.animationPhase > Math.PI * 2) layer.animationPhase -= Math.PI * 2;
      
      // Calculate center position with circular motion
      const radius = 0.1 + (index / layers.length) * 0.05; // Vary radius per layer
      layer.centerX = 0.5 + Math.cos(layer.animationPhase) * radius;
      layer.centerY = 0.5 + Math.sin(layer.animationPhase) * radius;
      
      // Animate radius (breathing effect)
      const radiusPhase = layer.animationPhase * 2;
      layer.radius = 0.4 + Math.sin(radiusPhase) * 0.2;
      
      // Ensure values are finite
      if (!isFinite(layer.centerX)) layer.centerX = 0.5;
      if (!isFinite(layer.centerY)) layer.centerY = 0.5;
      if (!isFinite(layer.radius)) layer.radius = 0.5;
      if (!isFinite(layer.angle)) layer.angle = 0;
    });
  }, []);

  // Render gradient flow
  const renderGradientFlow = useCallback((
    ctx: CanvasRenderingContext2D,
    layers: GradientLayer[],
    width: number,
    height: number,
    intensity: number
  ): void => {
    ctx.clearRect(0, 0, width, height);
    
    layers.forEach((layer) => {
      // Validate layer values
      if (!isFinite(layer.centerX) || !isFinite(layer.centerY) || !isFinite(layer.radius)) {
        return;
      }
      
      const centerX = layer.centerX * width;
      const centerY = layer.centerY * height;
      const maxRadius = layer.radius * Math.max(width, height);
      
      // Validate coordinates
      if (!isFinite(centerX) || !isFinite(centerY) || !isFinite(maxRadius) || maxRadius <= 0) {
        return;
      }
      
      // Create radial gradient
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        maxRadius
      );
      
      // Add color stops
      layer.stops.forEach(stop => {
        if (isFinite(stop.position) && stop.position >= 0 && stop.position <= 1) {
          gradient.addColorStop(stop.position, stop.color);
        }
      });
      
      // Set opacity based on intensity and layer count
      ctx.globalAlpha = (intensity / 100) * (1 / layers.length) * 0.8;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    });
    
    // Reset global alpha
    ctx.globalAlpha = 1.0;
  }, []);

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

    // Update gradient layers
    updateGradientLayers(layersRef.current, deltaTime, isPlaying, canvas.width, canvas.height);

    // Render gradient flow
    renderGradientFlow(ctx, layersRef.current, canvas.width, canvas.height, intensity);
  }, [isPlaying, intensity, updateGradientLayers, renderGradientFlow]);

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

