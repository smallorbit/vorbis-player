import React, { useCallback } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';

interface ParticleVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
  zenMode?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  opacity: number;
  baseOpacity: number;
  color: string;
  pulsePhase: number;
  pulseSpeed: number;
}

/**
 * ParticleVisualizer Component
 *
 * Renders a particle system visualizer with floating particles that drift,
 * pulse, and change opacity based on playback state.
 * In zen mode, particles are more numerous, larger, faster, and more vibrant.
 *
 * @component
 */
export const ParticleVisualizer: React.FC<ParticleVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
  zenMode
}) => {
  // Calculate particle count based on viewport size
  const getParticleCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    const zenMultiplier = zenMode ? 2.5 : 1;

    if (isMobile) {
      return Math.min(Math.round(50 * zenMultiplier), Math.floor(pixelCount / (zenMode ? 12000 : 20000)));
    }

    return Math.min(Math.round(80 * zenMultiplier), Math.floor(pixelCount / (zenMode ? 8000 : 15000)));
  }, [zenMode]);

  // Initialize particles
  const initializeParticles = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): Particle[] => {
    const minRadius = zenMode ? 2 : 3;
    const maxRadius = zenMode ? 14 : 8;
    const speedRange = zenMode ? 0.6 : 0.5;

    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * speedRange,
      vy: (Math.random() - 0.5) * speedRange,
      radius: minRadius + Math.random() * (maxRadius - minRadius),
      baseRadius: minRadius + Math.random() * (maxRadius - minRadius),
      opacity: (zenMode ? 0.4 : 0.3) + Math.random() * (zenMode ? 0.5 : 0.4),
      baseOpacity: (zenMode ? 0.4 : 0.3) + Math.random() * (zenMode ? 0.5 : 0.4),
      color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: (zenMode ? 0.02 : 0.01) + Math.random() * (zenMode ? 0.04 : 0.02)
    }));
  }, [zenMode]);

  // Update particles
  const updateParticles = useCallback((
    particles: Particle[],
    deltaTime: number,
    isPlaying: boolean,
    width: number,
    height: number
  ): void => {
    const baseSpeed = isPlaying ? 1.0 : 0.3;
    const speedMultiplier = zenMode ? baseSpeed * 1.2 : baseSpeed;

    particles.forEach(particle => {
      // Update position
      particle.x += particle.vx * speedMultiplier * (deltaTime / 16);
      particle.y += particle.vy * speedMultiplier * (deltaTime / 16);

      // Wrap around screen edges
      if (particle.x < 0) particle.x = width;
      if (particle.x > width) particle.x = 0;
      if (particle.y < 0) particle.y = height;
      if (particle.y > height) particle.y = 0;

      // Update pulse phase
      particle.pulsePhase += particle.pulseSpeed * speedMultiplier;
      if (particle.pulsePhase > Math.PI * 2) particle.pulsePhase -= Math.PI * 2;

      // Calculate pulsing radius and opacity
      const pulseValue = (Math.sin(particle.pulsePhase) + 1) / 2;
      const pulseVariation = zenMode ? 5 : 3;
      particle.radius = Math.max(1.5, particle.baseRadius + (pulseValue - 0.5) * pulseVariation);
      const opacityVariation = zenMode ? 0.6 : 0.4;
      particle.opacity = Math.max(0.1, Math.min(1.0, particle.baseOpacity + (pulseValue - 0.5) * opacityVariation));
    });
  }, [zenMode]);

  // Render particles
  const renderParticles = useCallback((
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    width: number,
    height: number,
    intensity: number
  ): void => {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(particle => {
      ctx.save();
      ctx.globalAlpha = particle.opacity * (intensity / 100);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }, []);

  // Handle color changes
  const handleColorChange = useCallback((particles: Particle[], color: string) => {
    particles.forEach(particle => {
      particle.color = generateColorVariant(color, Math.random() * 0.5 + 0.3);
    });
  }, []);

  const canvasRef = useCanvasVisualizer<Particle>({
    accentColor,
    isPlaying,
    intensity,
    getItemCount: getParticleCount,
    initializeItems: initializeParticles,
    updateItems: updateParticles,
    renderItems: renderParticles,
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
