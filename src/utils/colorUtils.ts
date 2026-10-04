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
  const linearize = (c: number): number => {
    const val = c / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  };
  const rs = linearize(r);
  const gs = linearize(g);
  const bs = linearize(b);

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * WCAG 2.x contrast ratio between two colors, from 1 (identical) to 21 (black on white)
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export const getContrastRatio = (a: string, b: string): number => {
  const la = getRelativeLuminance(a);
  const lb = getRelativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const WCAG_AA_NORMAL_TEXT = 4.5;

const pickHigherContrast = (backgroundColor: string, a: string, b: string): string =>
  getContrastRatio(backgroundColor, a) >= getContrastRatio(backgroundColor, b) ? a : b;

/**
 * Pick whichever foreground candidate has the higher WCAG contrast ratio against the background.
 * If neither candidate reaches AA (4.5:1), fall back to pure black or white — one of the two
 * always clears 4.5:1 for any background.
 */
export const getContrastColor = (backgroundColor: string, darkColor = '#1a1a1a', lightColor = '#ffffff'): string => {
  const preferred = pickHigherContrast(backgroundColor, darkColor, lightColor);
  if (getContrastRatio(backgroundColor, preferred) >= WCAG_AA_NORMAL_TEXT) return preferred;
  return pickHigherContrast(backgroundColor, '#000000', '#ffffff');
};
