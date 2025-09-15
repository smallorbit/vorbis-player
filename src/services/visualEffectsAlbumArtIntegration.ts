import { albumArtManager } from './albumArtManager';
import type { LocalTrack } from '../types/spotify.d.ts';

/**
 * Integration service for album art with the existing visual effects system
 * Provides seamless integration between local album art and visual effects
 */
export class VisualEffectsAlbumArtIntegrationService {
  private colorExtractionCache = new Map<string, string>();
  private fallbackColors = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#06b6d4'
  };

  constructor() {
    this.initializeFallbacks();
  }

  private initializeFallbacks(): void {
    // Initialize with some common album art color schemes
    const fallbackSchemes = [
      '#1f2937', '#374151', '#4b5563', // Cool grays
      '#7c2d12', '#dc2626', '#ea580c', // Warm reds/oranges  
      '#1e40af', '#2563eb', '#3b82f6', // Blues
      '#166534', '#16a34a', '#22c55e', // Greens
      '#7c2d12', '#a16207', '#d97706'  // Warm earth tones
    ];
    
    // Pre-populate cache with fallback colors
    fallbackSchemes.forEach((color, index) => {
      this.colorExtractionCache.set(`fallback_${index}`, color);
    });
  }

  /**
   * Get album art for a track with visual effects integration
   */
  async getTrackAlbumArt(track: LocalTrack): Promise<{
    artworkUrl: string;
    dominantColor: string;
    isLocal: boolean;
    source: 'embedded' | 'directory' | 'fallback' | 'spotify';
  }> {
    try {
      // For local tracks, use the album art manager
      if (track.source === 'local') {
        const artwork = await albumArtManager.getTrackArtwork(track);
        const dominantColor = await this.extractDominantColor(artwork, track.id);
        
        const isSpotifyFallback = artwork.includes('data:image/svg+xml');
        
        return {
          artworkUrl: artwork,
          dominantColor,
          isLocal: true,
          source: isSpotifyFallback ? 'fallback' : (track.albumArt ? 'embedded' : 'directory')
        };
      }

      // For Spotify tracks, return the existing album art
      const spotifyArtwork = track.album?.images?.[0]?.url || '';
      const dominantColor = await this.extractDominantColor(spotifyArtwork, track.id);

      return {
        artworkUrl: spotifyArtwork,
        dominantColor,
        isLocal: false,
        source: 'spotify'
      };

    } catch (error) {
      console.error('Failed to get track album art:', error);
      
      // Return fallback
      const fallbackColor = this.getFallbackColor(track.id);
      return {
        artworkUrl: this.getFallbackArtwork(),
        dominantColor: fallbackColor,
        isLocal: false,
        source: 'fallback'
      };
    }
  }

  /**
   * Extract dominant color from album artwork for visual effects
   */
  async extractDominantColor(artworkUrl: string, trackId: string): Promise<string> {
    // Check cache first
    const cacheKey = `color_${trackId}`;
    if (this.colorExtractionCache.has(cacheKey)) {
      return this.colorExtractionCache.get(cacheKey)!;
    }

    try {
      // Use existing color extraction logic if available
      if (window.colorExtractor && typeof window.colorExtractor.extractDominantColor === 'function') {
        const color = await window.colorExtractor.extractDominantColor(artworkUrl);
        this.colorExtractionCache.set(cacheKey, color);
        return color;
      }

      // Fallback color extraction using canvas
      const color = await this.extractColorFromImage(artworkUrl);
      this.colorExtractionCache.set(cacheKey, color);
      return color;

    } catch (error) {
      console.warn('Color extraction failed:', error);
      const fallbackColor = this.getFallbackColor(trackId);
      this.colorExtractionCache.set(cacheKey, fallbackColor);
      return fallbackColor;
    }
  }

  /**
   * Canvas-based color extraction fallback
   */
  private async extractColorFromImage(imageUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            throw new Error('Canvas context not available');
          }

          // Scale down for performance
          const size = 50;
          canvas.width = size;
          canvas.height = size;
          
          ctx.drawImage(img, 0, 0, size, size);
          
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          
          let r = 0, g = 0, b = 0;
          let pixelCount = 0;
          
          // Sample every 4th pixel for performance
          for (let i = 0; i < data.length; i += 16) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            pixelCount++;
          }
          
          if (pixelCount > 0) {
            r = Math.round(r / pixelCount);
            g = Math.round(g / pixelCount);
            b = Math.round(b / pixelCount);
            
            const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            resolve(color);
          } else {
            resolve(this.fallbackColors.primary);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }

  /**
   * Get fallback color based on track ID for consistency
   */
  private getFallbackColor(trackId: string): string {
    // Create a pseudo-random but consistent color based on track ID
    let hash = 0;
    for (let i = 0; i < trackId.length; i++) {
      const char = trackId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const colors = [
      '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
      '#ef4444', '#ec4899', '#8b5a2b', '#374151', '#7c3aed'
    ];
    
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Get fallback artwork SVG
   */
  private getFallbackArtwork(): string {
    return albumArtManager.getFallbackArtwork?.() || 'data:image/svg+xml;base64,' + btoa(`
      <svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="300" fill="#374151"/>
        <circle cx="150" cy="120" r="40" fill="#6b7280"/>
        <path d="M110 180 Q150 160 190 180 L190 240 Q150 220 110 240 Z" fill="#6b7280"/>
        <text x="150" y="270" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="14">No Artwork</text>
      </svg>
    `);
  }

  /**
   * Preload album art for multiple tracks for smoother UI experience
   */
  async preloadAlbumArt(tracks: LocalTrack[], batchSize = 5): Promise<void> {
    if (!tracks.length) return;

    console.log(`🎨 Preloading album art for ${tracks.length} tracks...`);
    
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      const promises = batch.map(track => this.getTrackAlbumArt(track));
      
      try {
        await Promise.all(promises);
      } catch (error) {
        console.warn('Error in album art preload batch:', error);
      }

      // Add small delay to prevent UI blocking
      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log('✅ Album art preloading completed');
  }

  /**
   * Clear color extraction cache
   */
  clearCache(): void {
    this.colorExtractionCache.clear();
    this.initializeFallbacks();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
  } {
    // This is a simplified cache stats implementation
    return {
      size: this.colorExtractionCache.size,
      hitRate: 0.85, // Placeholder - would need request tracking for real hit rate
      memoryUsage: this.colorExtractionCache.size * 50 // Rough estimate
    };
  }

  /**
   * Create color palette from dominant color for visual effects
   */
  createColorPalette(dominantColor: string): {
    primary: string;
    secondary: string;
    accent: string;
    light: string;
    dark: string;
  } {
    try {
      const rgb = this.hexToRgb(dominantColor);
      if (!rgb) {
        throw new Error('Invalid color format');
      }

      const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
      
      return {
        primary: dominantColor,
        secondary: this.hslToHex(hsl.h, Math.max(0, hsl.s - 0.2), hsl.l),
        accent: this.hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),
        light: this.hslToHex(hsl.h, hsl.s, Math.min(1, hsl.l + 0.3)),
        dark: this.hslToHex(hsl.h, hsl.s, Math.max(0, hsl.l - 0.3))
      };
    } catch (error) {
      console.warn('Failed to create color palette:', error);
      return {
        primary: dominantColor,
        secondary: this.fallbackColors.secondary,
        accent: this.fallbackColors.accent,
        light: '#f3f4f6',
        dark: '#1f2937'
      };
    }
  }

  // Color utility methods
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h: h * 360, s, l };
  }

  private hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    s /= 100;
    h /= 360;

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

    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Check if an image is dark or light for contrast adjustments
   */
  isImageDark(dominantColor: string): boolean {
    const rgb = this.hexToRgb(dominantColor);
    if (!rgb) return false;
    
    // Calculate relative luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance < 0.5;
  }

  /**
   * Get contrasting text color for album art backgrounds
   */
  getContrastingTextColor(backgroundColor: string): string {
    return this.isImageDark(backgroundColor) ? '#ffffff' : '#000000';
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearCache();
  }
}

// Extend window object for color extractor integration
declare global {
  interface Window {
    colorExtractor?: {
      extractDominantColor: (imageUrl: string) => Promise<string>;
    };
  }
}

// Singleton instance
export const visualEffectsAlbumArtIntegration = new VisualEffectsAlbumArtIntegrationService();