import React, { useCallback, useRef } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';

interface StarburstVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
  zenMode?: boolean;
}

interface StarburstParticle {
  angle: number;
  distance: number;
  speed: number;
  maxDistance: number;
  radius: number;
  color: string;
  active: boolean;
}

interface BurstState {
  timeSinceLastBurst: number;
  burstInterval: number;
}

const PARTICLE_COUNT = 60;
const PAUSED_SPEED_MULT = 0.3;
const BURST_INTERVAL_MIN = 1800;
const BURST_INTERVAL_SPREAD = 1200;

/**
 * StarburstVisualizer Component
 *
 * Renders periodic bursts of particles that explode outward from the screen
 * center. Each burst launches all particles simultaneously at random angles;
 * opacity fades as particles travel toward their maximum distance. After all
 * particles reach their max distance the timer resets and a new burst fires.
 *
 * Pausing slows particle travel to ~30% of normal speed.
 *
 * @component
 */
export const StarburstVisualizer: React.FC<StarburstVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
}) => {
  const burstStateRef = useRef<BurstState>({
    timeSinceLastBurst: 0,
    burstInterval: BURST_INTERVAL_MIN + Math.random() * BURST_INTERVAL_SPREAD,
  });

  const getItemCount = useCallback(
    (_width: number, _height: number, _intensity: number): number => PARTICLE_COUNT,
    []
  );

  const initializeItems = useCallback(
    (count: number, width: number, height: number, baseColor: string): StarburstParticle[] => {
      const maxDist = Math.sqrt(width * width + height * height) * 0.6;
      return Array.from({ length: count }, () => ({
        angle: Math.random() * Math.PI * 2,
        distance: maxDist,
        speed: 180 + Math.random() * 120,
        maxDistance: maxDist * (0.7 + Math.random() * 0.3),
        radius: 1.5 + Math.random() * 2.5,
        color: generateColorVariant(baseColor, 0.5 + Math.random() * 0.5),
        active: false,
      }));
    },
    []
  );

  const triggerBurst = useCallback((particles: StarburstParticle[], width: number, height: number): void => {
    const maxDist = Math.sqrt(width * width + height * height) * 0.6;
    particles.forEach(p => {
      p.angle = Math.random() * Math.PI * 2;
      p.distance = 0;
      p.speed = 180 + Math.random() * 120;
      p.maxDistance = maxDist * (0.7 + Math.random() * 0.3);
      p.radius = 1.5 + Math.random() * 2.5;
      p.active = true;
    });
    burstStateRef.current.timeSinceLastBurst = 0;
    burstStateRef.current.burstInterval = BURST_INTERVAL_MIN + Math.random() * BURST_INTERVAL_SPREAD;
  }, []);

  const updateItems = useCallback(
    (
      particles: StarburstParticle[],
      deltaTime: number,
      playing: boolean,
      width: number,
      height: number
    ): void => {
      const speedMult = playing ? 1.0 : PAUSED_SPEED_MULT;
      const dt = deltaTime / 1000;
      const burst = burstStateRef.current;

      const allInactive = particles.every(p => !p.active);

      if (allInactive) {
        burst.timeSinceLastBurst += deltaTime * speedMult;
        if (burst.timeSinceLastBurst >= burst.burstInterval) {
          triggerBurst(particles, width, height);
        }
        return;
      }

      let allDone = true;
      particles.forEach(p => {
        if (!p.active) return;
        p.distance += p.speed * speedMult * dt;
        if (p.distance >= p.maxDistance) {
          p.active = false;
        } else {
          allDone = false;
        }
      });

      if (allDone) {
        burst.timeSinceLastBurst = 0;
        burst.burstInterval = BURST_INTERVAL_MIN + Math.random() * BURST_INTERVAL_SPREAD;
        particles.forEach(p => { p.active = false; });
      }
    },
    [triggerBurst]
  );

  const renderItems = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      particles: StarburstParticle[],
      width: number,
      height: number,
      intensityValue: number
    ): void => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const intensityScale = Math.max(0.3, intensityValue / 60);

      particles.forEach(p => {
        if (!p.active) return;

        const progress = p.distance / p.maxDistance;
        const opacity = (1 - progress) * intensityScale;
        if (opacity <= 0) return;

        const x = cx + Math.cos(p.angle) * p.distance;
        const y = cy + Math.sin(p.angle) * p.distance;
        const r = p.radius * (1 - progress * 0.5);

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    },
    []
  );

  const handleColorChange = useCallback((particles: StarburstParticle[], color: string): void => {
    particles.forEach(p => {
      p.color = generateColorVariant(color, 0.5 + Math.random() * 0.5);
    });
  }, []);

  const canvasRef = useCanvasVisualizer<StarburstParticle>({
    accentColor,
    isPlaying,
    intensity,
    getItemCount,
    initializeItems,
    updateItems,
    renderItems,
    onColorChange: handleColorChange,
  });

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
};
