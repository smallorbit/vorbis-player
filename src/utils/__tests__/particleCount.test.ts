import { describe, it, expect } from 'vitest';
import { calculateParticleCount } from '../particleCount';

const defaultConfig = {
  countBaseMobile: 80,
  countBaseDesktop: 160,
  countPixelDivisorMobile: 10000,
  countPixelDivisor: 2000,
};

describe('calculateParticleCount', () => {
  it('returns fewer particles for low intensity', () => {
    // #when
    const countLow = calculateParticleCount(1920, 1080, 10, defaultConfig);
    const countHigh = calculateParticleCount(1920, 1080, 60, defaultConfig);

    // #then
    expect(countLow).toBeLessThan(countHigh);
  });

  it('caps count at countBaseDesktop on desktop', () => {
    // #given — very large canvas so pixel-based count would exceed cap
    const countBaseDesktop = 160;

    // #when
    const count = calculateParticleCount(10000, 10000, 60, { ...defaultConfig, countBaseDesktop });

    // #then
    expect(count).toBeLessThanOrEqual(countBaseDesktop);
  });

  it('caps count at countBaseMobile on mobile widths', () => {
    // #given — mobile width < 768
    const countBaseMobile = 80;

    // #when
    const count = calculateParticleCount(375, 10000, 60, { ...defaultConfig, countBaseMobile });

    // #then
    expect(count).toBeLessThanOrEqual(countBaseMobile);
  });

  it('mobile path activates below 768px width', () => {
    // #given — same height and intensity, mobile vs desktop width
    const width = 767;
    const countMobile = calculateParticleCount(width, 1080, 60, defaultConfig);
    const countDesktop = calculateParticleCount(768, 1080, 60, defaultConfig);

    // #then — they use different divisors, so counts differ
    expect(countMobile).not.toEqual(countDesktop);
  });

  it('scale floor of 0.1 prevents zero count at very low intensity', () => {
    // #given — intensity = 1 → scale = max(0.1, 1/60) = max(0.1, 0.0167) = 0.1
    const count = calculateParticleCount(1920, 1080, 1, defaultConfig);

    // #then
    expect(count).toBeGreaterThan(0);
  });
});
