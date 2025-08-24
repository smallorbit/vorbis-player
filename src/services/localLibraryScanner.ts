import type { LocalTrack, LocalLibrarySettings } from '../types/spotify.d.ts';
import * as musicMetadata from 'music-metadata';
import { watch, FSWatcher } from 'chokidar';
import { localLibraryDatabase } from './localLibraryDatabaseIPC';

export class LocalLibraryScannerService {
  private settings: LocalLibrarySettings = {
    musicDirectories: [],
    watchForChanges: true,
    scanOnStartup: true,
    autoIndexNewFiles: true,
    supportedFormats: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac'],
    excludePatterns: ['.*', 'node_modules', '.git', 'System Volume Information'],
    includeSubdirectories: true
  };

  private watchers: Map<string, FSWatcher> = new Map();
  private scanProgress: {
    isScanning: boolean;
    totalFiles: number;
    scannedFiles: number;
    currentFile: string;
    errors: string[];
  } = {
    isScanning: false,
    totalFiles: 0,
    scannedFiles: 0,
    currentFile: '',
    errors: []
  };

  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    const stored = localStorage.getItem('localLibrarySettings');
    if (stored) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      } catch (error) {
        console.warn('Failed to load library settings:', error);
      }
    }
  }

  private saveSettings(): void {
    localStorage.setItem('localLibrarySettings', JSON.stringify(this.settings));
  }

  async addMusicDirectory(directory: string): Promise<void> {
    if (!this.settings.musicDirectories.includes(directory)) {
      this.settings.musicDirectories.push(directory);
      this.saveSettings();
      
      if (this.settings.watchForChanges) {
        this.startWatching(directory);
      }
      
      if (this.settings.autoIndexNewFiles) {
        await this.scanDirectory(directory);
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
      await localLibraryDatabase.removeTracksByDirectory(directory);
      
      this.emit('directoryRemoved', { directory });
    }
  }

  async scanAllDirectories(forceRescan = false): Promise<void> {
    this.scanProgress.isScanning = true;
    this.scanProgress.totalFiles = 0;
    this.scanProgress.scannedFiles = 0;
    this.scanProgress.errors = [];
    
    this.emit('scanStarted', {});

    try {
      // First pass: count files
      for (const directory of this.settings.musicDirectories) {
        await this.countFilesInDirectory(directory);
      }

      // Second pass: scan files
      for (const directory of this.settings.musicDirectories) {
        await this.scanDirectory(directory, forceRescan);
      }

      this.emit('scanCompleted', { 
        totalFiles: this.scanProgress.totalFiles,
        scannedFiles: this.scanProgress.scannedFiles,
        errors: this.scanProgress.errors
      });

    } catch (error) {
      this.emit('scanError', { error });
    } finally {
      this.scanProgress.isScanning = false;
    }
  }

  private async countFilesInDirectory(directory: string): Promise<void> {
    try {
      if (window.electronAPI) {
        const files = await window.electronAPI.getAudioFiles(directory, {
          recursive: this.settings.includeSubdirectories,
          extensions: this.settings.supportedFormats,
          exclude: this.settings.excludePatterns
        });
        this.scanProgress.totalFiles += files.length;
      }
    } catch (error) {
      console.error(`Failed to count files in ${directory}:`, error);
    }
  }

  private async scanDirectory(directory: string, forceRescan = false): Promise<void> {
    try {
      if (!window.electronAPI) {
        throw new Error('File system access not available');
      }

      const files = await window.electronAPI.getAudioFiles(directory, {
        recursive: this.settings.includeSubdirectories,
        extensions: this.settings.supportedFormats,
        exclude: this.settings.excludePatterns
      });

      for (const filePath of files) {
        try {
          await this.scanFile(filePath, forceRescan);
          this.scanProgress.scannedFiles++;
          
          this.emit('scanProgress', {
            progress: (this.scanProgress.scannedFiles / this.scanProgress.totalFiles) * 100,
            currentFile: filePath,
            scannedFiles: this.scanProgress.scannedFiles,
            totalFiles: this.scanProgress.totalFiles
          });
        } catch (error) {
          console.error(`Failed to scan file ${filePath}:`, error);
          this.scanProgress.errors.push(`${filePath}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(`Failed to scan directory ${directory}:`, error);
      throw error;
    }
  }

  private async scanFile(filePath: string, forceRescan = false): Promise<LocalTrack | null> {
    try {
      // Check if file was already scanned and is unchanged
      const fileStats = await window.electronAPI.getFileStats(filePath);
      const existingTrack = await localLibraryDatabase.getTrackByPath(filePath);
      
      // Skip if file hasn't changed and we're not forcing a rescan, AND codec info exists
      if (!forceRescan && existingTrack && existingTrack.dateModified.getTime() === fileStats.mtime.getTime() && existingTrack.codec) {
        return existingTrack;
      }

      this.scanProgress.currentFile = filePath;

      // Read file buffer for metadata extraction
      const buffer = await window.electronAPI.readFileBuffer(filePath);
      
      // Extract metadata
      const metadata = await musicMetadata.parseBuffer(buffer, {
        skipCovers: false,
        includeChapters: false
      });

      // Extract album art
      let albumArt: string | undefined;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
        albumArt = `data:${picture.format};base64,${picture.data.toString('base64')}`;
      }

      // Log codec information for debugging
      if (metadata.format.codec) {
        console.log(`🎵 Detected codec for ${this.extractFilename(filePath)}: ${metadata.format.codec}`);
      }

      // Create track object
      const track: LocalTrack = {
        id: this.generateTrackId(filePath),
        name: metadata.common.title || this.extractTitleFromFilename(filePath),
        artist: metadata.common.artist || 'Unknown Artist',
        album: metadata.common.album || 'Unknown Album',
        duration: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : 0,
        filePath,
        fileName: this.extractFilename(filePath),
        fileSize: fileStats.size,
        format: this.extractFormat(filePath),
        codec: metadata.format.codec, // Store the actual codec (e.g., 'ALAC', 'AAC', 'MP3', etc.)
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        trackNumber: metadata.common.track?.no,
        year: metadata.common.year,
        genre: metadata.common.genre?.join(', '),
        albumArtist: metadata.common.albumartist,
        composer: metadata.common.composer?.join(', '),
        comment: metadata.common.comment?.join(', '),
        lyrics: metadata.common.lyrics?.join('\n'),
        albumArt,
        dateAdded: existingTrack?.dateAdded || new Date(),
        dateModified: fileStats.mtime,
        playCount: existingTrack?.playCount || 0,
        lastPlayed: existingTrack?.lastPlayed,
        source: 'local'
      };

      // Save to database
      await localLibraryDatabase.saveTrack(track);

      this.emit('trackScanned', { track });

      return track;
    } catch (error) {
      console.error(`Failed to scan file ${filePath}:`, error);
      throw error;
    }
  }

  private generateTrackId(filePath: string): string {
    // Generate a consistent ID based on file path
    return 'local_' + btoa(filePath).replace(/[+/=]/g, '');
  }

  private extractTitleFromFilename(filePath: string): string {
    const filename = this.extractFilename(filePath);
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
    
    // Try to parse common filename patterns
    const patterns = [
      /^\d+\s*[-.\s]\s*(.+)$/, // Track number - Title
      /^(.+?)\s*[-]\s*.+$/, // Title - Artist
      /^(.+)$/ // Just the filename
    ];

    for (const pattern of patterns) {
      const match = nameWithoutExtension.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return nameWithoutExtension;
  }

  private extractFilename(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || '';
  }

  private extractFormat(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return extension || 'unknown';
  }

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
      depth: this.settings.includeSubdirectories ? undefined : 1
    });

    watcher.on('add', async (filePath: string) => {
      if (this.isAudioFile(filePath)) {
        try {
          await this.scanFile(filePath);
          this.emit('fileAdded', { filePath });
        } catch (error) {
          console.error(`Failed to add file ${filePath}:`, error);
        }
      }
    });

    watcher.on('change', async (filePath: string) => {
      if (this.isAudioFile(filePath)) {
        try {
          await this.scanFile(filePath);
          this.emit('fileChanged', { filePath });
        } catch (error) {
          console.error(`Failed to update file ${filePath}:`, error);
        }
      }
    });

    watcher.on('unlink', async (filePath: string) => {
      if (this.isAudioFile(filePath)) {
        try {
          await localLibraryDatabase.removeTrackByPath(filePath);
          this.emit('fileRemoved', { filePath });
        } catch (error) {
          console.error(`Failed to remove file ${filePath}:`, error);
        }
      }
    });

    watcher.on('error', (error: Error) => {
      console.error(`Watcher error for ${directory}:`, error);
      this.emit('watcherError', { directory, error });
    });

    this.watchers.set(directory, watcher);
  }

  private stopWatching(directory: string): void {
    const watcher = this.watchers.get(directory);
    if (watcher) {
      watcher.close();
      this.watchers.delete(directory);
    }
  }

  private isAudioFile(filePath: string): boolean {
    const extension = filePath.split('.').pop()?.toLowerCase();
    return extension ? this.settings.supportedFormats.includes(extension) : false;
  }

  // Public API
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

  getScanProgress() {
    return { ...this.scanProgress };
  }

  isScanning(): boolean {
    return this.scanProgress.isScanning;
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
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

  // Utility function to clear library and rescan
  async clearAndRescan(): Promise<void> {
    try {
      console.log('🗑️ Clearing library and rescanning...');
      
      // Clear the library
      await localLibraryDatabase.clearLibrary();
      
      // Force rescan all directories
      await this.scanAllDirectories(true);
      
      console.log('✅ Library cleared and rescanned successfully');
    } catch (error) {
      console.error('Failed to clear and rescan:', error);
      throw error;
    }
  }

  // Cleanup
  destroy(): void {
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers.clear();
    this.listeners.clear();
  }
}

// Singleton instance
export const localLibraryScanner = new LocalLibraryScannerService();

// Expose for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).debugClearAndRescan = () => localLibraryScanner.clearAndRescan();
  (window as any).debugClearLibrary = () => localLibraryDatabase.clearLibrary();
  (window as any).debugScanLibrary = () => localLibraryScanner.scanAllDirectories(true);
}