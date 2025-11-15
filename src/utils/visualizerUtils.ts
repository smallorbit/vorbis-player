/**
 * @fileoverview Visualizer Color Utilities
 * 
 * Utility functions for color manipulation in visualizer components.
 * Provides functions for generating color variants, adjusting brightness,
 * and converting between color formats.
 */

/**
 * Convert hex color to RGB object
 * 
 * @param hex - Hex color string (e.g., '#FF5733' or 'FF5733')
 * @returns RGB object or null if invalid
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB values to hex color string
 * 
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string (e.g., '#FF5733')
 */
function rgbToHex(r: number, g: number, b: number): string {
  // Ensure values are integers and clamped to valid range
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const toHex = (value: number) => {
    const hex = clamp(value).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a color variant from a base color
 * 
 * Creates a variation of the base color by adjusting brightness.
 * Useful for creating color palettes from accent colors.
 * 
 * @param baseColor - Base hex color string
 * @param variation - Variation amount (0-1). 0 = darker, 1 = lighter
 * @returns Variant hex color string
 * 
 * @example
 * ```typescript
 * generateColorVariant('#FF5733', 0.3) // Returns darker variant
 * generateColorVariant('#FF5733', 0.7) // Returns lighter variant
 * ```
 */
export function generateColorVariant(baseColor: string, variation: number): string {
  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;
  
  // Adjust brightness based on variation
  // variation 0 = 50% brightness, variation 1 = 100% brightness
  const brightness = 0.5 + variation * 0.5;
  const r = Math.round(rgb.r * brightness);
  const g = Math.round(rgb.g * brightness);
  const b = Math.round(rgb.b * brightness);
  
  return rgbToHex(r, g, b);
}

/**
 * Adjust color brightness
 * 
 * Increases or decreases the brightness of a color.
 * 
 * @param color - Hex color string
 * @param amount - Brightness adjustment (-1 to 1). Negative = darker, Positive = lighter
 * @returns Adjusted hex color string
 * 
 * @example
 * ```typescript
 * adjustColorBrightness('#FF5733', 0.2)  // Makes color 20% brighter
 * adjustColorBrightness('#FF5733', -0.3) // Makes color 30% darker
 * ```
 */
export function adjustColorBrightness(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  
  const r = Math.max(0, Math.min(255, rgb.r + amount * 255));
  const g = Math.max(0, Math.min(255, rgb.g + amount * 255));
  const b = Math.max(0, Math.min(255, rgb.b + amount * 255));
  
  return rgbToHex(r, g, b);
}

/**
 * Convert RGB to HSL
 * 
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns HSL object
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 * 
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns RGB object
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Generate complementary color
 * 
 * Creates a complementary color by rotating hue 180 degrees.
 * 
 * @param color - Base hex color string
 * @returns Complementary hex color string
 */
export function generateComplementaryColor(color: string): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.h = (hsl.h + 180) % 360;
  
  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

