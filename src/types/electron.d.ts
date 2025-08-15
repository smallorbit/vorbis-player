// Electron API interface for local music library functionality
export interface ElectronAPI {
  // File system operations
  getAudioFiles(directory: string, options: {
    recursive: boolean;
    extensions: string[];
    exclude: string[];
  }): Promise<string[]>;
  
  getFileStats(filePath: string): Promise<{
    size: number;
    mtime: Date;
    isFile: boolean;
    isDirectory: boolean;
  }>;
  
  readAudioFile(filePath: string): Promise<ArrayBuffer>;
  readFileBuffer(filePath: string): Promise<Buffer>;
  
  // Directory operations
  selectMusicDirectory(): Promise<string | null>;
  
  // Database operations
  getDatabasePath(): Promise<string>;
  
  // Path operations
  joinPath(...paths: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  
  // App operations
  getAppVersion(): Promise<string>;
  getAppPath(): Promise<string>;
  getUserDataPath(): Promise<string>;
  
  // Database operations
  dbInitialize(): Promise<boolean>;
  dbGetAllTracks(): Promise<LocalTrack[]>;
  dbGetAllAlbums(): Promise<any[]>;
  dbGetAllArtists(): Promise<any[]>;
  dbGetStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
  }>;
  
  // Scanner operations
  scannerGetSettings(): Promise<{
    musicDirectories: string[];
    watchForChanges: boolean;
    scanOnStartup: boolean;
    autoIndexNewFiles: boolean;
    supportedFormats: string[];
    excludePatterns: string[];
    includeSubdirectories: boolean;
  }>;
  scannerUpdateSettings(settings: any): Promise<any>;
  scannerAddDirectory(directory: string): Promise<void>;
  scannerRemoveDirectory(directory: string): Promise<void>;
  scannerGetProgress(): Promise<{
    isScanning: boolean;
    totalFiles: number;
    scannedFiles: number;
    currentFile: string;
    errors: string[];
  }>;
  scannerScanDirectories(): Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}