import React, { useCallback } from 'react';
import { generateColorVariant } from '../../utils/visualizerUtils';
import { useCanvasVisualizer } from '../../hooks/useCanvasVisualizer';
import { useVisualizerDebugConfig } from '../../contexts/VisualizerDebugContext';
import { layerRatio, waveLayerPhaseSpeed, waveY } from './math';

interface WaveVisualizerProps {
  intensity: number;
  speed?: number;
  accentColor: string;
  isPlaying: boolean;
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

export const WaveVisualizer: React.FC<WaveVisualizerProps> = ({
  intensity,
  speed,
  accentColor,
  isPlaying,
}) => {
  const config = useVisualizerDebugConfig();
  const w = config.wave;

  const getItemCount = useCallback(
    (_width: number, _height: number, _intensity: number): number => w.waveCount,
    [w]
  );

  const initializeItems = useCallback(
    (count: number, width: number, height: number, baseColor: string): Wave[] => {
      const isMobile = width < 768;
      const amplitudeScale = isMobile ? 0.65 : 1.0;

      return Array.from({ length: count }, (_, i) => {
        const ratio = layerRatio(i, count);
        const phaseSpeed = waveLayerPhaseSpeed(i, count, w.phaseSpeedMin, w.phaseSpeedSpread);

        return {
          phase: Math.random() * Math.PI * 2,
          phaseSpeed,
          amplitude: height * (w.amplitudeBase + ratio * w.amplitudeLayerScale) * amplitudeScale,
          frequency: w.frequencyMin + Math.random() * w.frequencySpread,
          yBase: height * (w.yBaseStart + ratio * w.yBaseLayerScale),
          opacity: w.opacityBase + ratio * w.opacityLayerScale,
          color: generateColorVariant(baseColor, 0.2 + ratio * 0.6),
        };
      });
    },
    [w]
  );

  const updateItems = useCallback(
    (waves: Wave[], deltaTime: number, playing: boolean, width: number, height: number): void => {
      const speedMult = (playing ? 1.0 : w.pausedSpeedMult) * (speed ?? 1.0);
      const dt = deltaTime / 16;
      const isMobile = width < 768;
      const amplitudeScale = isMobile ? 0.65 : 1.0;
      const count = waves.length;

      waves.forEach((wave, i) => {
        wave.phase += wave.phaseSpeed * speedMult * dt;
        if (wave.phase > Math.PI * 2) wave.phase -= Math.PI * 2;

        const ratio = layerRatio(i, count);
        wave.yBase = height * (w.yBaseStart + ratio * w.yBaseLayerScale);
        wave.amplitude = height * (w.amplitudeBase + ratio * w.amplitudeLayerScale) * amplitudeScale;
      });
    },
    [speed, w]
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

      for (let i = waves.length - 1; i >= 0; i--) {
        const wave = waves[i];
        if (!wave) continue;

        ctx.save();
        ctx.globalAlpha = wave.opacity * intensityScale;
        ctx.fillStyle = wave.color;

        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 4) {
          const y = waveY(x, wave.frequency, wave.phase, wave.amplitude, wave.yBase);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    },
    []
  );

  const canvasRef = useCanvasVisualizer<Wave>({
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
