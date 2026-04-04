export interface ExtractedColor {
  hex: string;
  rgb: string;
  hsl: string;
}

const colorCache = new Map<string, ExtractedColor | null>();

const MAX_CACHE_SIZE = 100;

export function hasCache(key: string): boolean {
  return colorCache.has(key);
}

export function getFromCache(key: string): ExtractedColor | null | undefined {
  return colorCache.get(key);
}

export function addToCache(key: string, value: ExtractedColor | null): void {
  if (colorCache.size >= MAX_CACHE_SIZE) {
    const firstKey = colorCache.keys().next().value;
    if (firstKey) {
      colorCache.delete(firstKey);
    }
  }
  colorCache.set(key, value);
}
