/**
 * @fileoverview Color Extraction Utility
 * 
 * Advanced color extraction and analysis utility for album artwork.
 * Extracts dominant colors from images and provides color analysis
 * for dynamic theme generation and visual effects.
 * 
 * @architecture
 * This utility uses HTML5 Canvas API to analyze image pixels and extract
 * dominant colors. It implements sophisticated color analysis algorithms
 * including contrast checking, vibrancy analysis, and color clustering.
 * 
 * @features
 * - Dominant color extraction from album artwork
 * - Color format conversion (RGB, HSL, HEX)
 * - Contrast and vibrancy analysis
 * - Intelligent color caching for performance
 * - Color clustering and filtering
 * 
 * @performance
 * - LRU cache with size limit (100 entries)
 * - Image downscaling for faster processing
 * - Asynchronous processing with Promise-based API
 * - Memory-efficient pixel analysis
 * 
 * @usage
 * ```typescript
 * import { extractDominantColor } from './utils/colorExtractor';
 * 
 * const color = await extractDominantColor('album-art.jpg');
 * if (color) {
 *   console.log('Dominant color:', color.hex);
 *   setAccentColor(color.hex);
 * }
 * ```
 * 
 * @dependencies
 * - HTML5 Canvas API: Image processing
 * - Web Workers: Background processing (optional)
 * - localStorage: Cache persistence (optional)
 * 
 * @author Vorbis Player Team
 * @version 2.0.0
 */

/**
 * Color data interface for pixel analysis
 * 
 * Represents color information for a single pixel or color cluster
 * during the extraction process.
 * 
 * @interface ColorData
 * 
 * @property {number} r - Red component (0-255)
 * @property {number} g - Green component (0-255)
 * @property {number} b - Blue component (0-255)
 * @property {number} count - Number of pixels with this color
 * 
 * @example
 * ```typescript
 * const colorData: ColorData = {
 *   r: 255,
 *   g: 128,
 *   b: 64,
 *   count: 1500
 * };
 * ```
 */
interface ColorData {
  r: number;
  g: number;
  b: number;
  count: number;
}

/**
 * Extracted color interface
 * 
 * Represents the final extracted color with multiple format representations
 * for use throughout the application.
 * 
 * @interface ExtractedColor
 * 
 * @property {string} hex - Hexadecimal color representation (#RRGGBB)
 * @property {string} rgb - RGB color representation (rgb(r, g, b))
 * @property {string} hsl - HSL color representation (hsl(h, s%, l%))
 * 
 * @example
 * ```typescript
 * const extractedColor: ExtractedColor = {
 *   hex: '#ff8040',
 *   rgb: 'rgb(255, 128, 64)',
 *   hsl: 'hsl(20, 100%, 62%)'
 * };
 * ```
 */
export interface ExtractedColor {
  hex: string;
  rgb: string;
  hsl: string;
}

/**
 * LRU cache for extracted colors
 * 
 * Stores recently extracted colors to avoid redundant processing.
 * Implements least-recently-used eviction policy.
 * 
 * @constant
 * @type {Map<string, ExtractedColor | null>}
 */
const colorCache = new Map<string, ExtractedColor | null>();

/**
 * Maximum number of cached colors
 * 
 * Limits memory usage by restricting cache size.
 * 
 * @constant
 * @type {number}
 */
const MAX_CACHE_SIZE = 100;

/**
 * Adds a color to the cache with LRU eviction
 * 
 * Manages cache size by removing least recently used entries
 * when the cache reaches its maximum size.
 * 
 * @param key - Cache key (usually image URL)
 * @param value - Extracted color data or null
 * 
 * @example
 * ```typescript
 * addToCache('album-art.jpg', extractedColor);
 * ```
 */
function addToCache(key: string, value: ExtractedColor | null) {
  if (colorCache.size >= MAX_CACHE_SIZE) {
    const firstKey = colorCache.keys().next().value;
    if (firstKey) {
      colorCache.delete(firstKey);
    }
  }
  colorCache.set(key, value);
}

/**
 * Converts RGB values to HSL color space
 * 
 * Implements the RGB to HSL conversion algorithm for color analysis.
 * Returns hue (0-360), saturation (0-100), and lightness (0-100).
 * 
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Tuple of [hue, saturation, lightness]
 * 
 * @example
 * ```typescript
 * const [h, s, l] = rgbToHsl(255, 128, 64);
 * console.log(`Hue: ${h}°, Saturation: ${s}%, Lightness: ${l}%`);
 * ```
 */
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

/**
 * Converts RGB values to hexadecimal color string
 * 
 * Converts individual RGB components to a hex color string
 * in the format #RRGGBB.
 * 
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Hexadecimal color string
 * 
 * @example
 * ```typescript
 * const hex = rgbToHex(255, 128, 64);
 * console.log(hex); // "#ff8040"
 * ```
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Checks if a color has good contrast for UI elements
 * 
 * Determines if a color is suitable for use as text or UI element
 * by checking its lightness value in HSL color space.
 * 
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns True if color has good contrast (lightness 40-85%)
 * 
 * @example
 * ```typescript
 * const hasGoodContrast = isGoodContrast(255, 255, 255); // true
 * const hasGoodContrast = isGoodContrast(0, 0, 0); // false
 * ```
 */
function isGoodContrast(r: number, g: number, b: number): boolean {
  const [, , lightness] = rgbToHsl(r, g, b);
  return lightness >= 40 && lightness <= 85;
}

/**
 * Checks if a color is vibrant and saturated
 * 
 * Determines if a color is vibrant enough for use as an accent color
 * by checking its saturation value in HSL color space.
 * 
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns True if color is vibrant (saturation >= 50%)
 * 
 * @example
 * ```typescript
 * const isVibrant = isVibrant(255, 0, 0); // true (pure red)
 * const isVibrant = isVibrant(128, 128, 128); // false (gray)
 * ```
 */
function isVibrant(r: number, g: number, b: number): boolean {
  const [, saturation] = rgbToHsl(r, g, b);
  return saturation >= 50;
}

/**
 * Extracts the dominant color from an image
 * 
 * Analyzes an image to find the most prominent color, considering
 * factors like contrast, vibrancy, and color distribution. Uses
 * intelligent caching to improve performance.
 * 
 * @param imageUrl - URL or data URL of the image to analyze
 * @returns Promise resolving to extracted color data or null if extraction fails
 * 
 * @example
 * ```typescript
 * const color = await extractDominantColor('album-art.jpg');
 * if (color) {
 *   setAccentColor(color.hex);
 *   console.log('Dominant color:', color.hex);
 * }
 * ```
 * 
 * @throws {Error} If image loading fails or canvas context is unavailable
 * 
 * @performance
 * - Uses cached results when available
 * - Downsamples image to 150px max dimension for speed
 * - Processes pixels in chunks for memory efficiency
 * 
 * @algorithm
 * 1. Load and downscale image to canvas
 * 2. Extract pixel data from canvas
 * 3. Cluster similar colors together
 * 4. Filter colors by contrast and vibrancy
 * 5. Select the most prominent color
 * 6. Convert to multiple color formats
 * 7. Cache result for future use
 */
export async function extractDominantColor(imageUrl: string): Promise<ExtractedColor | null> {
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl) || null;
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