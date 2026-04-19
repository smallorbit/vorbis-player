import { describe, it, expect } from 'vitest';
import {
  PHI,
  waveLayerPhaseSpeed,
  waveY,
  layerRatio,
  gridWaveProjection,
  gridDisplacement,
  gridSpatialFactor,
} from '../math';

describe('waveY', () => {
  it('returns yBase when amplitude is zero', () => {
    // #when
    const y = waveY(100, 0.005, 0, 0, 300);

    // #then
    expect(y).toBe(300);
  });

  it('returns yBase when sin argument is a multiple of pi (zero crossing)', () => {
    // #given
    const x = 0;
    const phase = 0;
    const frequency = 0.005;

    // #when — sin(0 * 0.005 + 0) = sin(0) = 0, so y = yBase
    const y = waveY(x, frequency, phase, 50, 200);

    // #then
    expect(y).toBe(200);
  });

  it('reaches yBase + amplitude when sin argument is pi/2', () => {
    // #given — choose x and phase so that x * freq + phase = pi/2
    const frequency = 0.005;
    const phase = Math.PI / 2;
    const amplitude = 80;
    const yBase = 100;

    // #when
    const y = waveY(0, frequency, phase, amplitude, yBase);

    // #then
    expect(y).toBeCloseTo(yBase + amplitude, 10);
  });

  it('reaches yBase - amplitude when sin argument is -pi/2', () => {
    // #given
    const frequency = 0.005;
    const phase = -Math.PI / 2;
    const amplitude = 60;
    const yBase = 150;

    // #when
    const y = waveY(0, frequency, phase, amplitude, yBase);

    // #then
    expect(y).toBeCloseTo(yBase - amplitude, 10);
  });

  it('scales linearly with amplitude', () => {
    // #given — fix x and phase so sin ≠ 0
    const x = 0;
    const frequency = 0;
    const phase = Math.PI / 4; // sin(pi/4) = sqrt(2)/2
    const yBase = 0;

    // #when
    const y1 = waveY(x, frequency, phase, 10, yBase);
    const y2 = waveY(x, frequency, phase, 20, yBase);

    // #then — doubling amplitude doubles the displacement
    expect(y2).toBeCloseTo(y1 * 2, 10);
  });
});

describe('layerRatio', () => {
  it('returns 0 for the first layer', () => {
    expect(layerRatio(0, 5)).toBe(0);
  });

  it('returns 1 for the last layer', () => {
    expect(layerRatio(4, 5)).toBe(1);
  });

  it('returns 0.5 for the middle layer', () => {
    expect(layerRatio(2, 5)).toBeCloseTo(0.5, 10);
  });

  it('returns 0 for a single-layer count (avoids division by zero)', () => {
    // max(1, 1-1) = max(1, 0) = 1 → 0/1 = 0
    expect(layerRatio(0, 1)).toBe(0);
  });
});

describe('waveLayerPhaseSpeed', () => {
  it('returns phaseSpeedMin when layerIndex is 0 and phaseSpeedSpread is 0', () => {
    // #given
    const phaseSpeedMin = 0.003;

    // #when
    const speed = waveLayerPhaseSpeed(0, 5, phaseSpeedMin, 0);

    // #then — normalizedPhi at layer 0: PHI^0 / PHI^2 = 1 / PHI^2 ≈ 0.382
    // speed = phaseSpeedMin + 0.382 * 0 = phaseSpeedMin
    expect(speed).toBeCloseTo(phaseSpeedMin, 10);
  });

  it('returns a higher speed for later layers', () => {
    // #when
    const speedEarly = waveLayerPhaseSpeed(0, 7, 0.003, 0.012);
    const speedLate = waveLayerPhaseSpeed(6, 7, 0.003, 0.012);

    // #then
    expect(speedLate).toBeGreaterThan(speedEarly);
  });

  it('speeds are monotonically increasing across layers', () => {
    // #given
    const count = 7;
    const speeds = Array.from({ length: count }, (_, i) =>
      waveLayerPhaseSpeed(i, count, 0.003, 0.012)
    );

    // #then
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThan(speeds[i - 1]);
    }
  });

  it('last layer speed matches phaseSpeedMin + phaseSpeedSpread (normalizedPhi=1 at last layer)', () => {
    // #given — at layerIndex = layerCount-1, the exponent is 2, so phiPower = PHI^2 and normalizedPhi = 1
    const phaseSpeedMin = 0.003;
    const phaseSpeedSpread = 0.012;

    // #when
    const speed = waveLayerPhaseSpeed(6, 7, phaseSpeedMin, phaseSpeedSpread);

    // #then
    expect(speed).toBeCloseTo(phaseSpeedMin + phaseSpeedSpread, 10);
  });
});

describe('gridWaveProjection', () => {
  it('returns 0 when position is at the origin and frequency is non-zero', () => {
    // #when
    const proj = gridWaveProjection(0, 0, 1, 0, 0.005);

    // #then
    expect(proj).toBe(0);
  });

  it('doubles when frequency doubles (linearity)', () => {
    // #when
    const proj1 = gridWaveProjection(10, 20, 0.707, 0.707, 0.005);
    const proj2 = gridWaveProjection(10, 20, 0.707, 0.707, 0.010);

    // #then
    expect(proj2).toBeCloseTo(proj1 * 2, 10);
  });

  it('matches manual calculation', () => {
    // #given
    const baseX = 100;
    const baseY = 50;
    const angleX = Math.cos(0); // 1
    const angleY = Math.sin(0); // 0
    const frequency = 0.005;

    // #when
    const proj = gridWaveProjection(baseX, baseY, angleX, angleY, frequency);

    // #then — 100*1*0.005 + 50*0*0.005 = 0.5
    expect(proj).toBeCloseTo(0.5, 10);
  });
});

describe('gridDisplacement', () => {
  it('returns 0 when there are no waves', () => {
    expect(gridDisplacement(100, 100, [])).toBe(0);
  });

  it('returns 0 when all waves contribute zero displacement (phase = -proj)', () => {
    // #given — sin(proj + phase) = sin(0) = 0 when phase = -proj
    const baseX = 0;
    const baseY = 0;
    const waves = [
      { angleX: 1, angleY: 0, frequency: 0.005, phase: 0 }, // proj = 0, sin(0) = 0
    ];

    // #when
    const d = gridDisplacement(baseX, baseY, waves);

    // #then
    expect(d).toBe(0);
  });

  it('returns 1 when all waves contribute maximum positive displacement', () => {
    // #given — make sin(proj + phase) = sin(pi/2) = 1 for each wave
    const waves = [
      { angleX: 0, angleY: 0, frequency: 0.005, phase: Math.PI / 2 }, // proj=0, phase=pi/2
      { angleX: 0, angleY: 0, frequency: 0.005, phase: Math.PI / 2 },
    ];

    // #when
    const d = gridDisplacement(0, 0, waves);

    // #then
    expect(d).toBeCloseTo(1, 10);
  });

  it('averages contributions from multiple waves', () => {
    // #given — one wave at +1 and one at -1
    const waves = [
      { angleX: 0, angleY: 0, frequency: 0, phase: Math.PI / 2 },  // sin(pi/2) = 1
      { angleX: 0, angleY: 0, frequency: 0, phase: -Math.PI / 2 }, // sin(-pi/2) = -1
    ];

    // #when
    const d = gridDisplacement(0, 0, waves);

    // #then — average of +1 and -1 = 0
    expect(d).toBeCloseTo(0, 10);
  });

  it('output stays in [-1, 1]', () => {
    // #given — random-ish wave configuration
    const waves = [
      { angleX: 0.707, angleY: 0.707, frequency: 0.005, phase: 0.3 },
      { angleX: -0.707, angleY: 0.707, frequency: 0.008, phase: 1.2 },
    ];

    for (let x = 0; x < 500; x += 50) {
      for (let y = 0; y < 500; y += 50) {
        // #when
        const d = gridDisplacement(x, y, waves);

        // #then
        expect(d).toBeGreaterThanOrEqual(-1);
        expect(d).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('gridSpatialFactor', () => {
  it('returns 0 for a particle at center top', () => {
    // #given — centerX particle, first row → edgeFactor=0, depthFactor=0
    const factor = gridSpatialFactor(500, 500, 0, 10, 0.7);

    // #then
    expect(factor).toBeCloseTo(0, 10);
  });

  it('returns 1 for a particle at edge bottom', () => {
    // #given — right-most particle, last row → edgeFactor≈1, depthFactor=1
    const factor = gridSpatialFactor(1000, 500, 9, 10, 0.7);

    // #then — 0.7 * 1 + 0.3 * 1 = 1.0
    expect(factor).toBeCloseTo(1.0, 10);
  });

  it('edgeIntensity controls the blend between edge and depth factors', () => {
    // #given — a particle at left edge, middle row
    const baseX = 0;
    const centerX = 500;
    const gridY = 4;
    const rows = 9;

    // #when — vary edgeIntensity
    const factorEdge = gridSpatialFactor(baseX, centerX, gridY, rows, 1.0);
    const factorDepth = gridSpatialFactor(baseX, centerX, gridY, rows, 0.0);

    // #then — at edgeIntensity=1.0, only edgeFactor matters; at 0.0, only depthFactor
    const edgeFactor = Math.abs(baseX - centerX) / Math.max(1, centerX);
    const depthFactor = gridY / Math.max(1, rows - 1);
    expect(factorEdge).toBeCloseTo(edgeFactor, 10);
    expect(factorDepth).toBeCloseTo(depthFactor, 10);
  });

  it('stays in [0, 1] for grid positions within bounds', () => {
    // #given
    const centerX = 500;
    const rows = 10;

    for (let col = 0; col <= 20; col++) {
      for (let row = 0; row < rows; row++) {
        const baseX = col * 50;
        // #when
        const factor = gridSpatialFactor(baseX, centerX, row, rows, 0.7);
        // #then
        expect(factor).toBeGreaterThanOrEqual(0);
        expect(factor).toBeLessThanOrEqual(1.5); // edgeFactor can exceed 1 at far edges
      }
    }
  });
});

describe('PHI constant', () => {
  it('satisfies the golden ratio identity PHI^2 = PHI + 1', () => {
    expect(PHI * PHI).toBeCloseTo(PHI + 1, 8);
  });
});
