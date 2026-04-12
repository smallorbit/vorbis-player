import React, { useMemo } from 'react';
import styled from 'styled-components';
import type { VisualizerStyle } from '../types/visualizer';
import { ParticleVisualizer } from './visualizers/ParticleVisualizer';
import { TrailVisualizer } from './visualizers/TrailVisualizer';
import { WaveVisualizer } from './visualizers/WaveVisualizer';
import { GridWaveVisualizer } from './visualizers/GridWaveVisualizer';

interface AlbumArtBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface BackgroundVisualizerProps {
  enabled: boolean;
  style: VisualizerStyle;
  intensity: number;
  speed?: number;
  accentColor: string;
  isPlaying: boolean;
  /** When style is 'comet', the trail head is constrained to this rect so it appears to come from the album art */
  albumArtBounds?: AlbumArtBounds | null;
}

const VisualizerContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
`;

/**
 * BackgroundVisualizer Component
 *
 * Renders an optional background animation visualizer behind the music player.
 * Supports multiple visualizer styles that can be switched dynamically.
 *
 * @component
 *
 * @props
 * - enabled: Whether the visualizer is enabled
 * - style: The visualizer style to render ('fireflies', 'comet')
 * - intensity: Visualizer intensity (0-100)
 * - accentColor: Current track's accent color
 * - isPlaying: Whether music is currently playing
 */
const BackgroundVisualizer: React.FC<BackgroundVisualizerProps> = React.memo(({
  enabled,
  style,
  intensity,
  speed,
  accentColor,
  isPlaying,
  albumArtBounds,
}) => {
  const VisualizerComponent = useMemo(() => {
    if (!enabled) return null;

    switch (style) {
      case 'fireflies':
        return ParticleVisualizer;
      case 'comet':
        return TrailVisualizer;
      case 'wave':
        return WaveVisualizer;
      case 'grid':
        return GridWaveVisualizer;
      default:
        return ParticleVisualizer;
    }
  }, [enabled, style]);

  if (!enabled || !VisualizerComponent) {
    return null;
  }

  return (
    <VisualizerContainer>
      <VisualizerComponent
        intensity={intensity}
        speed={speed ?? 1.0}
        accentColor={accentColor}
        isPlaying={isPlaying}
        {...(style === 'comet' && albumArtBounds != null ? { albumArtBounds } : {})}
      />
    </VisualizerContainer>
  );
});

BackgroundVisualizer.displayName = 'BackgroundVisualizer';

export default BackgroundVisualizer;

