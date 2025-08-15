import type { LocalLibrarySettings } from '../types/spotify.d.ts';

// IPC-based scanner service for renderer process
// This uses the electronAPI bridge instead of importing chokidar and music-metadata directly
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

  async loadSettings(): Promise<void> {
    try {
      if (window.electronAPI) {
        this.settings = await window.electronAPI.scannerGetSettings();
        console.log('📂 Loaded scanner settings:', this.settings);
      }
    } catch (error) {
      console.warn('Failed to load scanner settings:', error);
    }
  }

  async updateSettings(newSettings: Partial<LocalLibrarySettings>): Promise<void> {
    try {
      if (window.electronAPI) {
        this.settings = await window.electronAPI.scannerUpdateSettings(newSettings);
      } else {
        this.settings = { ...this.settings, ...newSettings };
      }
    } catch (error) {
      console.error('Failed to update scanner settings:', error);
      throw error;
    }
  }

  getSettings(): LocalLibrarySettings {
    return { ...this.settings };
  }

  async addMusicDirectory(directory: string): Promise<void> {
    try {
      if (window.electronAPI) {
        await window.electronAPI.scannerAddDirectory(directory);
        // Update local settings
        if (!this.settings.musicDirectories.includes(directory)) {
          this.settings.musicDirectories.push(directory);
        }
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('Failed to add music directory:', error);
      throw error;
    }
  }

  async removeMusicDirectory(directory: string): Promise<void> {
    try {
      if (window.electronAPI) {
        await window.electronAPI.scannerRemoveDirectory(directory);
        // Update local settings
        this.settings.musicDirectories = this.settings.musicDirectories.filter(dir => dir !== directory);
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('Failed to remove music directory:', error);
      throw error;
    }
  }

  async scanAllDirectories(): Promise<void> {
    try {
      if (window.electronAPI) {
        await window.electronAPI.scannerScanDirectories();
      } else {
        throw new Error('Electron API not available');
      }
    } catch (error) {
      console.error('Failed to scan directories:', error);
      throw error;
    }
  }

  async getScanProgress(): Promise<{
    isScanning: boolean;
    totalFiles: number;
    scannedFiles: number;
    currentFile: string;
    errors: string[];
  }> {
    try {
      if (window.electronAPI) {
        return await window.electronAPI.scannerGetProgress();
      } else {
        return {
          isScanning: false,
          totalFiles: 0,
          scannedFiles: 0,
          currentFile: '',
          errors: []
        };
      }
    } catch (error) {
      console.error('Failed to get scan progress:', error);
      return {
        isScanning: false,
        totalFiles: 0,
        scannedFiles: 0,
        currentFile: '',
        errors: [error.message]
      };
    }
  }

  // Stub methods for compatibility (not implemented in IPC version)
  async stopWatching(): Promise<void> {
    // File watching is handled in the main process
    console.log('File watching stopped (handled by main process)');
  }

  async startWatching(): Promise<void> {
    // File watching is handled in the main process
    console.log('File watching started (handled by main process)');
  }
}

// Export singleton instance
export const localLibraryScanner = new LocalLibraryScannerService();
