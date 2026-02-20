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


