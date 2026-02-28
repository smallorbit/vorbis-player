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
  const debugConfig = useVisualizerDebugConfig();
  const cfg = debugConfig?.particle;

  // Calculate particle count based on viewport size
  const getParticleCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    const zenMultiplier = zenMode ? (cfg?.countZenMultiplier ?? 1.25) : 1;

    if (isMobile) {
      const base = cfg?.countBaseMobile ?? 50;
      const div = zenMode ? (cfg?.countPixelDivisorMobileZen ?? 6000) : (cfg?.countPixelDivisorMobile ?? 10000);
      return Math.min(Math.round(base * zenMultiplier), Math.floor(pixelCount / div));
    }

    const base = cfg?.countBaseDesktop ?? 80;
    const div = zenMode ? (cfg?.countPixelDivisorZen ?? 4000) : (cfg?.countPixelDivisor ?? 7500);
    return Math.min(Math.round(base * zenMultiplier), Math.floor(pixelCount / div));
  }, [zenMode, cfg]);

  // Initialize particles
  const initializeParticles = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): Particle[] => {
    const minRadius = zenMode ? (cfg?.minRadiusZen ?? 2) : (cfg?.minRadius ?? 3);
    const maxRadius = zenMode ? (cfg?.maxRadiusZen ?? 14) : (cfg?.maxRadius ?? 11);
    const speedRange = zenMode ? (cfg?.speedRangeZen ?? 0.6) : (cfg?.speedRange ?? 0.5);
    const opacityBase = zenMode ? (cfg?.opacityBaseZen ?? 0.4) : (cfg?.opacityBase ?? 0.3);
    const opacitySpread = zenMode ? (cfg?.opacitySpreadZen ?? 0.5) : (cfg?.opacitySpread ?? 0.4);
    const pulseSpeedMin = zenMode ? (cfg?.pulseSpeedMinZen ?? 0.02) : (cfg?.pulseSpeedMin ?? 0.01);
    const pulseSpeedSpread = zenMode ? (cfg?.pulseSpeedSpreadZen ?? 0.04) : (cfg?.pulseSpeedSpread ?? 0.02);

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
  }, [zenMode, cfg]);

  // Update particles
  const updateParticles = useCallback((
    particles: Particle[],
    deltaTime: number,
    isPlaying: boolean,
    width: number,
    height: number
  ): void => {
    const pausedSpeed = cfg?.pausedSpeed ?? 0.3;
    const baseSpeed = isPlaying ? 1.0 : pausedSpeed;
    const zenMult = cfg?.zenSpeedMultiplier ?? 1.2;
    const speedMultiplier = zenMode ? baseSpeed * zenMult : baseSpeed;

    const pulseVariation = zenMode ? (cfg?.pulseVariationZen ?? 5) : (cfg?.pulseVariation ?? 3);
    const opacityVariation = zenMode ? (cfg?.opacityVariationZen ?? 0.6) : (cfg?.opacityVariation ?? 0.4);

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
  }, [zenMode, cfg]);

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
