import Grid from "./grid";
import Sphere from "./sphere";
import Cube from "./cube";

export const VISUAL_REGISTRY = {
  [Grid.id]: Grid,
  [Sphere.id]: Sphere,
  [Cube.id]: Cube,
} as const;

export type TVisual = (typeof VISUAL_REGISTRY)[keyof typeof VISUAL_REGISTRY];
export type TVisualId = TVisual["id"];

// Export individual visualizers for easy access
export { Grid, Sphere, Cube };

// Default visualizer
export const DEFAULT_VISUALIZER = Grid;

// Get visualizer by ID
export function getVisualizer(id: TVisualId): TVisual | undefined {
  return VISUAL_REGISTRY[id];
}

// Get all available visualizer IDs
export function getVisualizerIds(): TVisualId[] {
  return Object.keys(VISUAL_REGISTRY) as TVisualId[];
}

// Get all available visualizers
export function getVisualizers(): TVisual[] {
  return Object.values(VISUAL_REGISTRY);
}