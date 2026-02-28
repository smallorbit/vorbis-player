/**
 * Default visualization parameters for background visualizers.
 * Used as the single source of truth; can be overridden at runtime when
 * debug mode is enabled (?debug=visualizer) for tuning. Export the merged
 * config to promote chosen values back into these defaults.
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
  minRadius: 3,
  maxRadius: 11,
  minRadiusZen: 2,
  maxRadiusZen: 14,
  speedRange: 0.5,
  speedRangeZen: 0.6,
  opacityBase: 0.3,
  opacitySpread: 0.4,
  opacityBaseZen: 0.4,
  opacitySpreadZen: 0.5,
  pulseSpeedMin: 0.01,
  pulseSpeedSpread: 0.02,
  pulseSpeedMinZen: 0.02,
  pulseSpeedSpreadZen: 0.04,
  pulseVariation: 3,
  pulseVariationZen: 5,
  opacityVariation: 0.4,
  opacityVariationZen: 0.6,
  pausedSpeed: 0.3,
  zenSpeedMultiplier: 1.2,
  countBaseMobile: 50,
  countBaseDesktop: 80,
  countZenMultiplier: 1.25,
  countPixelDivisor: 7500,
  countPixelDivisorZen: 4000,
  countPixelDivisorMobile: 10000,
  countPixelDivisorMobileZen: 6000,
};

const DEFAULT_TRAIL: TrailVisualizerConfig = {
  particleMinRadius: 6,
  particleMaxRadius: 18,
  particleMaxRadiusZen: 24,
  lifeDrainDivisor: 14250,
  lifeRespawnMin: 0.8,
  lifeRespawnSpread: 0.2,
  shipTurnRate: 0.00012,
  shipSpeedBase: 2.7,
  shipSpeedSpread: 0.5,
  shipWobble: 0.025,
  pausedSpeedMult: 0.15,
  oppositeMult: 0.4,
  oppositeMultZen: 0.55,
  perpSpread: 2.2,
  perpSpreadZen: 2.6,
  respawnRandomSpread: 0.8,
  particleSpeedMultZen: 1.15,
  driftDecay: 0.9992,
  glowRadius: 44,
  minVisibleRadius: 5,
  countBaseMobile: 85,
  countBaseDesktop: 140,
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
