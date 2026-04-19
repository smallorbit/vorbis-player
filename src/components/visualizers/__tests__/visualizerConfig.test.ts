import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VISUALIZER_DEBUG_CONFIG,
  mergeVisualizerConfig,
} from '../../../constants/visualizerDebugConfig';

describe('mergeVisualizerConfig', () => {
  it('returns an exact copy of base when overrides is null', () => {
    // #when
    const merged = mergeVisualizerConfig(DEFAULT_VISUALIZER_DEBUG_CONFIG, null);

    // #then
    expect(merged).toEqual(DEFAULT_VISUALIZER_DEBUG_CONFIG);
  });

  it('applies a particle override without touching other namespaces', () => {
    // #given
    const overrides = { particle: { minRadius: 99 } };

    // #when
    const merged = mergeVisualizerConfig(DEFAULT_VISUALIZER_DEBUG_CONFIG, overrides);

    // #then
    expect(merged.particle.minRadius).toBe(99);
    expect(merged.trail).toEqual(DEFAULT_VISUALIZER_DEBUG_CONFIG.trail);
    expect(merged.wave).toEqual(DEFAULT_VISUALIZER_DEBUG_CONFIG.wave);
    expect(merged.grid).toEqual(DEFAULT_VISUALIZER_DEBUG_CONFIG.grid);
  });

  it('applies a wave override without touching other namespaces', () => {
    // #given
    const overrides = { wave: { waveCount: 12 } };

    // #when
    const merged = mergeVisualizerConfig(DEFAULT_VISUALIZER_DEBUG_CONFIG, overrides);

    // #then
    expect(merged.wave.waveCount).toBe(12);
    expect(merged.particle).toEqual(DEFAULT_VISUALIZER_DEBUG_CONFIG.particle);
    expect(merged.trail).toEqual(DEFAULT_VISUALIZER_DEBUG_CONFIG.trail);
    expect(merged.grid).toEqual(DEFAULT_VISUALIZER_DEBUG_CONFIG.grid);
  });

  it('applies a grid override without touching other namespaces', () => {
    // #given
    const overrides = { grid: { amplitudeBase: 0.5, waveCount: 4 } };

    // #when
    const merged = mergeVisualizerConfig(DEFAULT_VISUALIZER_DEBUG_CONFIG, overrides);

    // #then
    expect(merged.grid.amplitudeBase).toBe(0.5);
    expect(merged.grid.waveCount).toBe(4);
    expect(merged.grid.spacing).toBe(DEFAULT_VISUALIZER_DEBUG_CONFIG.grid.spacing);
    expect(merged.particle).toEqual(DEFAULT_VISUALIZER_DEBUG_CONFIG.particle);
  });

  it('applies a trail override without touching other namespaces', () => {
    // #given
    const overrides = { trail: { glowRadius: 0 } };

    // #when
    const merged = mergeVisualizerConfig(DEFAULT_VISUALIZER_DEBUG_CONFIG, overrides);

    // #then
    expect(merged.trail.glowRadius).toBe(0);
    expect(merged.trail.shipSpeedBase).toBe(DEFAULT_VISUALIZER_DEBUG_CONFIG.trail.shipSpeedBase);
  });

  it('does not mutate the base config', () => {
    // #given
    const base = {
      ...DEFAULT_VISUALIZER_DEBUG_CONFIG,
      particle: { ...DEFAULT_VISUALIZER_DEBUG_CONFIG.particle },
    };
    const originalMinRadius = base.particle.minRadius;

    // #when
    mergeVisualizerConfig(base, { particle: { minRadius: 999 } });

    // #then
    expect(base.particle.minRadius).toBe(originalMinRadius);
  });

  it('merges multiple namespaces simultaneously', () => {
    // #given
    const overrides = {
      particle: { minRadius: 5 },
      wave: { waveCount: 3 },
    };

    // #when
    const merged = mergeVisualizerConfig(DEFAULT_VISUALIZER_DEBUG_CONFIG, overrides);

    // #then
    expect(merged.particle.minRadius).toBe(5);
    expect(merged.wave.waveCount).toBe(3);
    // unrelated keys stay at default
    expect(merged.particle.maxRadius).toBe(DEFAULT_VISUALIZER_DEBUG_CONFIG.particle.maxRadius);
    expect(merged.wave.phaseSpeedMin).toBe(DEFAULT_VISUALIZER_DEBUG_CONFIG.wave.phaseSpeedMin);
  });
});

describe('DEFAULT_VISUALIZER_DEBUG_CONFIG', () => {
  it('particle amplitude range is positive (maxRadius > minRadius)', () => {
    const { minRadius, maxRadius } = DEFAULT_VISUALIZER_DEBUG_CONFIG.particle;
    expect(maxRadius).toBeGreaterThan(minRadius);
  });

  it('trail particle radius range is positive', () => {
    const { particleMinRadius, particleMaxRadius } = DEFAULT_VISUALIZER_DEBUG_CONFIG.trail;
    expect(particleMaxRadius).toBeGreaterThan(particleMinRadius);
  });

  it('wave opacity values are positive', () => {
    const { opacityBase, opacityLayerScale } = DEFAULT_VISUALIZER_DEBUG_CONFIG.wave;
    expect(opacityBase).toBeGreaterThan(0);
    expect(opacityLayerScale).toBeGreaterThan(0);
  });

  it('grid waveCount matches actual wave initialization assumptions', () => {
    // WaveVisualizer loops from i=0 to waveCount-1; if waveCount < 2, layerRatio always 0
    expect(DEFAULT_VISUALIZER_DEBUG_CONFIG.wave.waveCount).toBeGreaterThan(1);
  });

  it('particle speed multiplier is positive', () => {
    expect(DEFAULT_VISUALIZER_DEBUG_CONFIG.particle.speedMultiplier).toBeGreaterThan(0);
  });

  it('grid amplitude base is between 0 and 1 (fraction of canvas dimension)', () => {
    const { amplitudeBase } = DEFAULT_VISUALIZER_DEBUG_CONFIG.grid;
    expect(amplitudeBase).toBeGreaterThan(0);
    expect(amplitudeBase).toBeLessThan(1);
  });
});
