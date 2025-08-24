import type { AlbumArtwork, LocalTrack } from '../types/spotify.d.ts';
import { enhancedLocalLibraryDatabase } from './enhancedLocalLibraryDatabase';

export interface ArtworkProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  format?: 'jpeg' | 'png' | 'webp';
}

export interface DirectoryArtworkFile {
  filePath: string;
  filename: string;
  priority: number; // Higher priority files are preferred
}

export class AlbumArtManagerService {
  private readonly artworkCache = new Map<string, string>();
  private readonly directoryArtworkPatterns = [
    { pattern: /^cover\.(jpg|jpeg|png|webp)$/i, priority: 100 },
    { pattern: /^folder\.(jpg|jpeg|png|webp)$/i, priority: 90 },
    { pattern: /^front\.(jpg|jpeg|png|webp)$/i, priority: 80 },
    { pattern: /^albumart\.(jpg|jpeg|png|webp)$/i, priority: 70 },
    { pattern: /^albumartsmall\.(jpg|jpeg|png|webp)$/i, priority: 60 },
    { pattern: /^thumb\.(jpg|jpeg|png|webp)$/i, priority: 50 },
    { pattern: /^.*\.(jpg|jpeg|png|webp)$/i, priority: 10 } // Any image file as fallback
  ];

  private readonly fallbackArtworkSvg = `
    <svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
      <rect width="300" height="300" fill="#2d3748"/>
      <circle cx="150" cy="120" r="40" fill="#4a5568"/>
      <path d="M110 180 Q150 160 190 180 L190 240 Q150 220 110 240 Z" fill="#4a5568"/>
      <text x="150" y="270" text-anchor="middle" fill="#718096" font-family="Arial" font-size="14">No Artwork</text>
    </svg>
  `;

  constructor() {
    this.initializeFallbackArtwork();
  }

  private initializeFallbackArtwork(): void {
    // Create base64 encoded fallback artwork
    const fallbackBase64 = btoa(this.fallbackArtworkSvg);
    this.artworkCache.set('fallback', `data:image/svg+xml;base64,${fallbackBase64}`);
  }

  /**
   * Extract artwork from audio file metadata
   */
  async extractEmbeddedArtwork(
    filePath: string, 
    track: LocalTrack,
    options: ArtworkProcessingOptions = {}
  ): Promise<AlbumArtwork | null> {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      // Read file buffer for metadata extraction
      const buffer = await window.electronAPI.readFileBuffer(filePath);
      
      // Extract metadata using music-metadata
      const { parseBuffer } = await import('music-metadata');
      const metadata = await parseBuffer(buffer, {
        skipCovers: false,
        includeChapters: false
      });

      if (!metadata.common.picture || metadata.common.picture.length === 0) {
        return null;
      }

      const picture = metadata.common.picture[0];
      let artworkData = picture.data;
      let format = picture.format;

      // Process image if options are provided
      if (options.maxWidth || options.maxHeight || options.quality || options.format) {
        const processedArtwork = await this.processImage(
          artworkData, 
          picture.format, 
          options
        );
        if (processedArtwork) {
          artworkData = processedArtwork.data;
          format = processedArtwork.format;
        }
      }

      // Get image dimensions
      const dimensions = await this.getImageDimensions(artworkData, format);

      const artwork: AlbumArtwork = {
        id: `embedded_${track.id}_${Date.now()}`,
        track_id: track.id,
        album_id: this.generateAlbumId(track.album, track.artist),
        data: `data:${format};base64,${artworkData.toString('base64')}`,
        format,
        width: dimensions.width,
        height: dimensions.height,
        file_size: artworkData.length,
        source: 'embedded',
        date_added: new Date().toISOString()
      };

      // Save to database
      await enhancedLocalLibraryDatabase.saveAlbumArtwork(artwork);

      // Cache the artwork
      this.artworkCache.set(track.id, artwork.data);

      return artwork;

    } catch (error) {
      console.error(`Failed to extract embedded artwork from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Scan directory for artwork files
   */
  async scanDirectoryForArtwork(
    directoryPath: string,
    albumName: string,
    artistName: string
  ): Promise<AlbumArtwork | null> {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      const files = await window.electronAPI.getDirectoryFiles(directoryPath);
      const artworkFiles = this.findDirectoryArtworkFiles(files);

      if (artworkFiles.length === 0) {
        return null;
      }

      // Use the highest priority artwork file
      const bestArtwork = artworkFiles[0];
      const fullPath = await window.electronAPI.joinPath(directoryPath, bestArtwork.filename);

      // Read the image file
      const imageBuffer = await window.electronAPI.readFileBuffer(fullPath);
      const format = this.getImageFormatFromExtension(bestArtwork.filename);

      // Get image dimensions
      const dimensions = await this.getImageDimensions(imageBuffer, format);

      const artwork: AlbumArtwork = {
        id: `directory_${this.generateAlbumId(albumName, artistName)}_${Date.now()}`,
        album_id: this.generateAlbumId(albumName, artistName),
        data: `data:${format};base64,${imageBuffer.toString('base64')}`,
        format,
        width: dimensions.width,
        height: dimensions.height,
        file_size: imageBuffer.length,
        source: 'directory',
        file_path: fullPath,
        date_added: new Date().toISOString()
      };

      // Save to database
      await enhancedLocalLibraryDatabase.saveAlbumArtwork(artwork);

      return artwork;

    } catch (error) {
      console.error(`Failed to scan directory for artwork: ${directoryPath}`, error);
      return null;
    }
  }

  /**
   * Process and optimize image
   */
  private async processImage(
    imageData: Buffer,
    originalFormat: string,
    options: ArtworkProcessingOptions
  ): Promise<{ data: Buffer; format: string } | null> {
    try {
      // Use sharp for image processing if available
      if (window.electronAPI && window.electronAPI.processImage) {
        return await window.electronAPI.processImage(imageData, {
          width: options.maxWidth,
          height: options.maxHeight,
          quality: options.quality,
          format: options.format || this.getOptimalFormat(originalFormat)
        });
      }

      // Fallback: return original image
      return { data: imageData, format: originalFormat };

    } catch (error) {
      console.error('Image processing failed:', error);
      return null;
    }
  }

  /**
   * Get image dimensions using canvas or electron
   */
  private async getImageDimensions(
    imageData: Buffer,
    format: string
  ): Promise<{ width: number; height: number }> {
    try {
      if (window.electronAPI && window.electronAPI.getImageDimensions) {
        return await window.electronAPI.getImageDimensions(imageData);
      }

      // Fallback: use canvas in renderer process
      return new Promise((resolve, reject) => {
        const img = new Image();
        const blob = new Blob([imageData], { type: format });
        const url = URL.createObjectURL(blob);

        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image for dimension detection'));
        };

        img.src = url;
      });

    } catch (error) {
      console.warn('Failed to get image dimensions, using defaults:', error);
      return { width: 300, height: 300 };
    }
  }

  /**
   * Find artwork files in directory listing
   */
  private findDirectoryArtworkFiles(files: string[]): DirectoryArtworkFile[] {
    const artworkFiles: DirectoryArtworkFile[] = [];

    for (const filename of files) {
      for (const { pattern, priority } of this.directoryArtworkPatterns) {
        if (pattern.test(filename)) {
          artworkFiles.push({
            filePath: '', // Will be set by caller
            filename,
            priority
          });
          break; // Only match the first pattern
        }
      }
    }

    // Sort by priority (highest first) and then by filename
    return artworkFiles.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.filename.localeCompare(b.filename);
    });
  }

  /**
   * Get artwork for a track (with caching)
   */
  async getTrackArtwork(track: LocalTrack): Promise<string> {
    try {
      // Check cache first
      const cacheKey = track.id;
      if (this.artworkCache.has(cacheKey)) {
        return this.artworkCache.get(cacheKey)!;
      }

      // Check database
      const dbArtwork = await enhancedLocalLibraryDatabase.getAlbumArtworkByTrack(track.id);
      if (dbArtwork) {
        this.artworkCache.set(cacheKey, dbArtwork.data);
        return dbArtwork.data;
      }

      // Check if track already has embedded artwork in metadata
      if (track.albumArt) {
        this.artworkCache.set(cacheKey, track.albumArt);
        return track.albumArt;
      }

      // Try to extract embedded artwork
      const embeddedArtwork = await this.extractEmbeddedArtwork(track.filePath, track);
      if (embeddedArtwork) {
        this.artworkCache.set(cacheKey, embeddedArtwork.data);
        return embeddedArtwork.data;
      }

      // Try to find directory artwork
      const directoryPath = await window.electronAPI?.dirname(track.filePath);
      if (directoryPath) {
        const directoryArtwork = await this.scanDirectoryForArtwork(
          directoryPath,
          track.album,
          track.artist
        );
        if (directoryArtwork) {
          this.artworkCache.set(cacheKey, directoryArtwork.data);
          return directoryArtwork.data;
        }
      }

      // Return fallback artwork
      const fallback = this.artworkCache.get('fallback')!;
      this.artworkCache.set(cacheKey, fallback);
      return fallback;

    } catch (error) {
      console.error(`Failed to get artwork for track ${track.id}:`, error);
      return this.artworkCache.get('fallback')!;
    }
  }

  /**
   * Get artwork for an album
   */
  async getAlbumArtwork(albumId: string, albumName?: string, artistName?: string): Promise<string> {
    try {
      // Check cache first
      const cacheKey = `album_${albumId}`;
      if (this.artworkCache.has(cacheKey)) {
        return this.artworkCache.get(cacheKey)!;
      }

      // Check database
      const dbArtwork = await enhancedLocalLibraryDatabase.getAlbumArtworkByAlbum(albumId);
      if (dbArtwork) {
        this.artworkCache.set(cacheKey, dbArtwork.data);
        return dbArtwork.data;
      }

      // If we have album/artist names, try to find directory artwork
      if (albumName && artistName) {
        // This would require additional logic to find a representative directory
        // For now, return fallback
      }

      // Return fallback artwork
      const fallback = this.artworkCache.get('fallback')!;
      this.artworkCache.set(cacheKey, fallback);
      return fallback;

    } catch (error) {
      console.error(`Failed to get artwork for album ${albumId}:`, error);
      return this.artworkCache.get('fallback')!;
    }
  }

  /**
   * Preload artwork for multiple tracks
   */
  async preloadArtwork(tracks: LocalTrack[]): Promise<void> {
    const batchSize = 5; // Process 5 tracks at a time to avoid overwhelming the system
    
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      const promises = batch.map(track => this.getTrackArtwork(track));
      
      try {
        await Promise.all(promises);
      } catch (error) {
        console.warn('Error in artwork preloading batch:', error);
      }

      // Add a small delay between batches to prevent UI blocking
      if (i + batchSize < tracks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Clear artwork cache
   */
  clearCache(): void {
    const fallback = this.artworkCache.get('fallback');
    this.artworkCache.clear();
    if (fallback) {
      this.artworkCache.set('fallback', fallback);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    memoryUsage: number; // Estimated in bytes
  } {
    let estimatedSize = 0;
    
    for (const [key, value] of this.artworkCache) {
      estimatedSize += key.length * 2; // String characters
      estimatedSize += value.length * 1.33; // Base64 overhead approximation
    }

    return {
      size: this.artworkCache.size,
      memoryUsage: estimatedSize
    };
  }

  /**
   * Utility methods
   */
  private getImageFormatFromExtension(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/jpeg';
    }
  }

  private getOptimalFormat(originalFormat: string): 'jpeg' | 'png' | 'webp' {
    // For album artwork, JPEG is usually the best choice for size/quality
    if (originalFormat.includes('png') && originalFormat.includes('alpha')) {
      return 'png'; // Preserve transparency
    }
    return 'jpeg';
  }

  private generateAlbumId(albumName: string, artistName: string): string {
    return 'album_' + btoa(`${artistName}:${albumName}`).replace(/[+/=]/g, '');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearCache();
  }
}

// Singleton instance
export const albumArtManager = new AlbumArtManagerService();