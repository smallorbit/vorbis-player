/**
 * Extracts dominant colors from album artwork using Canvas pixel analysis.
 * Results are LRU-cached (100 entries) and images are downscaled for performance.
 */
import { hasCache, getFromCache, addToCache } from './colorCache';
import type { ExtractedColor } from './colorCache';
export type { ExtractedColor } from './colorCache';

/** Pixel color data used during extraction. */
interface ColorData {
  r: number;
  g: number;
  b: number;
  count: number;
}

/** Converts RGB (0-255 each) to [hue 0-360, saturation 0-100, lightness 0-100]. */
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
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
}

/** Converts RGB (0-255 each) to a '#rrggbb' hex string. */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Returns true if lightness is in the 40-85% range (suitable for UI accent use). */
function isGoodContrast(r: number, g: number, b: number): boolean {
  const [, , lightness] = rgbToHsl(r, g, b);
  return lightness >= 40 && lightness <= 85;
}

/** Returns true if saturation is >= 50% (vibrant enough for accent use). */
function isVibrant(r: number, g: number, b: number): boolean {
  const [, saturation] = rgbToHsl(r, g, b);
  return saturation >= 50;
}

/**
 * Extracts the single most prominent vibrant color from an image URL.
 * Scores candidates by: pixel count x (saturation/100) x contrast-proximity-to-50% lightness.
 * Returns null if no sufficiently vibrant+contrasting color is found, or if image loading fails.
 */
export async function extractDominantColor(imageUrl: string): Promise<ExtractedColor | null> {
  if (hasCache(imageUrl)) {
    return getFromCache(imageUrl) ?? null;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (!ctx) {
            resolve(null);
            return;
          }

          const maxSize = 150;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          const colorMap = new Map<string, ColorData>();

          for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) continue;

            const rBucket = Math.floor(r / 8) * 8;
            const gBucket = Math.floor(g / 8) * 8;
            const bBucket = Math.floor(b / 8) * 8;

            const key = `${rBucket}-${gBucket}-${bBucket}`;

            if (colorMap.has(key)) {
              colorMap.get(key)!.count++;
            } else {
              colorMap.set(key, { r: rBucket, g: gBucket, b: bBucket, count: 1 });
            }
          }

          let bestColor: ColorData | null = null;
          let bestScore = 0;

          for (const color of colorMap.values()) {
            if (!isGoodContrast(color.r, color.g, color.b) || !isVibrant(color.r, color.g, color.b)) {
              continue;
            }

            const [, saturation, lightness] = rgbToHsl(color.r, color.g, color.b);
            const vibrancyScore = saturation / 100;
            const contrastScore = 1 - Math.abs(lightness - 50) / 50;
            const score = color.count * vibrancyScore * contrastScore;

            if (score > bestScore) {
              bestScore = score;
              bestColor = color;
            }
          }

          if (bestColor) {
            const hex = rgbToHex(bestColor.r, bestColor.g, bestColor.b);
            const rgb = `rgb(${bestColor.r}, ${bestColor.g}, ${bestColor.b})`;
            const [h, s, l] = rgbToHsl(bestColor.r, bestColor.g, bestColor.b);
            const hsl = `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;

            const result = { hex, rgb, hsl };
            addToCache(imageUrl, result);
            resolve(result);
          } else {
            addToCache(imageUrl, null);
            resolve(null);
          }
        } catch (error) {
          console.error('Error processing image data:', error);
          addToCache(imageUrl, null);
          resolve(null);
        }
      };

      img.onerror = () => {
        addToCache(imageUrl, null);
        resolve(null);
      };

      img.src = imageUrl;
    } catch (error) {
      console.error('Error loading image:', error);
      addToCache(imageUrl, null);
      resolve(null);
    }
  });
}

export function getTransparentVariant(color: string, opacity = 0.2): string {
  let r: number, g: number, b: number;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    r = parseInt(hex.substr(0, 2), 16);
    g = parseInt(hex.substr(2, 2), 16);
    b = parseInt(hex.substr(4, 2), 16);
  } else if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (!matches) return color;
    [r, g, b] = matches.map(Number);
  } else {
    return color;
  }

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export async function extractTopVibrantColors(imageUrl: string, count = 3): Promise<ExtractedColor[]> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (!ctx) {
            resolve([]);
            return;
          }

          const maxSize = 150;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          const colorMap = new Map<string, ColorData>();

          for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < 128) continue;
            const rBucket = Math.floor(r / 8) * 8;
            const gBucket = Math.floor(g / 8) * 8;
            const bBucket = Math.floor(b / 8) * 8;
            const key = `${rBucket}-${gBucket}-${bBucket}`;
            if (colorMap.has(key)) {
              colorMap.get(key)!.count++;
            } else {
              colorMap.set(key, { r: rBucket, g: gBucket, b: bBucket, count: 1 });
            }
          }

          const scoredColors: (ColorData & { score: number })[] = [];
          for (const color of colorMap.values()) {
            if (!isGoodContrast(color.r, color.g, color.b) || !isVibrant(color.r, color.g, color.b)) {
              continue;
            }
            const [, saturation, lightness] = rgbToHsl(color.r, color.g, color.b);
            const vibrancyScore = saturation / 100;
            const contrastScore = 1 - Math.abs(lightness - 50) / 50;
            const score = color.count * vibrancyScore * contrastScore;
            scoredColors.push({ ...color, score });
          }

          scoredColors.sort((a, b) => b.score - a.score);

          function isTooSimilar(c1: ColorData, c2: ColorData, threshold = 40) {
            const dr = c1.r - c2.r;
            const dg = c1.g - c2.g;
            const db = c1.b - c2.b;
            return Math.sqrt(dr * dr + dg * dg + db * db) < threshold;
          }

          const selected: ColorData[] = [];
          for (const color of scoredColors) {
            if (selected.every(sel => !isTooSimilar(sel, color))) {
              selected.push(color);
              if (selected.length >= count) break;
            }
          }

          const result: ExtractedColor[] = selected.map((color) => {
            const hex = rgbToHex(color.r, color.g, color.b);
            const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
            const [h, s, l] = rgbToHsl(color.r, color.g, color.b);
            const hsl = `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
            return { hex, rgb, hsl };
          });

          resolve(result);
        } catch (error) {
          console.error('Error processing image data:', error);
          resolve([]);
        }
      };

      img.onerror = () => {
        resolve([]);
      };

      img.src = imageUrl;
    } catch (error) {
      console.error('Error loading image:', error);
      resolve([]);
    }
  });
}
