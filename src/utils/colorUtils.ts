export const hexToRgb = (hex: string): [number, number, number] => {
  const cleanHex = hex.replace('#', '');
  return [
    parseInt(cleanHex.substring(0, 2), 16),
    parseInt(cleanHex.substring(2, 4), 16),
    parseInt(cleanHex.substring(4, 6), 16)
  ];
};

/**
 * Calculate relative luminance of a color according to WCAG standards
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
export const getRelativeLuminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex);
  
  // Convert to 0-1 range
  const [rs, gs, bs] = [r, g, b].map(c => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * Determine if a color is light or dark based on its luminance
 * Returns true if the color is light (needs dark text)
 */
export const isLightColor = (hex: string): boolean => {
  const luminance = getRelativeLuminance(hex);
  return luminance > 0.5; // Threshold for determining light vs dark
};

/**
 * Get the appropriate text/icon color for a given background color
 * Returns dark color for light backgrounds, light color for dark backgrounds
 */
export const getContrastColor = (backgroundColor: string, darkColor = '#1a1a1a', lightColor = '#ffffff'): string => {
  return isLightColor(backgroundColor) ? darkColor : lightColor;
};