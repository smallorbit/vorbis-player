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
  zenMode,
}) => {
  const config = useVisualizerDebugConfig();
  const p = config.particle;

  // Calculate particle count based on viewport size
  const getParticleCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    const zenMultiplier = zenMode ? p.countZenMultiplier : 1;

    if (isMobile) {
      return Math.min(Math.round(p.countBaseMobile * zenMultiplier), Math.floor(pixelCount / (zenMode ? p.countPixelDivisorMobileZen : p.countPixelDivisorMobile)));
    }
    return Math.min(Math.round(p.countBaseDesktop * zenMultiplier), Math.floor(pixelCount / (zenMode ? p.countPixelDivisorZen : p.countPixelDivisor)));
  }, [zenMode, p]);

  // Initialize particles
  const initializeParticles = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): Particle[] => {
    const minRadius = zenMode ? p.minRadiusZen : p.minRadius;
    const maxRadius = zenMode ? p.maxRadiusZen : p.maxRadius;
    const speedRange = zenMode ? p.speedRangeZen : p.speedRange;
    const opacityBase = zenMode ? p.opacityBaseZen : p.opacityBase;
    const opacitySpread = zenMode ? p.opacitySpreadZen : p.opacitySpread;
    const pulseSpeedMin = zenMode ? p.pulseSpeedMinZen : p.pulseSpeedMin;
    const pulseSpeedSpread = zenMode ? p.pulseSpeedSpreadZen : p.pulseSpeedSpread;

    return Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * speedRange,
      vy: (Math.random() - 0.5) * speedRange,
      radius: minRadius + Math.random() * (maxRadius - minRadius),
      baseRadius: minRadius + Math.random() * (maxRadius - minRadius),
      opacity: opacityBase + Math.random() * opacitySpread,
      baseOpacity: opacityBase + Math.random() * opacitySpread,
      color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: pulseSpeedMin + Math.random() * pulseSpeedSpread
    }));
  }, [zenMode, p]);

  // Update particles
  const updateParticles = useCallback((
    particles: Particle[],
    deltaTime: number,
    isPlaying: boolean,
    width: number,
    height: number
  ): void => {
    const baseSpeed = isPlaying ? 1.0 : p.pausedSpeed;
    const speedMultiplier = zenMode ? baseSpeed * p.zenSpeedMultiplier : baseSpeed;
    const pulseVariation = zenMode ? p.pulseVariationZen : p.pulseVariation;
    const opacityVariation = zenMode ? p.opacityVariationZen : p.opacityVariation;

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
      particle.radius = Math.max(1.5, particle.baseRadius + (pulseValue - 0.5) * pulseVariation);
      particle.opacity = Math.max(0.1, Math.min(1.0, particle.baseOpacity + (pulseValue - 0.5) * opacityVariation));
    });
  }, [zenMode, p]);

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
