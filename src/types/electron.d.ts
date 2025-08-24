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
  getDirectoryFiles(directoryPath: string): Promise<string[]>;
  
  // Image processing operations (Phase 2)
  processImage(imageData: Buffer, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
  }): Promise<{ data: Buffer; format: string }>;
  
  getImageDimensions(imageData: Buffer): Promise<{ width: number; height: number }>;
  
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
  
  // Basic database operations
  dbInitialize(): Promise<boolean>;
  dbGetAllTracks(): Promise<LocalTrack[]>;
  dbGetAllAlbums(): Promise<any[]>;
  dbGetAllArtists(): Promise<any[]>;
  dbClearLibrary(): Promise<void>;
  dbGetStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
  }>;
  dbUpdatePlayCount(trackId: string): Promise<void>;
  
  // Enhanced Phase 2 database operations
  dbSearchTracks(options: {
    query: string;
    type: string;
    limit?: number;
    offset?: number;
    fuzzyMatch?: boolean;
  }): Promise<LocalTrack[]>;
  
  dbFilterTracks(criteria: any, limit?: number, offset?: number): Promise<LocalTrack[]>;
  dbGetAlbumArtwork(trackId: string): Promise<any>;
  dbVacuum(): Promise<{ success: boolean }>;
  dbAnalyze(): Promise<{ success: boolean }>;
  dbGetPerformanceMetrics(limit?: number): Promise<any[]>;
  dbGetDetailedStats(): Promise<{
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalDuration: number;
    totalFileSize: number;
    averageBitrate: number;
    formatBreakdown: { format: string; count: number; total_size: number }[];
    genreBreakdown: { genre: string; count: number }[];
    yearBreakdown: { year: number; count: number }[];
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
  scannerScanDirectories(options?: {
    extractArtwork?: boolean;
    parallel?: boolean;
    batchSize?: number;
  }): Promise<{ 
    success: boolean;
    message: string;
    totalFiles?: number;
    processedFiles?: number;
    errors?: number;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}