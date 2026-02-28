/**
 * Default visualization parameters for background visualizers.
 *
 * This file is the app's single source of truth for Fireflies (Particle) and
 * Comet (Trail) behavior. Same values are used in normal and zen mode. The debug
 * panel (?debug=visualizer) can override these at runtime.
 *
 * To use your own defaults (e.g. from the debug panel export):
 * 1. Open the app with ?debug=visualizer, tune, then use "Download JSON" or "Copy JSON".
 * 2. Replace DEFAULT_PARTICLE and DEFAULT_TRAIL below with the "particle" and
 *    "trail" objects from that JSON (keep the same property names and types).
 * 3. Save this file; the app will use the new defaults on next load.
 */

export interface ParticleVisualizerConfig {
  minRadius: number;
  maxRadius: number;
  speedRange: number;
  opacityBase: number;
  opacitySpread: number;
  pulseSpeedMin: number;
  pulseSpeedSpread: number;
  pulseVariation: number;
  opacityVariation: number;
  pausedSpeed: number;
  speedMultiplier: number;
  countBaseMobile: number;
  countBaseDesktop: number;
  countPixelDivisor: number;
  countPixelDivisorMobile: number;
}

export interface TrailVisualizerConfig {
  particleMinRadius: number;
  particleMaxRadius: number;
  lifeDrainDivisor: number;
  lifeRespawnMin: number;
  lifeRespawnSpread: number;
  shipTurnRate: number;
  shipSpeedBase: number;
  shipSpeedSpread: number;
  shipWobble: number;
  pausedSpeedMult: number;
  oppositeMult: number;
  perpSpread: number;
  respawnRandomSpread: number;
  particleSpeedMult: number;
  driftDecay: number;
  glowRadius: number;
  minVisibleRadius: number;
  countBaseMobile: number;
  countBaseDesktop: number;
  countPixelDivisor: number;
  countPixelDivisorMobile: number;
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
  speedRange: 0.6,
  opacityBase: 0.3,
  opacitySpread: 0.7,
  pulseSpeedMin: 0.01,
  pulseSpeedSpread: 0.02,
  pulseVariation: 8,
  opacityVariation: 0.4,
  pausedSpeed: 0.3,
  speedMultiplier: 1,
  countBaseMobile: 80,
  countBaseDesktop: 100,
  countPixelDivisor: 7500,
  countPixelDivisorMobile: 10000,
};

const DEFAULT_TRAIL: TrailVisualizerConfig = {
  particleMinRadius: 7.5,
  particleMaxRadius: 30,
  lifeDrainDivisor: 17000,
  lifeRespawnMin: 0.8,
  lifeRespawnSpread: 0.2,
  shipTurnRate: 0.00047,
  shipSpeedBase: 5.3,
  shipSpeedSpread: 0.45,
  shipWobble: 0.025,
  pausedSpeedMult: 0.1,
  oppositeMult: 0.05,
  perpSpread: 0.5,
  respawnRandomSpread: 0.8,
  particleSpeedMult: 1.15,
  driftDecay: 0.9992,
  glowRadius: 42,
  minVisibleRadius: 11,
  countBaseMobile: 300,
  countBaseDesktop: 400,
  countPixelDivisor: 5000,
  countPixelDivisorMobile: 5000,
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
