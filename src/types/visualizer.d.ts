/**
 * @fileoverview Background Visualizer Type Definitions
 * 
 * Type definitions for the background visualizer feature.
 * Defines visualizer styles and configuration interfaces.
 */

export type VisualizerStyle =
  | 'particles'
  | 'geometric';

interface VisualizerConfig {
  particleCount?: number;
  animationSpeed?: number;
  colorVariation?: number;
  barCount?: number;
  shapeCount?: number;
  layerCount?: number;
}

