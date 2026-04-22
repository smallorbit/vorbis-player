/**
 * @fileoverview Background Visualizer Type Definitions
 * 
 * Type definitions for the background visualizer feature.
 * Defines visualizer styles and configuration interfaces.
 */

export type VisualizerStyle =
  | 'fireflies'
  | 'comet'
  | 'wave'
  | 'grid';

export interface AlbumArtBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

