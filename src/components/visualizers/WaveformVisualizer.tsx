import React, { useEffect, useRef, useCallback } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { generateColorVariant, adjustColorBrightness } from '../../utils/visualizerUtils';

interface WaveformVisualizerProps {
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
}

interface WaveformBar {
  x: number;
  width: number;
  targetHeight: number;
  currentHeight: number;
  color: string;
  phase: number;
}

/**
 * WaveformVisualizer Component
 * 
 * Renders a waveform-style visualizer with vertical bars that animate
 * with a simulated rhythm pattern.
 * 
 * @component
 */
export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  intensity,
  accentColor,
  isPlaying,
  playbackPosition: _playbackPosition // Will be used for more accurate rhythm sync in future
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<WaveformBar[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const animationTimeRef = useRef<number>(0);

  // Initialize waveform bars
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Reinitialize bars on resize
      const barCount = getBarCount(canvas.width);
      barsRef.current = initializeWaveformBars(barCount, canvas.width, accentColor);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [accentColor]);

  // Update colors when accent color changes
  useEffect(() => {
    barsRef.current.forEach((bar, index) => {
      bar.color = generateColorVariant(accentColor, index / barsRef.current.length);
    });
  }, [accentColor]);

  // Calculate bar count based on viewport width
  const getBarCount = useCallback((width: number): number => {
    const isMobile = width < 768;
    if (isMobile) {
      return Math.min(20, Math.floor(width / 15));
    }
    return Math.min(60, Math.floor(width / 12));
  }, []);

  // Generate rhythm pattern (simulates musical beats)
  const generateRhythmPattern = useCallback((count: number): number[] => {
    const pattern: number[] = [];
    // Simulated beat pattern with variation
    const beats = [0.2, 0.4, 0.6, 0.8, 1.0, 0.9, 0.7, 0.5];
    
    for (let i = 0; i < count; i++) {
      const beatIndex = i % beats.length;
      const variation = 0.7 + Math.random() * 0.3; // Add randomness (70-100%)
      pattern.push(beats[beatIndex] * variation);
    }
    
    return pattern;
  }, []);

  // Initialize waveform bars
  const initializeWaveformBars = useCallback((
    count: number,
    width: number,
    baseColor: string
  ): WaveformBar[] => {
    const barWidth = 4;
    const barSpacing = 2;
    const totalBarWidth = barWidth + barSpacing;
    const startX = (width - (count * totalBarWidth - barSpacing)) / 2;
    
    const rhythmPattern = generateRhythmPattern(count);
    const maxHeight = 0.6; // 60% of canvas height
    
    return Array.from({ length: count }, (_, i) => ({
      x: startX + i * totalBarWidth,
      width: barWidth,
      targetHeight: rhythmPattern[i] * maxHeight,
      currentHeight: rhythmPattern[i] * maxHeight,
      color: generateColorVariant(baseColor, i / count),
      phase: (i / count) * Math.PI * 2
    }));
  }, [generateRhythmPattern]);

  // Update waveform bars
  const updateWaveformBars = useCallback((
    bars: WaveformBar[],
    deltaTime: number,
    isPlaying: boolean,
    _height: number
  ): void => {
    const speedMultiplier = isPlaying ? 1.0 : 0.2;
    animationTimeRef.current += deltaTime * speedMultiplier;
    const time = animationTimeRef.current / 1000; // Convert to seconds
    
    bars.forEach((bar, index) => {
      // Calculate target height based on rhythm pattern and time
      const rhythmValue = Math.sin((time * 2 + bar.phase) * Math.PI);
      const patternValue = generateRhythmPattern(1)[index % 8];
      const normalizedRhythm = (rhythmValue + 1) / 2; // Normalize to 0-1
      const maxHeight = 0.6; // 60% of canvas height
      bar.targetHeight = (0.3 + normalizedRhythm * 0.7) * patternValue * maxHeight;
      
      // Smoothly transition to target height
      const diff = bar.targetHeight - bar.currentHeight;
      const animationSpeed = 0.1;
      const normalizedDelta = isFinite(deltaTime) ? Math.min(deltaTime / 16, 10) : 1; // Clamp deltaTime
      bar.currentHeight = Math.max(0, Math.min(1, bar.currentHeight + diff * animationSpeed * normalizedDelta));
    });
  }, [generateRhythmPattern]);

  // Render waveform bars
  const renderWaveformBars = useCallback((
    ctx: CanvasRenderingContext2D,
    bars: WaveformBar[],
    width: number,
    height: number,
    intensity: number
  ): void => {
    ctx.clearRect(0, 0, width, height);
    
    bars.forEach(bar => {
      // Validate and clamp values to prevent NaN/Infinity
      if (!isFinite(bar.x) || !isFinite(bar.currentHeight) || !isFinite(bar.width)) {
        return; // Skip invalid bars
      }
      
      // Ensure currentHeight is valid and clamped
      const clampedHeight = Math.max(0, Math.min(1, bar.currentHeight));
      const barHeight = clampedHeight * height * (intensity / 100);
      const y = Math.max(0, height - barHeight);
      
      // Validate coordinates before creating gradient
      if (!isFinite(bar.x) || !isFinite(y) || !isFinite(height) || barHeight <= 0) {
        return; // Skip if any coordinate is invalid
      }
      
      // Create gradient for each bar
      const gradient = ctx.createLinearGradient(bar.x, y, bar.x, height);
      gradient.addColorStop(0, bar.color);
      gradient.addColorStop(1, adjustColorBrightness(bar.color, -0.3));
      
      ctx.fillStyle = gradient;
      ctx.fillRect(bar.x, y, bar.width, barHeight);
      
      // Add glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = bar.color;
      ctx.fillRect(bar.x, y, bar.width, barHeight);
      ctx.shadowBlur = 0;
    });
  }, []);

  // Animation loop
  const animate = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const deltaTime = currentTime - lastFrameTimeRef.current;
    lastFrameTimeRef.current = currentTime;

    // Skip if deltaTime is too large (tab was hidden)
    if (deltaTime > 1000) {
      return;
    }

    // Update waveform bars
    updateWaveformBars(barsRef.current, deltaTime, isPlaying, canvas.height);

    // Render waveform bars
    renderWaveformBars(ctx, barsRef.current, canvas.width, canvas.height, intensity);
  }, [isPlaying, intensity, updateWaveformBars, renderWaveformBars]);

  useAnimationFrame(animate);

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

