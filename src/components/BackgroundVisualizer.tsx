import React, { useMemo } from 'react';
import styled from 'styled-components';
import type { VisualizerStyle } from '../types/visualizer';

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
 * Currently a placeholder component that will be extended with actual visualizer
 * implementations in Phase 2.
 * 
 * @component
 * 
 * @props
 * - enabled: Whether the visualizer is enabled
 * - style: The visualizer style to render ('particles', 'waveform', 'geometric', 'gradient-flow')
 * - intensity: Visualizer intensity (0-100)
 * - accentColor: Current track's accent color
 * - isPlaying: Whether music is currently playing
 * - playbackPosition: Current playback position in milliseconds (optional)
 */
export const BackgroundVisualizer: React.FC<BackgroundVisualizerProps> = ({
  enabled,
  style: _style, // Will be used in Phase 2
  intensity,
  accentColor,
  isPlaying: _isPlaying, // Will be used in Phase 2
  playbackPosition: _playbackPosition // Will be used in Phase 2
}) => {
  // Placeholder: Will be replaced with actual visualizer components in Phase 2
  const VisualizerComponent = useMemo(() => {
    if (!enabled) return null;
    
    // For Phase 1, return a simple placeholder
    // In Phase 2, this will switch between actual visualizer components:
    // - ParticleVisualizer
    // - WaveformVisualizer
    // - GeometricVisualizer
    // - GradientFlowVisualizer
    
    return () => (
      <div style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}05 100%)`,
        opacity: intensity / 100,
        transition: 'opacity 0.3s ease'
      }} />
    );
  }, [enabled, accentColor, intensity]);

  if (!enabled || !VisualizerComponent) {
    return null;
  }

  return (
    <VisualizerContainer>
      <VisualizerComponent />
    </VisualizerContainer>
  );
};

export default BackgroundVisualizer;

