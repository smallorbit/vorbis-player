import React, { useCallback, useRef } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';
import { useVisualizerDebugConfig } from '../../contexts/VisualizerDebugContext';
import { gridSpatialFactor, gridWaveProjection } from './math';
import { BREAKPOINTS_PX } from '../../styles/theme';

interface GridWaveVisualizerProps {
  intensity: number;
  speed?: number;
  accentColor: string;
  isPlaying: boolean;
}

interface GridParticle {
  gridX: number;
  gridY: number;
  baseX: number;
  baseY: number;
  baseRadius: number;
  color: string;
}

interface WaveState {
  phase: number;
  angleX: number;
  angleY: number;
  speed: number;
  frequency: number;
}

interface GridMeta {
  waves: WaveState[];
  rows: number;
  cols: number;
}

export const GridWaveVisualizer: React.FC<GridWaveVisualizerProps> = ({
  intensity,
  speed,
  accentColor,
  isPlaying,
}) => {
  const config = useVisualizerDebugConfig();
  const g = config.grid;

  const metaRef = useRef<GridMeta>({ waves: [], rows: 0, cols: 0 });

  const getItemCount = useCallback(
    (width: number, _height: number, _intensity: number): number => {
      const isMobile = width < BREAKPOINTS_PX.lg;
      return isMobile ? g.countBaseMobile : g.countBaseDesktop;
    },
    [g]
  );

  const initializeItems = useCallback(
    (_count: number, width: number, height: number, baseColor: string): GridParticle[] => {
      const spacing = width < BREAKPOINTS_PX.lg ? g.spacingMobile : g.spacing;
      const amplitude = g.amplitudeBase * Math.min(width, height);
      const margin = Math.ceil(amplitude / spacing);

      const cols = Math.ceil(width / spacing) + 1 + margin * 2;
      const rows = Math.ceil(height / spacing) + 1 + margin * 2;
      const originX = -margin * spacing;
      const originY = -margin * spacing;

      const centerX = width / 2;
      const particles: GridParticle[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = originX + col * spacing;
          const y = originY + row * spacing;
          const intensityFactor = gridSpatialFactor(x, centerX, row, rows, g.edgeIntensity);
          particles.push({
            gridX: col,
            gridY: row,
            baseX: x,
            baseY: y,
            baseRadius: g.baseRadius * (0.7 + intensityFactor * 0.6),
            color: generateColorVariant(baseColor, 0.3 + intensityFactor * 0.5),
          });
        }
      }

      const waves: WaveState[] = Array.from({ length: g.waveCount }, (_, i) => ({
        phase: (Math.PI * 2 * i) / g.waveCount,
        angleX: Math.cos((Math.PI * 2 * i) / g.waveCount),
        angleY: Math.sin((Math.PI * 2 * i) / g.waveCount),
        speed: g.waveSpeedBase + (i / g.waveCount) * g.waveSpeedSpread,
        frequency: g.frequencyBase + (i / g.waveCount) * g.frequencySpread,
      }));

      metaRef.current = { waves, rows, cols };
      return particles;
    },
    [g]
  );

  const updateItems = useCallback(
    (_particles: GridParticle[], deltaTime: number, playing: boolean, _width: number, _height: number): void => {
      const speedMult = (playing ? 1.0 : g.pausedSpeedMult) * (speed ?? 1.0);
      const dt = deltaTime / 16;

      metaRef.current.waves.forEach(wave => {
        wave.phase += wave.speed * speedMult * dt;
        if (wave.phase > Math.PI * 2) wave.phase -= Math.PI * 2;
      });
    },
    [g, speed]
  );

  const renderItems = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      particles: GridParticle[],
      width: number,
      height: number,
      intensityValue: number
    ): void => {
      ctx.clearRect(0, 0, width, height);

      const { waves, rows } = metaRef.current;
      const intensityScale = Math.max(0.3, intensityValue / 60);
      const amplitude = g.amplitudeBase * Math.min(width, height) * intensityScale;
      const centerX = width / 2;

      particles.forEach(particle => {
        let dispX = 0, dispY = 0;
        waves.forEach(wave => {
          const proj = gridWaveProjection(particle.baseX, particle.baseY, wave.angleX, wave.angleY, wave.frequency);
          const d = Math.sin(proj + wave.phase);
          dispX += d * wave.angleX;
          dispY += d * wave.angleY;
        });
        dispX /= g.waveCount;
        dispY /= g.waveCount;

        const normalizedDisp = (Math.hypot(dispX, dispY) + 1) / 2;

        const spatialFactor = gridSpatialFactor(particle.baseX, centerX, particle.gridY, rows, g.edgeIntensity);
        const perspectiveScale = 1.0 - g.perspectiveStrength * (1.0 - spatialFactor);

        const radius = Math.max(0.5, particle.baseRadius * (1 + normalizedDisp * g.radiusWaveScale) * perspectiveScale);
        const opacity = Math.max(0.05, Math.min(1.0,
          (g.opacityBase + normalizedDisp * g.opacityWaveScale) * perspectiveScale * intensityScale
        ));

        const x = particle.baseX + dispX * amplitude;
        const y = particle.baseY + dispY * amplitude;

        if (x < -radius || x > width + radius || y < -radius || y > height + radius) return;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    },
    [g]
  );

  const canvasRef = useCanvasVisualizer<GridParticle>({
    accentColor,
    isPlaying,
    intensity,
    getItemCount,
    initializeItems,
    updateItems,
    renderItems,
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
