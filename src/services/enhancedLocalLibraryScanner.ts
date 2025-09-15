import type { LocalTrack, LocalLibrarySettings } from '../types/spotify.d.ts';
import * as musicMetadata from 'music-metadata';
import { watch, FSWatcher } from 'chokidar';
import { enhancedLocalLibraryDatabase } from './enhancedLocalLibraryDatabase';
import { albumArtManager } from './albumArtManager';

export interface EnhancedScanProgress {
  isScanning: boolean;
  totalFiles: number;
  scannedFiles: number;
  currentFile: string;
  currentOperation: 'scanning' | 'extracting_metadata' | 'processing_artwork' | 'updating_database';
  errors: string[];
  warnings: string[];
  artworkExtracted: number;
  duplicatesFound: number;
  estimatedTimeRemaining?: number;
}

export interface ScanStatistics {
  totalFilesProcessed: number;
  artworkExtracted: number;
  duplicatesSkipped: number;
  errorsEncountered: number;
  processingTime: number;
  averageFileProcessingTime: number;
}

export class EnhancedLocalLibraryScannerService {
  private settings: LocalLibrarySettings = {
    musicDirectories: [],
    watchForChanges: true,
    scanOnStartup: true,
    autoIndexNewFiles: true,
    supportedFormats: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'alac'],
    excludePatterns: ['.*', 'node_modules', '.git', 'System Volume Information', 'Thumbs.db', '.DS_Store'],
    includeSubdirectories: true
  };

  private watchers: Map<string, FSWatcher> = new Map();
  private scanProgress: EnhancedScanProgress = {
    isScanning: false,
    totalFiles: 0,
    scannedFiles: 0,
    currentFile: '',
    currentOperation: 'scanning',
    errors: [],
    warnings: [],
    artworkExtracted: 0,
    duplicatesFound: 0
  };

  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  private scanStartTime = 0;
  private lastProgressUpdate = 0;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    const stored = localStorage.getItem('enhancedLocalLibrarySettings');
    if (stored) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      } catch (error) {
        console.warn('Failed to load enhanced library settings:', error);
      }
    }
  }

  private saveSettings(): void {
    localStorage.setItem('enhancedLocalLibrarySettings', JSON.stringify(this.settings));
  }

  /**
   * Enhanced directory scanning with parallel processing
   */
  async scanAllDirectories(options: {
    extractArtwork?: boolean;
    parallel?: boolean;
    batchSize?: number;
  } = {}): Promise<ScanStatistics> {
    if (this.scanProgress.isScanning) {
      throw new Error('Scan already in progress');
    }

    const {
      extractArtwork = true,
      parallel = false,
      batchSize = 10
    } = options;

    this.scanStartTime = Date.now();
    this.resetScanProgress();
    this.scanProgress.isScanning = true;
    
    this.emit('scanStarted', {});

    try {
      // Phase 1: Count all files
      console.log('🔍 Phase 1: Counting audio files...');
      this.scanProgress.currentOperation = 'scanning';
      
      for (const directory of this.settings.musicDirectories) {
        await this.countFilesInDirectory(directory);
      }

      console.log(`📁 Found ${this.scanProgress.totalFiles} audio files`);

      if (this.scanProgress.totalFiles === 0) {
        this.scanProgress.isScanning = false;
        return this.createScanStatistics();
      }

      // Phase 2: Process files
      console.log('🎶 Phase 2: Processing metadata and artwork...');
      
      if (parallel) {
        await this.scanDirectoriesParallel(batchSize, extractArtwork);
      } else {
        await this.scanDirectoriesSequential(extractArtwork);
      }

      // Phase 3: Post-processing
      console.log('📊 Phase 3: Updating database aggregates...');
      await this.postProcessScan();

      const statistics = this.createScanStatistics();
      
      this.emit('scanCompleted', {
        statistics,
        errors: this.scanProgress.errors,
        warnings: this.scanProgress.warnings
      });

      return statistics;

    } catch (error) {
      this.emit('scanError', { error });
      throw error;
    } finally {
      this.scanProgress.isScanning = false;
    }
  }

  private async scanDirectoriesSequential(extractArtwork: boolean): Promise<void> {
    for (const directory of this.settings.musicDirectories) {
      await this.scanDirectory(directory, extractArtwork);
    }
  }

  private async scanDirectoriesParallel(batchSize: number, extractArtwork: boolean): Promise<void> {
    const allFiles: string[] = [];
    
    // Collect all files
    for (const directory of this.settings.musicDirectories) {
      const files = await this.getAudioFilesInDirectory(directory);
      allFiles.push(...files);
    }

    // Process files in batches
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      const promises = batch.map(filePath => this.scanFile(filePath, extractArtwork));
      
      try {
        await Promise.all(promises);
      } catch (error) {
        console.warn('Error in parallel batch processing:', error);
      }

      this.updateProgress();
    }
  }

  private async scanDirectory(directory: string, extractArtwork: boolean): Promise<void> {
    try {
      const files = await this.getAudioFilesInDirectory(directory);

      for (const filePath of files) {
        try {
          await this.scanFile(filePath, extractArtwork);
          this.updateProgress();
        } catch (error) {
          console.error(`Failed to scan file ${filePath}:`, error);
          this.scanProgress.errors.push(`${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${directory}:`, error);
      this.scanProgress.errors.push(`Directory ${directory}: ${error.message}`);
    }
  }

  private async getAudioFilesInDirectory(directory: string): Promise<string[]> {
    if (!window.electronAPI) {
      throw new Error('File system access not available');
    }

    return await window.electronAPI.getAudioFiles(directory, {
      recursive: this.settings.includeSubdirectories,
      extensions: this.settings.supportedFormats,
      exclude: this.settings.excludePatterns
    });
  }

  private async scanFile(filePath: string, extractArtwork = true): Promise<LocalTrack | null> {
    try {
      // Check if file was already scanned and is unchanged
      const fileStats = await window.electronAPI.getFileStats(filePath);
      const existingTrack = await enhancedLocalLibraryDatabase.getTrackByPath(filePath);
      
      if (existingTrack && existingTrack.dateModified.getTime() === fileStats.mtime.getTime()) {
        this.scanProgress.duplicatesFound++;
        return existingTrack;
      }

      this.scanProgress.currentFile = filePath;
      this.scanProgress.currentOperation = 'extracting_metadata';

      // Read file buffer for metadata extraction
      const buffer = await window.electronAPI.readFileBuffer(filePath);
      
      // Extract metadata with comprehensive options
      const metadata = await musicMetadata.parseBuffer(buffer, {
        skipCovers: !extractArtwork,
        includeChapters: false,
        duration: true,
        skipPostHeaders: false
      });

      // Extract album art
      let albumArt: string | undefined;
      if (extractArtwork && metadata.common.picture && metadata.common.picture.length > 0) {
        this.scanProgress.currentOperation = 'processing_artwork';
        
        try {
          
          // Use album art manager for processing
          const track = this.createTrackObject(metadata, filePath, fileStats, undefined);
          const artwork = await albumArtManager.extractEmbeddedArtwork(filePath, track, {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.85,
            format: 'jpeg'
          });
          
          if (artwork) {
            albumArt = artwork.data;
            this.scanProgress.artworkExtracted++;
          }
        } catch (artError) {
          console.warn(`Failed to process artwork for ${filePath}:`, artError);
          this.scanProgress.warnings.push(`Artwork processing failed for ${filePath}: ${artError.message}`);
        }
      }

      this.scanProgress.currentOperation = 'updating_database';

      // Create enhanced track object
      const track = this.createTrackObject(metadata, filePath, fileStats, albumArt, existingTrack);

      // Save to database
      await enhancedLocalLibraryDatabase.saveTrack(track);

      // Extract directory artwork if no embedded artwork
      if (extractArtwork && !albumArt) {
        try {
          const directoryPath = await window.electronAPI.dirname(filePath);
          const directoryArtwork = await albumArtManager.scanDirectoryForArtwork(
            directoryPath,
            track.album,
            track.artist
          );
          
          if (directoryArtwork) {
            this.scanProgress.artworkExtracted++;
          }
        } catch (dirArtError) {
          console.warn(`Failed to scan directory artwork for ${filePath}:`, dirArtError);
        }
      }

      this.emit('trackScanned', { track });
      this.scanProgress.scannedFiles++;

      return track;

    } catch (error) {
      console.error(`Failed to scan file ${filePath}:`, error);
      this.scanProgress.errors.push(`${filePath}: ${error.message}`);
      throw error;
    }
  }

  private createTrackObject(
    metadata: musicMetadata.IAudioMetadata,
    filePath: string,
    fileStats: { size: number; mtime: Date; isFile?: boolean },
    albumArt?: string,
    existingTrack?: LocalTrack
  ): LocalTrack {
    const fileName = filePath.split(/[/\\]/).pop() || '';
    const format = filePath.split('.').pop()?.toLowerCase() || 'unknown';

    // Log codec information for debugging
    if (metadata.format.codec) {
      console.log(`🎵 Detected codec for ${fileName}: ${metadata.format.codec}`);
    }

    return {
      id: existingTrack?.id || this.generateTrackId(filePath),
      name: metadata.common.title || this.extractTitleFromFilename(filePath),
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      duration: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : 0,
      filePath,
      fileName,
      fileSize: fileStats.size,
      format,
      codec: metadata.format.codec, // Store the actual codec (e.g., 'ALAC', 'AAC', 'MP3', etc.)
      bitrate: metadata.format.bitrate,
      sampleRate: metadata.format.sampleRate,
      trackNumber: metadata.common.track?.no,
      year: metadata.common.year,
      genre: Array.isArray(metadata.common.genre) ? metadata.common.genre.join(', ') : metadata.common.genre,
      albumArtist: metadata.common.albumartist,
      composer: Array.isArray(metadata.common.composer) ? metadata.common.composer.join(', ') : metadata.common.composer,
      comment: Array.isArray(metadata.common.comment) ? metadata.common.comment.join(', ') : metadata.common.comment,
      lyrics: Array.isArray(metadata.common.lyrics) ? metadata.common.lyrics.join('\n') : metadata.common.lyrics,
      albumArt: albumArt || existingTrack?.albumArt,
      dateAdded: existingTrack?.dateAdded || new Date(),
      dateModified: fileStats.mtime,
      playCount: existingTrack?.playCount || 0,
      lastPlayed: existingTrack?.lastPlayed,
      source: 'local'
    };
  }

  private async countFilesInDirectory(directory: string): Promise<void> {
    try {
      const files = await this.getAudioFilesInDirectory(directory);
      this.scanProgress.totalFiles += files.length;
    } catch (error) {
      console.error(`Failed to count files in ${directory}:`, error);
      this.scanProgress.errors.push(`Count failed for ${directory}: ${error.message}`);
    }
  }

  private async postProcessScan(): Promise<void> {
    try {
      // Rebuild database aggregates
      await enhancedLocalLibraryDatabase.rebuildAggregatedData();
      
      // Run database maintenance
      await enhancedLocalLibraryDatabase.analyze();
      
      // Clear old performance metrics
      await enhancedLocalLibraryDatabase.clearOldPerformanceMetrics(30);
      
    } catch (error) {
      console.warn('Post-processing failed:', error);
      this.scanProgress.warnings.push(`Post-processing failed: ${error.message}`);
    }
  }

  private updateProgress(): void {
    const now = Date.now();
    
    // Throttle progress updates to every 100ms
    if (now - this.lastProgressUpdate < 100) {
      return;
    }
    
    this.lastProgressUpdate = now;

    // Calculate estimated time remaining
    if (this.scanProgress.scannedFiles > 0) {
      const elapsedTime = now - this.scanStartTime;
      const averageTimePerFile = elapsedTime / this.scanProgress.scannedFiles;
      const remainingFiles = this.scanProgress.totalFiles - this.scanProgress.scannedFiles;
      this.scanProgress.estimatedTimeRemaining = Math.round(remainingFiles * averageTimePerFile);
    }

    this.emit('scanProgress', {
      progress: (this.scanProgress.scannedFiles / this.scanProgress.totalFiles) * 100,
      currentFile: this.scanProgress.currentFile,
      currentOperation: this.scanProgress.currentOperation,
      scannedFiles: this.scanProgress.scannedFiles,
      totalFiles: this.scanProgress.totalFiles,
      artworkExtracted: this.scanProgress.artworkExtracted,
      duplicatesFound: this.scanProgress.duplicatesFound,
      estimatedTimeRemaining: this.scanProgress.estimatedTimeRemaining
    });
  }

  private resetScanProgress(): void {
    this.scanProgress = {
      isScanning: false,
      totalFiles: 0,
      scannedFiles: 0,
      currentFile: '',
      currentOperation: 'scanning',
      errors: [],
      warnings: [],
      artworkExtracted: 0,
      duplicatesFound: 0
    };
  }

  private createScanStatistics(): ScanStatistics {
    const processingTime = Date.now() - this.scanStartTime;
    
    return {
      totalFilesProcessed: this.scanProgress.scannedFiles,
      artworkExtracted: this.scanProgress.artworkExtracted,
      duplicatesSkipped: this.scanProgress.duplicatesFound,
      errorsEncountered: this.scanProgress.errors.length,
      processingTime,
      averageFileProcessingTime: this.scanProgress.scannedFiles > 0 
        ? processingTime / this.scanProgress.scannedFiles 
        : 0
    };
  }

  /**
   * Enhanced file watching with debouncing
   */
  private startWatching(directory: string): void {
    if (this.watchers.has(directory)) {
      return;
    }

    const watcher = watch(directory, {
      ignored: (path: string) => {
        const basename = path.split(/[/\\]/).pop() || '';
        return this.settings.excludePatterns.some(pattern => 
          basename.startsWith('.') || basename.includes(pattern)
        );
      },
      persistent: true,
      ignoreInitial: true,
      depth: this.settings.includeSubdirectories ? undefined : 1,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    // Debounce file operations to avoid excessive processing
    const debouncedOperations = new Map<string, NodeJS.Timeout>();

    const debounceOperation = (filePath: string, operation: () => void, delay = 1000) => {
      const existing = debouncedOperations.get(filePath);
      if (existing) {
        clearTimeout(existing);
      }
      
      const timeout = setTimeout(() => {
        operation();
        debouncedOperations.delete(filePath);
      }, delay);
      
      debouncedOperations.set(filePath, timeout);
    };

    watcher.on('add', (filePath: string) => {
      if (this.isAudioFile(filePath)) {
        debounceOperation(filePath, async () => {
          try {
            await this.scanFile(filePath, true);
            this.emit('fileAdded', { filePath });
          } catch (error) {
            console.error(`Failed to add file ${filePath}:`, error);
          }
        });
      }
    });

    watcher.on('change', (filePath: string) => {
      if (this.isAudioFile(filePath)) {
        debounceOperation(filePath, async () => {
          try {
            await this.scanFile(filePath, true);
            this.emit('fileChanged', { filePath });
          } catch (error) {
            console.error(`Failed to update file ${filePath}:`, error);
          }
        });
      }
    });

    watcher.on('unlink', (filePath: string) => {
      if (this.isAudioFile(filePath)) {
        debounceOperation(filePath, async () => {
          try {
            await enhancedLocalLibraryDatabase.removeTrackByPath(filePath);
            this.emit('fileRemoved', { filePath });
          } catch (error) {
            console.error(`Failed to remove file ${filePath}:`, error);
          }
        }, 500); // Shorter delay for deletions
      }
    });

    watcher.on('error', (error: Error) => {
      console.error(`Watcher error for ${directory}:`, error);
      this.emit('watcherError', { directory, error });
    });

    this.watchers.set(directory, watcher);
  }

  /**
   * Smart duplicate detection
   */
  async detectDuplicates(): Promise<{
    byChecksum: LocalTrack[][];
    byMetadata: LocalTrack[][];
    bySimilarity: LocalTrack[][];
  }> {
    // This would require implementing checksum calculation and metadata comparison
    // For now, return empty results
    return {
      byChecksum: [],
      byMetadata: [],
      bySimilarity: []
    };
  }

  /**
   * Cleanup operations
   */
  async cleanupOrphanedEntries(): Promise<{
    removedTracks: number;
    removedArtwork: number;
  }> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    let removedTracks = 0;
    const removedArtwork = 0;

    try {
      // Get all tracks from database
      const tracks = await enhancedLocalLibraryDatabase.getAllTracks();
      
      for (const track of tracks) {
        try {
          // Check if file still exists
          const stats = await window.electronAPI.getFileStats(track.filePath);
          if (!stats.isFile) {
            await enhancedLocalLibraryDatabase.removeTrackByPath(track.filePath);
            removedTracks++;
          }
        } catch {
          // File doesn't exist, remove from database
          await enhancedLocalLibraryDatabase.removeTrackByPath(track.filePath);
          removedTracks++;
        }
      }

      /**
       * TODO: Cleanup orphaned artwork entries
       * 
       * @priority: Medium
       * @context: Database maintenance and cleanup
       * @dependencies: Additional database methods for artwork management
       * @requirements:
       * - Query database for artwork entries without associated tracks
       * - Remove orphaned artwork files from storage
       * - Update database to remove orphaned artwork records
       * - Handle artwork that may be shared across multiple tracks
       * 
       * @issue: Database cleanup and storage optimization
       * @estimated-effort: 1-2 days
       * @impact: Storage optimization and database integrity
       */
      // TODO: Cleanup orphaned artwork entries
      // This would require additional database methods

    } catch (error) {
      console.error('Cleanup failed:', error);
      throw error;
    }

    return { removedTracks, removedArtwork };
  }

  /**
   * Generates a unique track ID from file path
   * 
   * Creates a deterministic but unique identifier for tracks based on their
   * file path. Uses base64 encoding with URL-safe character replacement
   * to ensure compatibility with database storage and URL usage.
   * 
   * @param filePath - Full file system path to the audio file
   * @returns Unique track identifier prefixed with 'local_'
   * 
   * @example
   * generateTrackId('/Music/Album/Track.mp3') // Returns: 'local_L011aWMvYmljL0FsYnVtL1RyYWNrLm1wMw'
   */
  private generateTrackId(filePath: string): string {
    return 'local_' + btoa(filePath).replace(/[+/=]/g, '');
  }

  /**
   * Extracts track title from filename using pattern matching
   * 
   * Attempts to extract a clean track title from various filename formats
   * commonly used in music libraries. Uses multiple regex patterns to handle
   * different naming conventions and removes track numbers, artist names,
   * and other metadata from the filename.
   * 
   * @param filePath - Full file system path to the audio file
   * @returns Cleaned track title extracted from filename
   * 
   * @patterns
   * - Track number - Title: "01 - Song Title.mp3" → "Song Title"
   * - Title - Artist: "Song Title - Artist Name.mp3" → "Song Title"
   * - Track number Title: "01 Song Title.mp3" → "Song Title"
   * - Title_number: "Song Title_01.mp3" → "Song Title"
   * - Plain filename: "Song Title.mp3" → "Song Title"
   * 
   * @example
   * extractTitleFromFilename('/Music/01 - Bohemian Rhapsody.mp3') // Returns: "Bohemian Rhapsody"
   * extractTitleFromFilename('/Music/Song Title - Queen.mp3') // Returns: "Song Title"
   */
  private extractTitleFromFilename(filePath: string): string {
    const filename = filePath.split(/[/\\]/).pop() || '';
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
    
    // Enhanced pattern matching for common filename formats
    // Each pattern attempts to extract the clean title from different naming conventions
    const patterns = [
      /^\d+\s*[-.\s]\s*(.+)$/, // Track number - Title (e.g., "01 - Song Title")
      /^(.+?)\s*[-]\s*.+$/, // Title - Artist (e.g., "Song Title - Artist Name")
      /^\d+\s+(.+)$/, // Track number Title (e.g., "01 Song Title")
      /^(.+?)_\d+$/, // Title_number (e.g., "Song Title_01")
      /^(.+)$/ // Just the filename (fallback pattern)
    ];

    // Try each pattern in order until a match is found
    for (const pattern of patterns) {
      const match = nameWithoutExtension.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return nameWithoutExtension;
  }

  /**
   * Checks if a file is a supported audio format
   * 
   * Validates file extension against the list of supported audio formats
   * configured in the scanner settings. Case-insensitive comparison.
   * 
   * @param filePath - Full file system path to check
   * @returns True if file extension is in supported formats list
   * 
   * @supported-formats
   * - mp3, flac, wav, ogg, m4a, aac, wma, alac
   * 
   * @example
   * isAudioFile('/Music/song.mp3') // Returns: true
   * isAudioFile('/Music/image.jpg') // Returns: false
   */
  private isAudioFile(filePath: string): boolean {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return extension ? this.settings.supportedFormats.includes(extension) : false;
  }

  // Public API (enhanced versions)
  async addMusicDirectory(directory: string): Promise<void> {
    if (!this.settings.musicDirectories.includes(directory)) {
      this.settings.musicDirectories.push(directory);
      this.saveSettings();
      
      if (this.settings.watchForChanges) {
        this.startWatching(directory);
      }
      
      if (this.settings.autoIndexNewFiles) {
        await this.scanDirectory(directory, true);
      }
      
      this.emit('directoryAdded', { directory });
    }
  }

  async removeMusicDirectory(directory: string): Promise<void> {
    const index = this.settings.musicDirectories.indexOf(directory);
    if (index > -1) {
      this.settings.musicDirectories.splice(index, 1);
      this.saveSettings();
      
      this.stopWatching(directory);
      
      // Remove tracks from this directory from database
      await enhancedLocalLibraryDatabase.removeTracksByDirectory(directory);
      
      this.emit('directoryRemoved', { directory });
    }
  }

  private stopWatching(directory: string): void {
    const watcher = this.watchers.get(directory);
    if (watcher) {
      watcher.close();
      this.watchers.delete(directory);
    }
  }

  getSettings(): LocalLibrarySettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<LocalLibrarySettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    
    // Restart watchers if watch settings changed
    if ('watchForChanges' in newSettings) {
      if (newSettings.watchForChanges) {
        this.settings.musicDirectories.forEach(dir => this.startWatching(dir));
      } else {
        this.watchers.forEach((watcher, dir) => this.stopWatching(dir));
      }
    }
    
    this.emit('settingsUpdated', { settings: this.settings });
  }

  getScanProgress(): EnhancedScanProgress {
    return { ...this.scanProgress };
  }

  isScanning(): boolean {
    return this.scanProgress.isScanning;
  }

  // Event system (unchanged)
  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // Cleanup
  destroy(): void {
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers.clear();
    this.listeners.clear();
    albumArtManager.destroy();
  }
}

// Singleton instance
export const enhancedLocalLibraryScanner = new EnhancedLocalLibraryScannerService();