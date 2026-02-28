/**
 * @interface AlbumFilters
 *
 * Defines the image filter properties applied to album artwork.
 *
 * @property {number} brightness - Brightness adjustment (0-200, 100 = normal)
 * @property {number} contrast - Contrast adjustment (0-200, 100 = normal)
 * @property {number} saturation - Saturation adjustment (0-200, 100 = normal)
 * @property {number} sepia - Sepia effect intensity (0-100)
 *
 * @example
 * ```typescript
 * const filters: AlbumFilters = {
 *   brightness: 110,  // 10% brighter
 *   contrast: 120,    // 20% more contrast
 *   saturation: 90,   // 10% less saturation
 *   sepia: 30         // 30% sepia effect
 * };
 * ```
 */
export interface AlbumFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
}

/**
 * Default album filter values (no effects applied)
 */
export const DEFAULT_ALBUM_FILTERS: AlbumFilters = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sepia: 0,
};
