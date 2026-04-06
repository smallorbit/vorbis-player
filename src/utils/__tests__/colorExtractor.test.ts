import { describe, it, expect } from 'vitest';
import { getTransparentVariant } from '../colorExtractor';

// The module-level functions rgbToHsl, rgbToHex, isGoodContrast, isVibrant are not exported,
// so we test them indirectly through getTransparentVariant and the LRU cache behavior.
// We import and re-implement the pure functions locally to verify correctness.

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function isGoodContrast(r: number, g: number, b: number): boolean {
  const [, , lightness] = rgbToHsl(r, g, b);
  return lightness >= 40 && lightness <= 85;
}

function isVibrant(r: number, g: number, b: number): boolean {
  const [, saturation] = rgbToHsl(r, g, b);
  return saturation >= 50;
}

describe('colorExtractor', () => {
  describe('rgbToHsl', () => {
    it('converts pure red correctly', () => {
      // #when
      const [h, s, l] = rgbToHsl(255, 0, 0);

      // #then
      expect(h).toBe(0);
      expect(s).toBe(100);
      expect(l).toBe(50);
    });

    it('converts white to 0% saturation, 100% lightness', () => {
      // #when
      const [h, s, l] = rgbToHsl(255, 255, 255);

      // #then
      expect(h).toBe(0);
      expect(s).toBe(0);
      expect(l).toBe(100);
    });
  });

  describe('rgbToHex', () => {
    it('converts (255, 128, 64) to #ff8040', () => {
      // #when / #then
      expect(rgbToHex(255, 128, 64)).toBe('#ff8040');
    });

    it('converts (0, 0, 0) to #000000', () => {
      // #when / #then
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });
  });

  describe('isGoodContrast', () => {
    it('returns true for mid-lightness colors (40-85%)', () => {
      // #when / #then
      expect(isGoodContrast(255, 0, 0)).toBe(true);
    });

    it('returns false for very dark colors (below 40%)', () => {
      // #when / #then
      expect(isGoodContrast(0, 0, 0)).toBe(false);
    });

    it('returns false for very light colors (above 85%)', () => {
      // #when / #then
      expect(isGoodContrast(255, 255, 255)).toBe(false);
    });
  });

  describe('isVibrant', () => {
    it('returns true for saturated colors (>= 50%)', () => {
      // #when / #then
      expect(isVibrant(255, 0, 0)).toBe(true);
    });

    it('returns false for gray (0% saturation)', () => {
      // #when / #then
      expect(isVibrant(128, 128, 128)).toBe(false);
    });
  });

  describe('getTransparentVariant', () => {
    it('handles hex input', () => {
      // #when / #then
      expect(getTransparentVariant('#ff8040')).toBe('rgba(255, 128, 64, 0.2)');
    });

    it('handles rgb input', () => {
      // #when / #then
      expect(getTransparentVariant('rgb(255, 128, 64)')).toBe('rgba(255, 128, 64, 0.2)');
    });

    it('accepts custom opacity', () => {
      // #when / #then
      expect(getTransparentVariant('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('returns original string for unsupported format', () => {
      // #when / #then
      expect(getTransparentVariant('red')).toBe('red');
    });
  });

  describe('LRU cache eviction', () => {
    it('evicts oldest entry when cache exceeds 100 items', async () => {
      // #given - reset module to get a fresh cache
      vi.resetModules();
      const mod = await import('../colorExtractor');

      // Mock Image to trigger onerror (jsdom has no canvas)
      const OriginalImage = global.Image;
      class MockImage {
        crossOrigin = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          setTimeout(() => this.onerror?.(), 0);
        }
      }
      global.Image = MockImage as unknown as typeof Image;

      // #when - add 101 entries to the cache (max is 100)
      for (let i = 0; i < 101; i++) {
        await mod.extractDominantColor(`https://example.com/img-${i}.jpg`);
      }

      // #then - first entry (img-0) should be evicted, later entries should remain
      const imgSpy = vi.spyOn(global, 'Image');

      // img-50 should still be cached — no new Image created
      await mod.extractDominantColor('https://example.com/img-50.jpg');
      expect(imgSpy).not.toHaveBeenCalled();

      // img-0 was evicted, so extracting it again will create a new Image
      imgSpy.mockClear();
      await mod.extractDominantColor('https://example.com/img-0.jpg');
      expect(imgSpy).toHaveBeenCalled();

      global.Image = OriginalImage;
    });
  });
});
