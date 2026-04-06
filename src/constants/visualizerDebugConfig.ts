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

export interface GridWaveVisualizerConfig {
  spacing: number;
  waveCount: number;
  waveSpeedBase: number;
  waveSpeedSpread: number;
  amplitudeBase: number;
  frequencyBase: number;
  frequencySpread: number;
  perspectiveStrength: number;
  baseRadius: number;
  radiusWaveScale: number;
  opacityBase: number;
  opacityWaveScale: number;
  pausedSpeedMult: number;
  countBaseMobile: number;
  countBaseDesktop: number;
}

export interface WaveVisualizerConfig {
  waveCount: number;
  phaseSpeedMin: number;
  phaseSpeedSpread: number;
  amplitudeBase: number;
  amplitudeLayerScale: number;
  frequencyMin: number;
  frequencySpread: number;
  yBaseStart: number;
  yBaseLayerScale: number;
  opacityBase: number;
  opacityLayerScale: number;
  pausedSpeedMult: number;
}

export interface VisualizerDebugConfig {
  particle: ParticleVisualizerConfig;
  trail: TrailVisualizerConfig;
  wave: WaveVisualizerConfig;
  grid: GridWaveVisualizerConfig;
}

/** Partial overrides for debug panel; nested keys are optional. */
export interface VisualizerDebugOverrides {
  particle?: Partial<ParticleVisualizerConfig>;
  trail?: Partial<TrailVisualizerConfig>;
  wave?: Partial<WaveVisualizerConfig>;
  grid?: Partial<GridWaveVisualizerConfig>;
}

const DEFAULT_PARTICLE: ParticleVisualizerConfig = {
  minRadius: 2,
  maxRadius: 20,
  speedRange: 0.75,
  opacityBase: 0.15,
  opacitySpread: 0.45,
  pulseSpeedMin: 0.01,
  pulseSpeedSpread: 0.02,
  pulseVariation: 10,
  opacityVariation: 0.4,
  pausedSpeed: 0.3,
  speedMultiplier: 0.8,
  countBaseMobile: 80,
  countBaseDesktop: 160,
  countPixelDivisor: 2000,
  countPixelDivisorMobile: 10000,
};

const DEFAULT_TRAIL: TrailVisualizerConfig = {
  particleMinRadius: 3.5,
  particleMaxRadius: 29,
  lifeDrainDivisor: 17000,
  lifeRespawnMin: 0.8,
  lifeRespawnSpread: 0.2,
  shipTurnRate: 0.00013,
  shipSpeedBase: 2.5,
  shipSpeedSpread: 1.3,
  shipWobble: 0.025,
  pausedSpeedMult: 0.1,
  oppositeMult: 0.15,
  perpSpread: 0.8,
  respawnRandomSpread: 0.8,
  particleSpeedMult: 0.9,
  driftDecay: 1,
  glowRadius: 16,
  minVisibleRadius: 11,
  countBaseMobile: 160,
  countBaseDesktop: 255,
  countPixelDivisor: 5000,
  countPixelDivisorMobile: 5000,
};



const DEFAULT_GRID_WAVE: GridWaveVisualizerConfig = {
  spacing: 35,
  waveCount: 3,
  waveSpeedBase: 0.018,
  waveSpeedSpread: 0.012,
  amplitudeBase: 0.06,
  frequencyBase: 0.012,
  frequencySpread: 0.008,
  perspectiveStrength: 0.4,
  baseRadius: 2.5,
  radiusWaveScale: 1.2,
  opacityBase: 0.25,
  opacityWaveScale: 0.45,
  pausedSpeedMult: 0.3,
  countBaseMobile: 1,
  countBaseDesktop: 1,
};

const DEFAULT_WAVE: WaveVisualizerConfig = {
  waveCount: 4,
  phaseSpeedMin: 0.004,
  phaseSpeedSpread: 0.003,
  amplitudeBase: 0.06,
  amplitudeLayerScale: 0.05,
  frequencyMin: 0.003,
  frequencySpread: 0.002,
  yBaseStart: 0.55,
  yBaseLayerScale: 0.12,
  opacityBase: 0.12,
  opacityLayerScale: 0.1,
  pausedSpeedMult: 0.3,
};

export const DEFAULT_VISUALIZER_DEBUG_CONFIG: VisualizerDebugConfig = {
  particle: { ...DEFAULT_PARTICLE },
  trail: { ...DEFAULT_TRAIL },
  wave: { ...DEFAULT_WAVE },
  grid: { ...DEFAULT_GRID_WAVE },
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
  const wave = {
    ...base.wave,
    ...(overrides?.wave ?? {}),
  };
  const grid = {
    ...base.grid,
    ...(overrides?.grid ?? {}),
  };
  return { particle, trail, wave, grid };
}
