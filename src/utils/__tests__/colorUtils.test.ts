import { describe, it, expect } from 'vitest';
import { 
  hexToRgb, 
  getRelativeLuminance, 
  isLightColor, 
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
      const luminance = getRelativeLuminance('#ffffff');
      expect(luminance).toBeCloseTo(1, 2);
    });

    it('should return 0 for black', () => {
      const luminance = getRelativeLuminance('#000000');
      expect(luminance).toBeCloseTo(0, 2);
    });

    it('should calculate intermediate luminance values', () => {
      // Gray should be around 0.2-0.4 depending on the exact shade
      const grayLuminance = getRelativeLuminance('#808080');
      expect(grayLuminance).toBeGreaterThan(0.1);
      expect(grayLuminance).toBeLessThan(0.5);
    });
  });

  describe('isLightColor', () => {
    it('should identify white as light', () => {
      expect(isLightColor('#ffffff')).toBe(true);
      expect(isLightColor('#f5f5f0')).toBe(true); // soft off-white
    });

    it('should identify black as dark', () => {
      expect(isLightColor('#000000')).toBe(false);
    });

    it('should identify bright colors correctly', () => {
      expect(isLightColor('#ffff00')).toBe(true); // yellow is light
      expect(isLightColor('#00ffff')).toBe(true); // cyan is light
    });

    it('should identify dark colors correctly', () => {
      expect(isLightColor('#000080')).toBe(false); // navy is dark
      expect(isLightColor('#800000')).toBe(false); // maroon is dark
    });
  });

  describe('getContrastColor', () => {
    it('should return dark color for light backgrounds', () => {
      expect(getContrastColor('#ffffff')).toBe('#1a1a1a');
      expect(getContrastColor('#f5f5f0')).toBe('#1a1a1a'); // soft off-white
      expect(getContrastColor('#ffff00')).toBe('#1a1a1a'); // yellow
    });

    it('should return light color for dark backgrounds', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#1a1a1a')).toBe('#ffffff');
      expect(getContrastColor('#fb923c')).toBe('#ffffff'); // marigold (original accent)
    });

    it('should support custom contrast colors', () => {
      expect(getContrastColor('#ffffff', '#333333', '#eeeeee')).toBe('#333333');
      expect(getContrastColor('#000000', '#333333', '#eeeeee')).toBe('#eeeeee');
    });
  });
});
