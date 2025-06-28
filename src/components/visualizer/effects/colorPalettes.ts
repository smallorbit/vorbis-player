import { Color } from 'three';

// Color lookup table for gradients
export class ColorLUT {
  private colors: Color[];
  
  constructor(colors: Color[] = []) {
    this.colors = colors.length > 0 ? colors : [
      new Color(0x00ff00), // Green
      new Color(0xffff00), // Yellow  
      new Color(0xff8000), // Orange
      new Color(0xff0000), // Red
      new Color(0xff0080), // Pink
      new Color(0x8000ff), // Purple
      new Color(0x0080ff), // Blue
      new Color(0x00ffff), // Cyan
    ];
  }

  getColor(t: number): Color {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));
    
    if (this.colors.length === 1) {
      return this.colors[0].clone();
    }
    
    // Scale t to the color array
    const scaledT = t * (this.colors.length - 1);
    const index = Math.floor(scaledT);
    const fraction = scaledT - index;
    
    if (index >= this.colors.length - 1) {
      return this.colors[this.colors.length - 1].clone();
    }
    
    // Interpolate between two colors
    const color1 = this.colors[index];
    const color2 = this.colors[index + 1];
    
    return new Color().lerpColors(color1, color2, fraction);
  }
}

// Palette definitions
export type PaletteType = 'rainbow' | 'fire' | 'ocean' | 'monochrome';

export class ColorPalette {
  static getPalette(type: PaletteType = 'rainbow') {
    switch (type) {
      case 'fire':
        return new ColorPalette([
          new Color(0x000000), // Black
          new Color(0x8B0000), // Dark Red
          new Color(0xFF0000), // Red
          new Color(0xFF8C00), // Dark Orange
          new Color(0xFFD700), // Gold
          new Color(0xFFFFFF), // White
        ]);
        
      case 'ocean':
        return new ColorPalette([
          new Color(0x000080), // Navy
          new Color(0x0000FF), // Blue
          new Color(0x00BFFF), // Deep Sky Blue
          new Color(0x00FFFF), // Cyan
          new Color(0x40E0D0), // Turquoise
          new Color(0xF0FFFF), // Azure
        ]);
        
      case 'monochrome':
        return new ColorPalette([
          new Color(0x000000), // Black
          new Color(0x808080), // Gray
          new Color(0xFFFFFF), // White
        ]);
        
      case 'rainbow':
      default:
        return new ColorPalette([
          new Color(0xFF0000), // Red
          new Color(0xFF8000), // Orange
          new Color(0xFFFF00), // Yellow
          new Color(0x00FF00), // Green
          new Color(0x00FFFF), // Cyan
          new Color(0x0080FF), // Blue
          new Color(0x8000FF), // Purple
          new Color(0xFF0080), // Pink
        ]);
    }
  }

  constructor(private colors: Color[]) {}

  buildLut(): ColorLUT {
    return new ColorLUT(this.colors);
  }
}

// App state hook for palette selection
export function usePalette(): PaletteType {
  // For now, return a default palette
  // This can be connected to app state later
  return 'rainbow';
}