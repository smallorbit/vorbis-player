/**
 * Pure math helpers shared across visualizer components.
 *
 * All functions here are deterministic: same inputs always produce the same outputs.
 * They have no side effects and no canvas / DOM dependencies, making them easy to test.
 */

/** Golden ratio, used by WaveVisualizer to distribute phase speeds across layers. */
export const PHI = 1.6180339887;

/**
 * Compute the phi-based phase speed for a wave layer.
 *
 * The wave visualizer distributes phase speeds across layers using an exponential
 * curve derived from the golden ratio. Layer 0 gets the minimum speed; the last
 * layer gets the maximum speed.
 *
 * @param layerIndex - Zero-based index of the wave layer.
 * @param layerCount - Total number of wave layers.
 * @param phaseSpeedMin - Minimum phase speed (for the first layer).
 * @param phaseSpeedSpread - Additional speed added at the last layer.
 * @returns Phase speed for this layer.
 */
export function waveLayerPhaseSpeed(
  layerIndex: number,
  layerCount: number,
  phaseSpeedMin: number,
  phaseSpeedSpread: number
): number {
  const phiPower = Math.pow(PHI, (layerIndex / Math.max(1, layerCount - 1)) * 2);
  const normalizedPhi = phiPower / Math.pow(PHI, 2);
  return phaseSpeedMin + normalizedPhi * phaseSpeedSpread;
}

/**
 * Compute the vertical position of a point on a sine wave.
 *
 * @param x - Horizontal position along the wave.
 * @param frequency - Spatial frequency (cycles per pixel).
 * @param phase - Current phase offset (radians).
 * @param amplitude - Wave height in pixels.
 * @param yBase - Vertical baseline of the wave.
 * @returns The y-coordinate at position x.
 */
export function waveY(
  x: number,
  frequency: number,
  phase: number,
  amplitude: number,
  yBase: number
): number {
  return yBase + Math.sin(x * frequency + phase) * amplitude;
}

/**
 * Compute the normalized layer ratio for a wave / grid layer.
 *
 * @param layerIndex - Zero-based index.
 * @param layerCount - Total number of layers.
 * @returns A value in [0, 1] where 0 = first layer and 1 = last layer.
 */
export function layerRatio(layerIndex: number, layerCount: number): number {
  return layerIndex / Math.max(1, layerCount - 1);
}

/**
 * Compute the directional projection used by GridWaveVisualizer to accumulate
 * wave displacement at a particle position.
 *
 * @param baseX - Particle's resting x position.
 * @param baseY - Particle's resting y position.
 * @param angleX - Wave direction cosine.
 * @param angleY - Wave direction sine.
 * @param frequency - Spatial frequency of the wave.
 * @returns The dot-product projection (pre-sine input).
 */
export function gridWaveProjection(
  baseX: number,
  baseY: number,
  angleX: number,
  angleY: number,
  frequency: number
): number {
  return baseX * angleX * frequency + baseY * angleY * frequency;
}

/**
 * Compute the edge-weighted spatial factor used in GridWaveVisualizer for
 * perspective and opacity scaling.
 *
 * @param baseX - Particle's resting x position.
 * @param centerX - Horizontal midpoint of the canvas.
 * @param gridY - Particle's grid row index.
 * @param rows - Total number of grid rows.
 * @param edgeIntensity - Weight of edge factor vs. depth factor.
 * @returns Spatial factor in [0, 1].
 */
export function gridSpatialFactor(
  baseX: number,
  centerX: number,
  gridY: number,
  rows: number,
  edgeIntensity: number
): number {
  const edgeFactor = Math.abs(baseX - centerX) / Math.max(1, centerX);
  const depthFactor = gridY / Math.max(1, rows - 1);
  return edgeFactor * edgeIntensity + depthFactor * (1 - edgeIntensity);
}
