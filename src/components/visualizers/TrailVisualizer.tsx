import React, { useCallback, useRef } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';

interface TrailVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
  zenMode?: boolean;
}

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  radius: number;
}

interface ShipState {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  inited: boolean;
}

/**
 * TrailVisualizer Component
 *
 * Renders a "album art flying through space" effect: a simulated ship travels
 * on a slowly curving path across the canvas, leaving a trail of particles
 * that fade out behind it.
 *
 * Normal mode has the same particle density as ParticleVisualizer's zen mode.
 * Zen mode has 25% more particles on top of that.
 * Pausing slows the ship and trail to a gentle drift (~15% speed).
 *
 * @component
 */
export const TrailVisualizer: React.FC<TrailVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
  zenMode,
}) => {
  // Ship state lives outside the particle pool so it persists across re-inits
  const shipRef = useRef<ShipState>({
    x: 0,
    y: 0,
    angle: Math.random() * Math.PI * 2,
    vx: 0,
    vy: 0,
    inited: false,
  });

  // Particle count: normal = current ParticleVisualizer zen amounts,
  // zen = 25% more on top of that.
  const getParticleCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    const zenMultiplier = zenMode ? 1.25 : 1;

    if (isMobile) {
      const base = Math.min(125, Math.floor(pixelCount / 12000));
      return Math.round(base * zenMultiplier);
    }

    const base = Math.min(200, Math.floor(pixelCount / 8000));
    return Math.round(base * zenMultiplier);
  }, [zenMode]);

  const initializeParticles = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): TrailParticle[] => {
    const ship = shipRef.current;
    if (!ship.inited) {
      ship.x = width / 2;
      ship.y = height / 2;
      ship.inited = true;
    }

    // Spread initial life so not all particles are born/dead at the same time
    return Array.from({ length: count }, () => ({
      x: ship.x + (Math.random() - 0.5) * 40,
      y: ship.y + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      life: Math.random(),
      color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
      radius: 1.5 + Math.random() * 4,
    }));
  }, []);

  const updateParticles = useCallback((
    particles: TrailParticle[],
    deltaTime: number,
    playing: boolean,
    width: number,
    height: number
  ): void => {
    const ship = shipRef.current;

    // Re-center ship if it has somehow ended up outside the canvas
    // (e.g. after a resize that drastically changed dimensions)
    if (!ship.inited || ship.x > width * 1.5 || ship.y > height * 1.5) {
      ship.x = width / 2;
      ship.y = height / 2;
      ship.inited = true;
    }

    const speedMult = playing ? 1.0 : 0.15;
    const dt = deltaTime / 16; // normalize to ~60fps

    // Update ship heading with a gentle, smooth curve
    ship.angle += 0.00015 * deltaTime;
    const shipSpeed = 0.55;
    ship.vx = Math.cos(ship.angle) * shipSpeed;
    ship.vy = Math.sin(ship.angle) * shipSpeed;

    ship.x += ship.vx * speedMult * dt;
    ship.y += ship.vy * speedMult * dt;

    // Wrap ship at canvas edges with a small margin so the trail doesn't
    // abruptly vanish at the border
    const margin = 40;
    if (ship.x < -margin) ship.x = width + margin;
    else if (ship.x > width + margin) ship.x = -margin;
    if (ship.y < -margin) ship.y = height + margin;
    else if (ship.y > height + margin) ship.y = -margin;

    // Each particle either drifts or is respawned at the ship
    const lifeDrain = (deltaTime / 2200) * speedMult;

    particles.forEach(particle => {
      particle.life -= lifeDrain;

      if (particle.life <= 0) {
        // Respawn at ship with velocity roughly opposite to ship travel,
        // plus a spread so the trail has width
        const spreadX = (Math.random() - 0.5) * 0.9;
        const spreadY = (Math.random() - 0.5) * 0.9;
        particle.x = ship.x;
        particle.y = ship.y;
        particle.vx = -ship.vx * 0.45 + spreadX;
        particle.vy = -ship.vy * 0.45 + spreadY;
        particle.life = 0.8 + Math.random() * 0.2; // start near full life
        particle.radius = 1.5 + Math.random() * 4;
      } else {
        // Drift (slow deceleration over time for a natural trailing effect)
        particle.x += particle.vx * speedMult * dt;
        particle.y += particle.vy * speedMult * dt;
        // Slight deceleration
        particle.vx *= 0.998;
        particle.vy *= 0.998;
      }
    });
  }, []);

  const renderParticles = useCallback((
    ctx: CanvasRenderingContext2D,
    particles: TrailParticle[],
    width: number,
    height: number,
    intensityValue: number
  ): void => {
    ctx.clearRect(0, 0, width, height);

    const ship = shipRef.current;
    const intensityFactor = intensityValue / 100;

    particles.forEach(particle => {
      if (particle.life <= 0) return;
      const alpha = Math.max(0, particle.life) * intensityFactor;
      // Radius shrinks as the particle ages so older parts of the trail look thinner
      const r = Math.max(0.5, particle.radius * particle.life);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw a subtle glow at the ship position to give it a focal point
    if (ship.inited && intensityFactor > 0) {
      const glow = ctx.createRadialGradient(ship.x, ship.y, 0, ship.x, ship.y, 14);
      glow.addColorStop(0, `rgba(255,255,255,${0.55 * intensityFactor})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, []);

  const handleColorChange = useCallback((particles: TrailParticle[], color: string) => {
    particles.forEach(particle => {
      particle.color = generateColorVariant(color, Math.random() * 0.5 + 0.3);
    });
  }, []);

  const canvasRef = useCanvasVisualizer<TrailParticle>({
    accentColor,
    isPlaying,
    intensity,
    getItemCount: getParticleCount,
    initializeItems: initializeParticles,
    updateItems: updateParticles,
    renderItems: renderParticles,
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
