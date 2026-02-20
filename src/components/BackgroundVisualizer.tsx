import React, { useMemo } from 'react';
import styled from 'styled-components';
import type { VisualizerStyle } from '../types/visualizer';
import { ParticleVisualizer } from './visualizers/ParticleVisualizer';
import { GeometricVisualizer } from './visualizers/GeometricVisualizer';

interface BackgroundVisualizerProps {
  enabled: boolean;
  style: VisualizerStyle;
  intensity: number;
  accentColor: string;
  isPlaying: boolean;
  playbackPosition?: number;
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
 * - style: The visualizer style to render ('particles', 'geometric')
 * - intensity: Visualizer intensity (0-100)
 * - accentColor: Current track's accent color
 * - isPlaying: Whether music is currently playing
 * - playbackPosition: Current playback position in milliseconds (optional)
 */
const BackgroundVisualizer: React.FC<BackgroundVisualizerProps> = ({
  enabled,
  style,
  intensity,
  accentColor,
  isPlaying,
  playbackPosition
}) => {
  const VisualizerComponent = useMemo(() => {
    if (!enabled) return null;

    switch (style) {
      case 'particles':
        return ParticleVisualizer;
      case 'geometric':
        return GeometricVisualizer;
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
        accentColor={accentColor}
        isPlaying={isPlaying}
        playbackPosition={playbackPosition}
      />
    </VisualizerContainer>
  );
};

export default BackgroundVisualizer;

