import { describe, it, expect } from 'vitest';
import { generateColorVariant } from '../../../utils/visualizerUtils';

describe('generateColorVariant', () => {
  it('returns the original color string when input is not a valid hex', () => {
    // #when
    const result = generateColorVariant('not-a-color', 0.5);

    // #then
    expect(result).toBe('not-a-color');
  });

  it('returns a darker color at variation 0 (50% brightness)', () => {
    // #given — pure white: rgb(255,255,255)
    const base = '#ffffff';

    // #when
    const result = generateColorVariant(base, 0);

    // #then — brightness = 0.5 + 0*0.5 = 0.5 → each channel = round(255*0.5) = 128 → #808080
    expect(result).toBe('#808080');
  });

  it('returns the original color at variation 1 (100% brightness)', () => {
    // #given
    const base = '#ff5733';

    // #when
    const result = generateColorVariant(base, 1);

    // #then — brightness = 1.0, channels unchanged
    expect(result).toBe('#ff5733');
  });

  it('produces a color lighter than variation 0.3 when variation is 0.7', () => {
    // #given
    const base = '#886644';

    // #when
    const dark = generateColorVariant(base, 0.3);
    const light = generateColorVariant(base, 0.7);

    // #then — parse each to sum of channels and compare
    const sumChannels = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return r + g + b;
    };
    expect(sumChannels(light)).toBeGreaterThan(sumChannels(dark));
  });

  it('always returns a string starting with #', () => {
    const bases = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff'];
    for (const base of bases) {
      // #when
      const result = generateColorVariant(base, 0.5);

      // #then
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('clamps channels at 0 — black stays black regardless of variation', () => {
    // #given
    const base = '#000000';

    // #when
    const result = generateColorVariant(base, 0.5);

    // #then — 0 * any_brightness = 0
    expect(result).toBe('#000000');
  });
});
