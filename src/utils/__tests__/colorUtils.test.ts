import { describe, it, expect } from 'vitest';
import { 
  hexToRgb, 
  getRelativeLuminance, 
  getContrastRatio,
  getContrastColor 
} from '../colorUtils';

describe('colorUtils', () => {
  describe('hexToRgb', () => {
    it('should convert hex to RGB correctly', () => {
      expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
      expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
      expect(hexToRgb('#ff0000')).toEqual([255, 0, 0]);
      expect(hexToRgb('#00ff00')).toEqual([0, 255, 0]);
      expect(hexToRgb('#0000ff')).toEqual([0, 0, 255]);
    });

    it('should handle hex without # prefix', () => {
      expect(hexToRgb('ffffff')).toEqual([255, 255, 255]);
    });
  });

  describe('getRelativeLuminance', () => {
    it('should return 1 for white', () => {
      // #when
      const luminance = getRelativeLuminance('#ffffff');

      // #then
      expect(luminance).toBeCloseTo(1, 2);
    });

    it('should return 0 for black', () => {
      // #when
      const luminance = getRelativeLuminance('#000000');

      // #then
      expect(luminance).toBeCloseTo(0, 2);
    });

    it('should calculate intermediate luminance values', () => {
      // #when
      const grayLuminance = getRelativeLuminance('#808080');

      // #then
      expect(grayLuminance).toBeGreaterThan(0.1);
      expect(grayLuminance).toBeLessThan(0.5);
    });
  });

  describe('getContrastRatio', () => {
    it('should be 21 for black on white', () => {
      // #when / #then
      expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    });

    it('should be 1 for identical colors', () => {
      // #when / #then
      expect(getContrastRatio('#fb923c', '#fb923c')).toBeCloseTo(1, 5);
    });

    it('should be symmetric', () => {
      // #when / #then
      expect(getContrastRatio('#1a1a1a', '#fb923c')).toBeCloseTo(getContrastRatio('#fb923c', '#1a1a1a'), 10);
    });
  });

  describe('getContrastColor', () => {
    it('should return dark color for light backgrounds', () => {
      // #when / #then
      expect(getContrastColor('#ffffff')).toBe('#1a1a1a');
      expect(getContrastColor('#f5f5f0')).toBe('#1a1a1a');
      expect(getContrastColor('#ffff00')).toBe('#1a1a1a');
      expect(getContrastColor('#fb923c')).toBe('#1a1a1a');
    });

    it('should return light color for dark backgrounds', () => {
      // #when / #then
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#1a1a1a')).toBe('#ffffff');
      expect(getContrastColor('#000080')).toBe('#ffffff');
    });

    it('should pick a foreground meeting WCAG AA (4.5:1) for mid-luminance accents', () => {
      // #given — saturated mid-tones the extractor commonly produces
      const accents = ['#fb923c', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#14b8a6', '#808080'];

      // #when
      const ratios = accents.map((accent) => getContrastRatio(accent, getContrastColor(accent)));

      // #then
      ratios.forEach((ratio) => expect(ratio).toBeGreaterThanOrEqual(4.5));
    });

    it('should fall back to pure black when neither candidate reaches AA', () => {
      // #given — #a855f7 gives 4.40:1 against #1a1a1a and 3.96:1 against white

      // #when
      const foreground = getContrastColor('#a855f7');

      // #then
      expect(foreground).toBe('#000000');
    });

    it('should support custom contrast colors', () => {
      // #when / #then
      expect(getContrastColor('#ffffff', '#333333', '#eeeeee')).toBe('#333333');
      expect(getContrastColor('#000000', '#333333', '#eeeeee')).toBe('#eeeeee');
    });
  });
});
