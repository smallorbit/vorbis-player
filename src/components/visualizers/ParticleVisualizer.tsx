import React, { useCallback } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';
import { useVisualizerDebugConfig } from '../../contexts/VisualizerDebugContext';

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
 *
 * @component
 */
export const ParticleVisualizer: React.FC<ParticleVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
}) => {
  const config = useVisualizerDebugConfig();
  const p = config.particle;

  const getParticleCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    if (isMobile) {
      return Math.min(Math.round(p.countBaseMobile), Math.floor(pixelCount / p.countPixelDivisorMobile));
    }
    return Math.min(Math.round(p.countBaseDesktop), Math.floor(pixelCount / p.countPixelDivisor));
  }, [p]);

  const initializeParticles = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): Particle[] => {
    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * p.speedRange,
      vy: (Math.random() - 0.5) * p.speedRange,
      radius: p.minRadius + Math.random() * (p.maxRadius - p.minRadius),
      baseRadius: p.minRadius + Math.random() * (p.maxRadius - p.minRadius),
      opacity: p.opacityBase + Math.random() * p.opacitySpread,
      baseOpacity: p.opacityBase + Math.random() * p.opacitySpread,
      color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: p.pulseSpeedMin + Math.random() * p.pulseSpeedSpread
    }));
  }, [p]);

  const updateParticles = useCallback((
    particles: Particle[],
    deltaTime: number,
    isPlaying: boolean,
    width: number,
    height: number
  ): void => {
    const baseSpeed = isPlaying ? 1.0 : p.pausedSpeed;
    const speedMultiplier = baseSpeed * p.speedMultiplier;

    particles.forEach(particle => {
      particle.x += particle.vx * speedMultiplier * (deltaTime / 16);
      particle.y += particle.vy * speedMultiplier * (deltaTime / 16);

      if (particle.x < 0) particle.x = width;
      if (particle.x > width) particle.x = 0;
      if (particle.y < 0) particle.y = height;
      if (particle.y > height) particle.y = 0;

      particle.pulsePhase += particle.pulseSpeed * speedMultiplier;
      if (particle.pulsePhase > Math.PI * 2) particle.pulsePhase -= Math.PI * 2;

      const pulseValue = (Math.sin(particle.pulsePhase) + 1) / 2;
      particle.radius = Math.max(1.5, particle.baseRadius + (pulseValue - 0.5) * p.pulseVariation);
      particle.opacity = Math.max(0.1, Math.min(1.0, particle.baseOpacity + (pulseValue - 0.5) * p.opacityVariation));
    });
  }, [p]);

  const renderParticles = useCallback((
    ctx: CanvasRenderingContext2D,
    particles: Particle[],
    width: number,
    height: number,
    intensityValue: number
  ): void => {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(particle => {
      ctx.save();
      ctx.globalAlpha = particle.opacity * (intensityValue / 100);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }, []);

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
