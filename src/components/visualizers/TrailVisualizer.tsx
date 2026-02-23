import React, { useCallback, useRef, useEffect } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';

export interface AlbumArtBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TrailVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
  zenMode?: boolean;
  /** When set, the trail head (ship) stays inside this rect so the trail appears to come from the album art */
  albumArtBounds?: AlbumArtBounds | null;
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
 * Renders a "ship flying through space" effect: a simulated ship travels
 * on a curving path across the canvas, leaving a trail of particles that
 * fade out behind it. Particle count and size scale match ParticleVisualizer.
 *
 * Pausing slows the ship and trail to a gentle drift (~15% speed).
 *
 * @component
 */
export const TrailVisualizer: React.FC<TrailVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
  zenMode,
  albumArtBounds,
}) => {
  const albumArtBoundsRef = useRef<AlbumArtBounds | null>(null);
  useEffect(() => {
    albumArtBoundsRef.current = albumArtBounds ?? null;
  }, [albumArtBounds]);

  // Ship state lives outside the particle pool so it persists across re-inits
  const shipRef = useRef<ShipState>({
    x: 0,
    y: 0,
    angle: Math.random() * Math.PI * 2,
    vx: 0,
    vy: 0,
    inited: false,
  });

  // Particle count: higher than ParticleVisualizer so trail fills the background
  const getParticleCount = useCallback((width: number, height: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    const zenMultiplier = zenMode ? 5.5 : 1;

    if (isMobile) {
      return Math.min(Math.round(85 * zenMultiplier), Math.floor(pixelCount / (zenMode ? 4500 : 8000)));
    }

    return Math.min(Math.round(140 * zenMultiplier), Math.floor(pixelCount / (zenMode ? 3000 : 5000)));
  }, [zenMode]);

  const initializeParticles = useCallback((
    count: number,
    width: number,
    height: number,
    baseColor: string
  ): TrailParticle[] => {
    const ship = shipRef.current;
    const bounds = albumArtBoundsRef.current;
    if (!ship.inited) {
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const inset = Math.min(bounds.width, bounds.height) * 0.08;
        const l = bounds.left + inset;
        const t = bounds.top + inset;
        const w = bounds.width - inset * 2;
        const h = bounds.height - inset * 2;
        ship.x = l + w / 2;
        ship.y = t + h / 2;
      } else {
        ship.x = width / 2;
        ship.y = height / 2;
      }
      ship.inited = true;
    }

    // Spread initial life so not all particles are born/dead at the same time.
    // Large radius range for a bold, visible trail.
    const minR = 6;
    const maxR = zenMode ? 24 : 18;
    return Array.from({ length: count }, () => ({
      x: ship.x + (Math.random() - 0.5) * 60,
      y: ship.y + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: Math.random(),
      color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
      radius: minR + Math.random() * (maxR - minR),
    }));
  }, [zenMode]);

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

    // Update ship heading: smooth curve + random wobble so path isn't predictable
    const turnRate = 0.00012 * deltaTime + (Math.random() - 0.5) * 0.025;
    ship.angle += turnRate;
    const shipSpeed = 2.7 + (Math.random() - 0.5) * 0.5;
    ship.vx = Math.cos(ship.angle) * shipSpeed + (Math.random() - 0.5) * 0.2;
    ship.vy = Math.sin(ship.angle) * shipSpeed + (Math.random() - 0.5) * 0.2;

    ship.x += ship.vx * speedMult * dt;
    ship.y += ship.vy * speedMult * dt;

    // Keep trail head inside inset album art bounds when provided; otherwise wrap at canvas edges
    const bounds = albumArtBoundsRef.current;
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      const inset = Math.min(bounds.width, bounds.height) * 0.08;
      const l = bounds.left + inset;
      const t = bounds.top + inset;
      const r = bounds.left + bounds.width - inset;
      const b = bounds.top + bounds.height - inset;
      ship.x = Math.max(l, Math.min(r, ship.x));
      ship.y = Math.max(t, Math.min(b, ship.y));
    } else {
      const margin = 40;
      if (ship.x < -margin) ship.x = width + margin;
      else if (ship.x > width + margin) ship.x = -margin;
      if (ship.y < -margin) ship.y = height + margin;
      else if (ship.y > height + margin) ship.y = -margin;
    }

    // Each particle either drifts or is respawned at the ship (large divisor = long trail; 50% longer life)
    const lifeDrain = (deltaTime / 14250) * speedMult;
    const particleSpeedMult = zenMode ? 1.15 : 1;

    particles.forEach(particle => {
      particle.life -= lifeDrain;

      if (particle.life <= 0) {
        // Respawn at ship: velocity opposite to ship + strong perpendicular spread so trail fans out
        particle.x = ship.x;
        particle.y = ship.y;
        const opposite = zenMode ? 0.55 : 0.4;
        const perp = (Math.random() - 0.5) * (zenMode ? 2.6 : 2.2);
        const perpX = -ship.vy;
        const perpY = ship.vx;
        particle.vx = (-ship.vx * opposite + perpX * perp + (Math.random() - 0.5) * 0.8) * particleSpeedMult;
        particle.vy = (-ship.vy * opposite + perpY * perp + (Math.random() - 0.5) * 0.8) * particleSpeedMult;
        particle.life = 0.8 + Math.random() * 0.2; // start near full life
        const minR = 6;
        const maxR = 24;
        particle.radius = minR + Math.random() * (maxR - minR);
      } else {
        // Drift (very slow deceleration so particles spread across the background; faster in zen)
        const move = speedMult * particleSpeedMult * dt;
        particle.x += particle.vx * move;
        particle.y += particle.vy * move;
        particle.vx *= 0.9992;
        particle.vy *= 0.9992;
      }
    });
  }, [zenMode]);

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
      // Radius shrinks as the particle ages; keep minimum visible size for long trail
      const r = Math.max(5, particle.radius * particle.life);

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
      const glowRadius = 44;
      const glow = ctx.createRadialGradient(ship.x, ship.y, 0, ship.x, ship.y, glowRadius);
      glow.addColorStop(0, `rgba(255,255,255,${0.5 * intensityFactor})`);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, glowRadius, 0, Math.PI * 2);
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
