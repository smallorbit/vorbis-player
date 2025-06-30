/**
 * Color extraction utility for album artwork
 * Extracts dominant colors from images using canvas analysis
 */

interface ColorData {
  r: number;
  g: number;
  b: number;
  count: number;
}

interface ExtractedColor {
  hex: string;
  rgb: string;
  hsl: string;
}

/**
 * Converts RGB values to HSL
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
 * Converts RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Determines if a color is too dark or too light for good contrast
 */
function isGoodContrast(r: number, g: number, b: number): boolean {
  const [, , lightness] = rgbToHsl(r, g, b);
  // Exclude colors that are too dark (<20%) or too light (>85%)
  return lightness >= 20 && lightness <= 85;
}

/**
 * Determines if a color is vibrant enough (has good saturation)
 */
function isVibrant(r: number, g: number, b: number): boolean {
  const [, saturation] = rgbToHsl(r, g, b);
  // Require minimum saturation of 30%
  return saturation >= 30;
}

/**
 * Extracts the dominant color from an image URL
 */
export async function extractDominantColor(imageUrl: string): Promise<ExtractedColor | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Create canvas and draw image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve(null);
            return;
          }

          // Scale down image for faster processing
          const maxSize = 150;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Count colors (sample every 4th pixel for performance)
          const colorMap = new Map<string, ColorData>();
          
          for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel (i += 16 because each pixel is 4 values)
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // Skip transparent pixels
            if (a < 128) continue;
            
            // Group similar colors together (reduce precision)
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
          
          // Find the most common vibrant color
          let bestColor: ColorData | null = null;
          let bestScore = 0;
          
          for (const color of colorMap.values()) {
            // Skip colors that are too dark, light, or not vibrant
            if (!isGoodContrast(color.r, color.g, color.b) || !isVibrant(color.r, color.g, color.b)) {
              continue;
            }
            
            // Score based on frequency and vibrancy
            const [, saturation, lightness] = rgbToHsl(color.r, color.g, color.b);
            const vibrancyScore = saturation / 100;
            const contrastScore = 1 - Math.abs(lightness - 50) / 50; // Prefer colors closer to 50% lightness
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
            
            resolve({ hex, rgb, hsl });
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('Error processing image data:', error);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        resolve(null);
      };
      
      // Handle CORS issues by trying different approaches
      img.src = imageUrl;
    } catch (error) {
      console.error('Error loading image:', error);
      resolve(null);
    }
  });
}

/**
 * Gets a lighter variant of a color for hover states
 */
export function getLighterVariant(color: string, amount = 0.2): string {
  // Convert hex to RGB if needed
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
  
  // Increase brightness
  r = Math.min(255, Math.floor(r + (255 - r) * amount));
  g = Math.min(255, Math.floor(g + (255 - g) * amount));
  b = Math.min(255, Math.floor(b + (255 - b) * amount));
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Gets a semi-transparent variant of a color for backgrounds
 */
export function getTransparentVariant(color: string, opacity = 0.2): string {
  // Convert hex to RGB if needed
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