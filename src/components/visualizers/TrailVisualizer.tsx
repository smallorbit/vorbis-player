import React, { useCallback, useRef, useEffect } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';
import { useVisualizerDebugConfig } from '../../contexts/VisualizerDebugContext';

interface AlbumArtBounds {
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
 * fade out behind it.
 *
 * Pausing slows the ship and trail to a gentle drift.
 *
 * @component
 */
export const TrailVisualizer: React.FC<TrailVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
  albumArtBounds,
}) => {
  const albumArtBoundsRef = useRef<AlbumArtBounds | null>(null);
  useEffect(() => {
    albumArtBoundsRef.current = albumArtBounds ?? null;
  }, [albumArtBounds]);

  const config = useVisualizerDebugConfig();
  const t = config.trail;

  const shipRef = useRef<ShipState>({
    x: 0,
    y: 0,
    angle: Math.random() * Math.PI * 2,
    vx: 0,
    vy: 0,
    inited: false,
  });

  const getParticleCount = useCallback((width: number, height: number, intensityValue: number): number => {
    const pixelCount = width * height;
    const isMobile = width < 768;
    const scale = Math.max(0.1, intensityValue / 60);
    if (isMobile) {
      return Math.round(Math.min(t.countBaseMobile, Math.floor(pixelCount / t.countPixelDivisorMobile)) * scale);
    }
    return Math.round(Math.min(t.countBaseDesktop, Math.floor(pixelCount / t.countPixelDivisor)) * scale);
  }, [t]);

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
        const top = bounds.top + inset;
        const w = bounds.width - inset * 2;
        const h = bounds.height - inset * 2;
        ship.x = l + w / 2;
        ship.y = top + h / 2;
      } else {
        ship.x = width / 2;
        ship.y = height / 2;
      }
      ship.inited = true;
    }

    return Array.from({ length: count }, () => ({
      x: ship.x + (Math.random() - 0.5) * 60,
      y: ship.y + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      life: Math.random(),
      color: generateColorVariant(baseColor, Math.random() * 0.5 + 0.3),
      radius: t.particleMinRadius + Math.random() * (t.particleMaxRadius - t.particleMinRadius),
    }));
  }, [t]);

  const updateParticles = useCallback((
    particles: TrailParticle[],
    deltaTime: number,
    playing: boolean,
    width: number,
    height: number
  ): void => {
    const ship = shipRef.current;

    if (!ship.inited || ship.x > width * 1.5 || ship.y > height * 1.5) {
      ship.x = width / 2;
      ship.y = height / 2;
      ship.inited = true;
    }

    const speedMult = playing ? 1.0 : t.pausedSpeedMult;
    const dt = deltaTime / 16;

    const viewportScale = Math.max(0.5, width / 1400);
    const turnRate = t.shipTurnRate * deltaTime + (Math.random() - 0.5) * t.shipWobble;
    ship.angle += turnRate;
    const shipSpeed = (t.shipSpeedBase + (Math.random() - 0.5) * t.shipSpeedSpread) * viewportScale;
    ship.vx = Math.cos(ship.angle) * shipSpeed + (Math.random() - 0.5) * 0.2;
    ship.vy = Math.sin(ship.angle) * shipSpeed + (Math.random() - 0.5) * 0.2;

    ship.x += ship.vx * speedMult * dt;
    ship.y += ship.vy * speedMult * dt;

    const bounds = albumArtBoundsRef.current;
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      const inset = Math.min(bounds.width, bounds.height) * 0.08;
      const l = bounds.left + inset;
      const top = bounds.top + inset;
      const r = bounds.left + bounds.width - inset;
      const b = bounds.top + bounds.height - inset;
      ship.x = Math.max(l, Math.min(r, ship.x));
      ship.y = Math.max(top, Math.min(b, ship.y));
    } else {
      const margin = 40;
      if (ship.x < -margin) ship.x = width + margin;
      else if (ship.x > width + margin) ship.x = -margin;
      if (ship.y < -margin) ship.y = height + margin;
      else if (ship.y > height + margin) ship.y = -margin;
    }

    const lifeDrain = (deltaTime / t.lifeDrainDivisor) * speedMult;

    particles.forEach(particle => {
      particle.life -= lifeDrain;

      if (particle.life <= 0) {
        particle.x = ship.x;
        particle.y = ship.y;
        const perp = (Math.random() - 0.5) * t.perpSpread;
        const perpX = -ship.vy;
        const perpY = ship.vx;
        particle.vx = (-ship.vx * t.oppositeMult + perpX * perp + (Math.random() - 0.5) * t.respawnRandomSpread) * t.particleSpeedMult;
        particle.vy = (-ship.vy * t.oppositeMult + perpY * perp + (Math.random() - 0.5) * t.respawnRandomSpread) * t.particleSpeedMult;
        particle.life = t.lifeRespawnMin + Math.random() * t.lifeRespawnSpread;
        particle.radius = t.particleMinRadius + Math.random() * (t.particleMaxRadius - t.particleMinRadius);
      } else {
        const move = speedMult * t.particleSpeedMult * dt;
        particle.x += particle.vx * move;
        particle.y += particle.vy * move;
        particle.vx *= t.driftDecay;
        particle.vy *= t.driftDecay;
      }
    });
  }, [t]);

  const renderParticles = useCallback((
    ctx: CanvasRenderingContext2D,
    particles: TrailParticle[],
    width: number,
    height: number,
    _intensityValue: number
  ): void => {
    ctx.clearRect(0, 0, width, height);

    const ship = shipRef.current;

    particles.forEach(particle => {
      if (particle.life <= 0) return;
      const alpha = Math.max(0, particle.life);
      const r = Math.max(t.minVisibleRadius, particle.radius * particle.life);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (ship.inited && t.glowRadius > 0) {
      const glow = ctx.createRadialGradient(ship.x, ship.y, 0, ship.x, ship.y, t.glowRadius);
      glow.addColorStop(0, 'rgba(255,255,255,0.5)');
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ship.x, ship.y, t.glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [t]);

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
