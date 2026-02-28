/**
 * Default visualization parameters for background visualizers.
 *
 * This file is the app’s single source of truth for Fireflies (Particle) and
 * Comet (Trail) behavior. The debug panel (?debug=visualizer) can override
 * these at runtime; otherwise the app always uses the values below.
 *
 * To use your own defaults (e.g. from the debug panel export):
 * 1. Open the app with ?debug=visualizer, tune, then use "Download JSON" or "Copy JSON".
 * 2. Replace DEFAULT_PARTICLE and DEFAULT_TRAIL below with the "particle" and
 *    "trail" objects from that JSON (keep the same property names and types).
 * 3. Save this file; the app will use the new defaults on next load.
 */

export interface ParticleVisualizerConfig {
  // Radius (normal mode)
  minRadius: number;
  maxRadius: number;
  // Radius (zen mode)
  minRadiusZen: number;
  maxRadiusZen: number;
  // Speed
  speedRange: number;
  speedRangeZen: number;
  // Opacity range (base + random spread): base to base+spread
  opacityBase: number;
  opacitySpread: number;
  opacityBaseZen: number;
  opacitySpreadZen: number;
  // Pulse
  pulseSpeedMin: number;
  pulseSpeedSpread: number;
  pulseSpeedMinZen: number;
  pulseSpeedSpreadZen: number;
  pulseVariation: number;
  pulseVariationZen: number;
  opacityVariation: number;
  opacityVariationZen: number;
  // Playback
  pausedSpeed: number;
  zenSpeedMultiplier: number;
  // Count: base and pixel divisor (count = min(base * zenMult, pixelCount / divisor))
  countBaseMobile: number;
  countBaseDesktop: number;
  countZenMultiplier: number;
  countPixelDivisor: number;
  countPixelDivisorZen: number;
  countPixelDivisorMobile: number;
  countPixelDivisorMobileZen: number;
}

export interface TrailVisualizerConfig {
  // Particle radius (normal)
  particleMinRadius: number;
  particleMaxRadius: number;
  particleMaxRadiusZen: number;
  // Life
  lifeDrainDivisor: number;
  lifeRespawnMin: number;
  lifeRespawnSpread: number;
  // Ship
  shipTurnRate: number;
  shipSpeedBase: number;
  shipSpeedSpread: number;
  shipWobble: number;
  pausedSpeedMult: number;
  // Trail spawn (opposite to ship + perpendicular spread)
  oppositeMult: number;
  oppositeMultZen: number;
  perpSpread: number;
  perpSpreadZen: number;
  respawnRandomSpread: number;
  particleSpeedMultZen: number;
  // Drift deceleration (per frame)
  driftDecay: number;
  // Render
  glowRadius: number;
  minVisibleRadius: number;
  // Count
  countBaseMobile: number;
  countBaseDesktop: number;
  countZenMultiplier: number;
  countPixelDivisor: number;
  countPixelDivisorZen: number;
  countPixelDivisorMobile: number;
  countPixelDivisorMobileZen: number;
}

export interface VisualizerDebugConfig {
  particle: ParticleVisualizerConfig;
  trail: TrailVisualizerConfig;
}

/** Partial overrides for debug panel; nested keys are optional. */
export interface VisualizerDebugOverrides {
  particle?: Partial<ParticleVisualizerConfig>;
  trail?: Partial<TrailVisualizerConfig>;
}

const DEFAULT_PARTICLE: ParticleVisualizerConfig = {
  minRadius: 2,
  maxRadius: 20,
  minRadiusZen: 2,
  maxRadiusZen: 20,
  speedRange: 0.6,
  speedRangeZen: 0.6,
  opacityBase: 0.3,
  opacitySpread: 0.7,
  opacityBaseZen: 0.4,
  opacitySpreadZen: 0.5,
  pulseSpeedMin: 0.01,
  pulseSpeedSpread: 0.02,
  pulseSpeedMinZen: 0.02,
  pulseSpeedSpreadZen: 0.04,
  pulseVariation: 8,
  pulseVariationZen: 8,
  opacityVariation: 0.4,
  opacityVariationZen: 0.6,
  pausedSpeed: 0.3,
  zenSpeedMultiplier: 1,
  countBaseMobile: 80,
  countBaseDesktop: 100,
  countZenMultiplier: 1,
  countPixelDivisor: 7500,
  countPixelDivisorZen: 4000,
  countPixelDivisorMobile: 10000,
  countPixelDivisorMobileZen: 6000,
};

const DEFAULT_TRAIL: TrailVisualizerConfig = {
  particleMinRadius: 7.5,
  particleMaxRadius: 30,
  particleMaxRadiusZen: 30,
  lifeDrainDivisor: 17000,
  lifeRespawnMin: 0.8,
  lifeRespawnSpread: 0.2,
  shipTurnRate: 0.00037,
  shipSpeedBase: 5.3,
  shipSpeedSpread: 0.45,
  shipWobble: 0.025,
  pausedSpeedMult: 0.1,
  oppositeMult: 0.05,
  oppositeMultZen: 0.2,
  perpSpread: 0.5,
  perpSpreadZen: 0.5,
  respawnRandomSpread: 0.8,
  particleSpeedMultZen: 1.15,
  driftDecay: 0.9992,
  glowRadius: 42,
  minVisibleRadius: 11,
  countBaseMobile: 200,
  countBaseDesktop: 200,
  countZenMultiplier: 5.5,
  countPixelDivisor: 5000,
  countPixelDivisorZen: 3000,
  countPixelDivisorMobile: 8000,
  countPixelDivisorMobileZen: 4500,
};

export const DEFAULT_VISUALIZER_DEBUG_CONFIG: VisualizerDebugConfig = {
  particle: { ...DEFAULT_PARTICLE },
  trail: { ...DEFAULT_TRAIL },
};

/** Deep merge: overrides only replace provided keys; nested objects are merged. */
export function mergeVisualizerConfig(
  base: VisualizerDebugConfig,
  overrides: VisualizerDebugOverrides | null
): VisualizerDebugConfig {
  const particle = {
    ...base.particle,
    ...(overrides?.particle ?? {}),
  };
  const trail = {
    ...base.trail,
    ...(overrides?.trail ?? {}),
  };
  return { particle, trail };
}
