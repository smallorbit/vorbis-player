import React, { useCallback } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';
import { useVisualizerDebugConfig } from '../../contexts/VisualizerDebugContext';

interface GridWaveVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
  zenMode?: boolean;
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

interface GridWaveState {
  particles: GridParticle[];
  waves: WaveState[];
  width: number;
  height: number;
}

export const GridWaveVisualizer: React.FC<GridWaveVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
}) => {
  const config = useVisualizerDebugConfig();
  const g = config.grid;

  const getItemCount = useCallback(
    (width: number, _height: number, _intensity: number): number => {
      const isMobile = width < 768;
      return isMobile ? g.countBaseMobile : g.countBaseDesktop;
    },
    [g]
  );

  const initializeItems = useCallback(
    (count: number, width: number, height: number, baseColor: string): GridWaveState[] => {
      const spacing = g.spacing;
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      const particles: GridParticle[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const depthFactor = row / Math.max(1, rows - 1);
          particles.push({
            gridX: col,
            gridY: row,
            baseX: col * spacing,
            baseY: row * spacing,
            baseRadius: g.baseRadius * (0.7 + depthFactor * 0.6),
            color: generateColorVariant(baseColor, 0.3 + depthFactor * 0.5),
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

      void count;
      return [{ particles, waves, width, height }];
    },
    [g]
  );

  const updateItems = useCallback(
    (states: GridWaveState[], deltaTime: number, playing: boolean, width: number, height: number): void => {
      const speedMult = playing ? 1.0 : g.pausedSpeedMult;
      const dt = deltaTime / 16;

      const state = states[0];
      if (!state) return;

      state.width = width;
      state.height = height;

      state.waves.forEach(wave => {
        wave.phase += wave.speed * speedMult * dt;
        if (wave.phase > Math.PI * 2) wave.phase -= Math.PI * 2;
      });
    },
    [g]
  );

  const renderItems = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      states: GridWaveState[],
      width: number,
      height: number,
      intensityValue: number
    ): void => {
      ctx.clearRect(0, 0, width, height);

      const state = states[0];
      if (!state) return;

      const intensityScale = Math.max(0.3, intensityValue / 60);
      const amplitude = g.amplitudeBase * Math.min(width, height) * intensityScale;
      const rows = Math.ceil(height / g.spacing) + 1;

      state.particles.forEach(particle => {
        let displacement = 0;
        state.waves.forEach(wave => {
          const proj = particle.baseX * wave.angleX * wave.frequency + particle.baseY * wave.angleY * wave.frequency;
          displacement += Math.sin(proj + wave.phase);
        });
        displacement /= g.waveCount;

        const normalizedDisp = (displacement + 1) / 2;
        const yOffset = displacement * amplitude;

        const depthFactor = particle.gridY / Math.max(1, rows - 1);
        const perspectiveScale = 1.0 - g.perspectiveStrength * (1.0 - depthFactor);

        const radius = Math.max(0.5, particle.baseRadius * (1 + normalizedDisp * g.radiusWaveScale) * perspectiveScale);
        const opacity = Math.max(0.05, Math.min(1.0,
          (g.opacityBase + normalizedDisp * g.opacityWaveScale) * perspectiveScale * intensityScale
        ));

        const x = particle.baseX;
        const y = particle.baseY + yOffset;

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

  const handleColorChange = useCallback(
    (states: GridWaveState[], color: string): void => {
      const state = states[0];
      if (!state) return;
      const rows = Math.ceil(state.height / g.spacing) + 1;
      state.particles.forEach(particle => {
        const depthFactor = particle.gridY / Math.max(1, rows - 1);
        particle.color = generateColorVariant(color, 0.3 + depthFactor * 0.5);
      });
    },
    [g]
  );

  const canvasRef = useCanvasVisualizer<GridWaveState>({
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
