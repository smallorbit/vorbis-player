import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getViewportInfo, 
  calculatePlayerDimensions, 
  shouldUseFluidSizing,
  calculateOptimalPadding
} from '../sizingUtils';

// Mock window object for testing
const mockWindow = (width: number, height: number, devicePixelRatio = 1) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  Object.defineProperty(window, 'devicePixelRatio', {
    writable: true,
    configurable: true,
    value: devicePixelRatio,
  });
};

describe('sizingUtils', () => {
  beforeEach(() => {
    // Reset window mock
    mockWindow(1024, 700);
  });

  describe('getViewportInfo', () => {
    it('should return correct viewport info for landscape', () => {
      mockWindow(1024, 700);
      const viewport = getViewportInfo();
      
      expect(viewport.width).toBe(1024);
      expect(viewport.height).toBe(700);
      expect(viewport.orientation).toBe('landscape');
      expect(viewport.devicePixelRatio).toBe(1);
    });

    it('should return correct viewport info for portrait', () => {
      mockWindow(700, 1024);
      const viewport = getViewportInfo();
      
      expect(viewport.width).toBe(700);
      expect(viewport.height).toBe(1024);
      expect(viewport.orientation).toBe('portrait');
    });
  });

  describe('calculatePlayerDimensions', () => {
    it('should calculate dimensions for desktop landscape', () => {
      mockWindow(1920, 1080);
      const viewport = getViewportInfo();
      const dimensions = calculatePlayerDimensions(viewport);
      
      expect(dimensions.width).toBeLessThanOrEqual(1920 * 0.8);
      expect(dimensions.height).toBeLessThanOrEqual(1080 * 0.85);
      expect(dimensions.scale).toBeLessThanOrEqual(1);
    });

    it('should calculate dimensions for mobile portrait', () => {
      mockWindow(375, 667);
      const viewport = getViewportInfo();
      const dimensions = calculatePlayerDimensions(viewport);
      
      expect(dimensions.width).toBeGreaterThanOrEqual(320);
      expect(dimensions.height).toBeGreaterThanOrEqual(400);
    });

    it('should respect constraints', () => {
      mockWindow(1920, 1080);
      const viewport = getViewportInfo();
      const constraints = { minWidth: 500, maxWidth: 800 };
      const dimensions = calculatePlayerDimensions(viewport, constraints);
      
      expect(dimensions.width).toBeGreaterThanOrEqual(500);
      expect(dimensions.width).toBeLessThanOrEqual(800);
    });
  });


  describe('shouldUseFluidSizing', () => {
    it('should return true for mobile', () => {
      mockWindow(375, 667);
      const viewport = getViewportInfo();
      expect(shouldUseFluidSizing(viewport)).toBe(true);
    });

    it('should return true for very large screens', () => {
      mockWindow(2560, 1440);
      const viewport = getViewportInfo();
      expect(shouldUseFluidSizing(viewport)).toBe(true);
    });

    it('should return false for standard desktop', () => {
      mockWindow(1280, 720);
      const viewport = getViewportInfo();
      expect(shouldUseFluidSizing(viewport)).toBe(false);
    });
  });

  describe('calculateOptimalPadding', () => {
    it('should return correct padding for mobile', () => {
      mockWindow(375, 667);
      const viewport = getViewportInfo();
      const padding = calculateOptimalPadding(viewport);
      expect(padding).toBe(8);
    });

    it('should return correct padding for tablet', () => {
      mockWindow(700, 1024);
      const viewport = getViewportInfo();
      const padding = calculateOptimalPadding(viewport);
      expect(padding).toBe(16);
    });

    it('should return correct padding for desktop', () => {
      mockWindow(1280, 720);
      const viewport = getViewportInfo();
      const padding = calculateOptimalPadding(viewport);
      expect(padding).toBe(20);
    });
  });
});
