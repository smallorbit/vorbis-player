import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectBrowserFeatures, getEnhancedViewportInfo } from '../featureDetection';

describe('featureDetection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectBrowserFeatures', () => {
    it('returns an object with all expected feature keys', () => {
      // #given - CSS.supports may not exist in jsdom, so mock it
      if (typeof CSS === 'undefined' || !CSS.supports) {
        Object.defineProperty(globalThis, 'CSS', {
          value: { supports: vi.fn().mockReturnValue(false) },
          configurable: true,
        });
      }

      // #when
      const features = detectBrowserFeatures();

      // #then
      expect(features).toHaveProperty('visualViewport');
      expect(features).toHaveProperty('containerQueries');
      expect(features).toHaveProperty('backdropFilter');
      expect(features).toHaveProperty('intersectionObserver');
      expect(features).toHaveProperty('resizeObserver');
      expect(features).toHaveProperty('matchMedia');
    });

    it('returns all false when CSS.supports always returns false', () => {
      // #given
      Object.defineProperty(globalThis, 'CSS', {
        value: { supports: vi.fn().mockReturnValue(false) },
        configurable: true,
      });

      // #when
      const features = detectBrowserFeatures();

      // #then
      expect(features.containerQueries).toBe(false);
      expect(features.backdropFilter).toBe(false);
      expect(features.cssGrid).toBe(false);
      expect(features.cssFlexbox).toBe(false);
      expect(features.cssAspectRatio).toBe(false);
    });
  });

  describe('getEnhancedViewportInfo', () => {
    it('uses window.visualViewport when present', () => {
      // #given
      const mockViewport = { width: 400, height: 800 };
      Object.defineProperty(window, 'visualViewport', {
        value: mockViewport,
        configurable: true,
      });

      const features = {
        visualViewport: true,
        devicePixelRatio: false,
      } as ReturnType<typeof detectBrowserFeatures>;

      // #when
      const info = getEnhancedViewportInfo(features);

      // #then
      expect(info.width).toBe(400);
      expect(info.height).toBe(800);
      expect(info.orientation).toBe('portrait');
    });

    it('falls back to window.innerWidth when visualViewport is absent', () => {
      // #given
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
      const features = {
        visualViewport: false,
        devicePixelRatio: true,
      } as ReturnType<typeof detectBrowserFeatures>;

      // #when
      const info = getEnhancedViewportInfo(features);

      // #then
      expect(info.width).toBe(1024);
      expect(info.height).toBe(768);
      expect(info.orientation).toBe('landscape');
      expect(info.devicePixelRatio).toBe(2);
    });

    it('returns portrait orientation when height > width', () => {
      // #given
      Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 812, configurable: true });
      const features = {
        visualViewport: false,
        devicePixelRatio: false,
      } as ReturnType<typeof detectBrowserFeatures>;

      // #when
      const info = getEnhancedViewportInfo(features);

      // #then
      expect(info.orientation).toBe('portrait');
      expect(info.devicePixelRatio).toBe(1);
    });
  });
});
