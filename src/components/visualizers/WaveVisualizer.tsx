import React, { useCallback } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';

interface WaveVisualizerProps {
  intensity: number;
  speed?: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
  zenMode?: boolean;
}

interface Wave {
  phase: number;
  phaseSpeed: number;
  amplitude: number;
  frequency: number;
  yBase: number;
  opacity: number;
  color: string;
}

const WAVE_COUNT = 4;
const PAUSED_SPEED_MULT = 0.3;

/**
 * WaveVisualizer Component
 *
 * Renders layered sine waves rising from the bottom of the canvas, each filling
 * the area below with a semi-transparent color derived from the accent color.
 *
 * Pausing slows phase advancement to ~30% of normal speed.
 *
 * @component
 */
export const WaveVisualizer: React.FC<WaveVisualizerProps> = ({
  intensity,
  speed,
  accentColor,
  isPlaying,
}) => {
  const getItemCount = useCallback(
    (_width: number, _height: number, _intensity: number): number => WAVE_COUNT,
    []
  );

  const initializeItems = useCallback(
    (count: number, _width: number, height: number, baseColor: string): Wave[] => {
      return Array.from({ length: count }, (_, i) => {
        const layerRatio = i / count;
        return {
          phase: Math.random() * Math.PI * 2,
          phaseSpeed: 0.004 + Math.random() * 0.003,
          amplitude: height * (0.06 + layerRatio * 0.05),
          frequency: 0.003 + Math.random() * 0.002,
          yBase: height * (0.55 + layerRatio * 0.12),
          opacity: 0.12 + layerRatio * 0.1,
          color: generateColorVariant(baseColor, 0.4 + layerRatio * 0.4),
        };
      });
    },
    []
  );

  const updateItems = useCallback(
    (waves: Wave[], deltaTime: number, playing: boolean, _width: number, height: number): void => {
      const speedMult = (playing ? 1.0 : PAUSED_SPEED_MULT) * (speed ?? 1.0);
      const dt = deltaTime / 16;
      waves.forEach((wave, i) => {
        wave.phase += wave.phaseSpeed * speedMult * dt;
        if (wave.phase > Math.PI * 2) wave.phase -= Math.PI * 2;
        wave.yBase = height * (0.55 + (i / WAVE_COUNT) * 0.12);
        wave.amplitude = height * (0.06 + (i / WAVE_COUNT) * 0.05);
      });
    },
    [speed]
  );

  const renderItems = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      waves: Wave[],
      width: number,
      height: number,
      intensityValue: number
    ): void => {
      ctx.clearRect(0, 0, width, height);
      const intensityScale = Math.max(0.3, intensityValue / 60);

      waves.forEach(wave => {
        ctx.save();
        ctx.globalAlpha = wave.opacity * intensityScale;
        ctx.fillStyle = wave.color;

        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 4) {
          const y = wave.yBase + Math.sin(x * wave.frequency + wave.phase) * wave.amplitude;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    },
    []
  );

  const handleColorChange = useCallback((waves: Wave[], color: string): void => {
    waves.forEach((wave, i) => {
      wave.color = generateColorVariant(color, 0.4 + (i / WAVE_COUNT) * 0.4);
    });
  }, []);

  const canvasRef = useCanvasVisualizer<Wave>({
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
